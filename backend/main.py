from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import or_, and_, func, String, case, select
from typing import List, Optional
from datetime import timedelta, datetime
import uuid
import os
import shutil

from database import get_db, create_tables, User, Ticket, Modification, Comment, Status, Crit, Center, Tool
from models import (
    UserCreate, User as UserModel, TicketCreate, Ticket as TicketModel, 
    TicketUpdate, TicketWithRelations, ModificationCreate, Modification as ModificationModel,
    Token, Status as StatusModel, Crit as CritModel, Center as CenterModel, Tool as ToolModel,
    TicketListResponse, ModificationListResponse, GroupedModificationListResponse, UserUpdate,
    CommentCreate, Comment as CommentModel, CommentWithUser, CommentListResponse,
    ProfileCompleteRequest, FirstPasswordChange
)
from auth import (
    authenticate_user, create_access_token, get_current_active_user, 
    get_current_complete_user, get_password_hash, check_permission, ACCESS_TOKEN_EXPIRE_MINUTES
)
from ticket_id_generator import generate_ticket_id

# Status transition rules - defines valid transitions between statuses
STATUS_TRANSITIONS = {
    'created': ['reviewed', 'notified', 'deleted'],
    'reviewed': ['notified', 'closed', 'solved', 'deleted'],
    'deleted': ['reopened'],
    'notified': ['resolving', 'deleted'],
    'resolving': ['on_hold', 'closed', 'solved', 'deleted'],
    'on_hold': ['resolving', 'closed', 'solved', 'deleted'],
    'closed': ['reopened', 'deleted'],
    'solved': ['reopened', 'deleted'],
    'reopened': ['notified', 'closed', 'solved', 'deleted']
}

def is_valid_status_transition(from_status_value: str, to_status_value: str) -> bool:
    """
    Check if a status transition is valid
    
    Args:
        from_status_value: Current status value (e.g., 'created', 'reviewed')
        to_status_value: Target status value
        
    Returns:
        True if transition is valid, False otherwise
    """
    if not from_status_value or not to_status_value:
        return False
    
    from_status = from_status_value.lower()
    to_status = to_status_value.lower()
    
    # Same status is always valid (no change)
    if from_status == to_status:
        return True
    
    # Check if transition is in allowed list
    valid_next_statuses = STATUS_TRANSITIONS.get(from_status, [])
    return to_status in valid_next_statuses

app = FastAPI(title="Ticket Manager API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = "uploads"
TICKETS_UPLOADS_DIR = os.path.join(UPLOADS_DIR, "tickets")
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)
if not os.path.exists(TICKETS_UPLOADS_DIR):
    os.makedirs(TICKETS_UPLOADS_DIR)

# Mount static files for serving uploaded files
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    create_tables()
    # Initialize missing reference data (statuses, crits, centers, tools)
    # This ensures new statuses are automatically added on deployment
    from config_manager import config_manager
    from database import SessionLocal
    db = SessionLocal()
    try:
        # Load and initialize statuses from config
        try:
            statuses = config_manager.get_statuses()
            for status_data in statuses:
                existing = db.query(Status).filter(Status.value == status_data["value"]).first()
                if not existing:
                    db_status = Status(**status_data)
                    db.add(db_status)
                    print(f"✅ Auto-added missing status: {status_data['desc']} ({status_data['value']})")
            db.commit()
        except Exception as e:
            print(f"⚠️ Warning: Could not auto-initialize statuses on startup: {e}")
            db.rollback()
    except Exception as e:
        print(f"⚠️ Warning: Error during startup initialization: {e}")
        db.rollback()
    finally:
        db.close()

# Authentication endpoints
@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user_inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserModel)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# User management endpoints
@app.post("/users/", response_model=UserModel)
async def create_user(
    user: UserCreate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 can create users
    
    # Check if username or email already exists
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Auto-generate password from email (part before @)
    auto_password = user.email.split('@')[0]
    hashed_password = get_password_hash(auto_password)
    
    # Determine if profile needs completion based on whether optional fields are provided
    needs_profile_completion = not (user.name and user.surnames and user.role)
    
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        permission_level=user.permission_level if user.permission_level is not None else 4,  # Default to level 4 (Viewer)
        default_center_id=user.default_center_id,
        name=user.name,
        surnames=user.surnames,
        phone=user.phone,
        worktime=user.worktime,
        role=user.role,
        is_active=True,  # New users are active by default
        must_complete_profile=needs_profile_completion,  # Must complete profile if not all info provided
        must_change_password=True  # Must change password on first login
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/", response_model=List[UserModel])
async def get_users(
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)
    users = db.query(User).all()
    return users

@app.get("/users/list", response_model=List[UserModel])
async def get_users_list(
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Get list of users for dropdown selection (permission level 2+)"""
    check_permission(current_user, 2)
    users = db.query(User).filter(User.is_active == True).all()
    return users

@app.put("/users/me", response_model=UserModel)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    # Update only the fields that are provided
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Handle password change separately
    if "password" in update_data:
        hashed_password = get_password_hash(update_data.pop("password"))
        current_user.hashed_password = hashed_password
    
    # Update other fields
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/users/me/complete-profile", response_model=UserModel)
async def complete_profile(
    profile_data: ProfileCompleteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Complete user profile on first login"""
    # Validate role
    valid_roles = ["administratiu", "Metge de familia", "Infermeria"]
    if profile_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Validate center if provided
    if profile_data.default_center_id is not None:
        center = db.query(Center).filter(Center.id == profile_data.default_center_id).first()
        if not center:
            raise HTTPException(status_code=400, detail="Invalid center_id")
    
    # Update user profile
    current_user.name = profile_data.name
    current_user.surnames = profile_data.surnames
    current_user.role = profile_data.role
    current_user.default_center_id = profile_data.default_center_id
    current_user.phone = profile_data.phone
    current_user.worktime = profile_data.worktime
    current_user.must_complete_profile = False
    
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/users/me/change-first-password", response_model=UserModel)
async def change_first_password(
    password_data: FirstPasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change password on first login"""
    # Validate password length
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    
    db.commit()
    db.refresh(current_user)
    return current_user

@app.put("/users/{user_id}", response_model=UserModel)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 can update other users
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update only the fields that are provided
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Handle password change separately
    if "password" in update_data:
        hashed_password = get_password_hash(update_data.pop("password"))
        db_user.hashed_password = hashed_password
    
    # Update other fields
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 (admin) can delete users
    
    # Prevent users from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if this is the last admin
    if db_user.permission_level == 1:
        admin_count = db.query(User).filter(User.permission_level == 1, User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last active admin user"
            )
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}

@app.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 (admin) can reset passwords
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Extract email prefix (part before @) as default password
    email_prefix = db_user.email.split('@')[0]
    hashed_password = get_password_hash(email_prefix)
    
    db_user.hashed_password = hashed_password
    db.commit()
    db.refresh(db_user)
    
    return {
        "message": "Password reset successfully",
        "default_password": email_prefix
    }

@app.get("/users/{user_id}/tickets", response_model=List[TicketWithRelations])
async def get_user_tickets(
    user_id: int,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 (admin) can view user tickets
    
    # Verify user exists
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all tickets created by this user
    tickets = db.query(Ticket).filter(Ticket.creator == user_id).order_by(Ticket.creation_date.desc()).all()
    
    # Convert to dictionaries with relations
    ticket_dicts = []
    for ticket in tickets:
        ticket_dict = {
            "id": ticket.id,
            "type": ticket.type,
            "title": ticket.title,
            "ticket_num": ticket.ticket_num,
            "description": ticket.description,
            "url": ticket.url,
            "status_id": ticket.status_id,
            "crit_id": ticket.crit_id,
            "center_id": ticket.center_id,
            "tool_id": ticket.tool_id,
            "creation_date": ticket.creation_date.isoformat() if ticket.creation_date else None,
            "modify_date": ticket.modify_date.isoformat() if ticket.modify_date else None,
            "resolution_date": ticket.resolution_date.isoformat() if ticket.resolution_date else None,
            "delete_date": ticket.delete_date.isoformat() if ticket.delete_date else None,
            "modify_reason": ticket.modify_reason,
            "notifier": ticket.notifier,
            "people": ticket.people,
            "creator": ticket.creator,
            "pathway": ticket.pathway,
            "supports": ticket.supports,
            "attached": ticket.attached,
            "comments_count": db.query(func.count(Comment.id)).filter(Comment.ticket_id == ticket.id).scalar() or 0,
            "status": {
                "id": ticket.status.id,
                "value": ticket.status.value,
                "desc": ticket.status.desc
            } if ticket.status else None,
            "crit": {
                "id": ticket.crit.id,
                "value": ticket.crit.value,
                "desc": ticket.crit.desc
            } if ticket.crit else None,
            "center": {
                "id": ticket.center.id,
                "value": ticket.center.value,
                "desc": ticket.center.desc
            } if ticket.center else None,
            "tool": {
                "id": ticket.tool.id,
                "value": ticket.tool.value,
                "desc": ticket.tool.desc
            } if ticket.tool else None,
            "created_by_user": {
                "id": ticket.created_by_user.id,
                "username": ticket.created_by_user.username,
                "email": ticket.created_by_user.email,
                "permission_level": ticket.created_by_user.permission_level,
                "is_active": ticket.created_by_user.is_active
            } if ticket.created_by_user else None
        }
        ticket_dicts.append(ticket_dict)
    
    return ticket_dicts

# File upload endpoints
@app.post("/tickets/{ticket_id}/upload")
async def upload_files(
    ticket_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Upload multiple file attachments to a ticket"""
    check_permission(current_user, 2)  # Level 2+ can upload files
    
    # Verify ticket exists
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Validate file types and sizes
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB limit
    ALLOWED_EXTENSIONS = {
        '.pdf', '.doc', '.docx', '.txt', '.rtf',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp',
        '.xls', '.xlsx', '.csv', '.ppt', '.pptx',
        '.zip', '.rar', '.7z', '.tar', '.gz'
    }
    
    uploaded_files = []
    failed_uploads = []
    
    try:
        for file in files:
            # Validate file size
            if file.size and file.size > MAX_FILE_SIZE:
                failed_uploads.append({
                    "filename": file.filename,
                    "error": f"File size {file.size} bytes exceeds limit of {MAX_FILE_SIZE} bytes"
                })
                continue
            
            # Validate file extension
            if file.filename:
                file_extension = os.path.splitext(file.filename)[1].lower()
                if file_extension not in ALLOWED_EXTENSIONS:
                    failed_uploads.append({
                        "filename": file.filename,
                        "error": f"File extension {file_extension} not allowed"
                    })
                    continue
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
            safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ") if file.filename else "unknown"
            unique_filename = f"{timestamp}_{uuid.uuid4().hex[:8]}{file_extension}"
            
            # Create organized directory structure: tickets/{ticket_id}/attachments/{year}/{month}/
            year_month = datetime.now().strftime("%Y/%m")
            ticket_upload_dir = os.path.join(TICKETS_UPLOADS_DIR, ticket_id, "attachments", year_month)
            os.makedirs(ticket_upload_dir, exist_ok=True)
            
            file_path = os.path.join(ticket_upload_dir, unique_filename)
            
            try:
                # Save file to disk
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                # Get file metadata
                file_size = os.path.getsize(file_path)
                file_hash = calculate_file_hash(file_path)
                
                # Create file record
                file_record = {
                    "filename": file.filename,
                    "original_name": file.filename,
                    "path": f"tickets/{ticket_id}/attachments/{year_month}/{unique_filename}",
                    "size": file_size,
                    "hash": file_hash,
                    "uploaded_by": current_user.username,
                    "uploaded_at": datetime.now().isoformat(),
                    "file_type": file_extension.lower(),
                    "content_type": file.content_type or "application/octet-stream",
                    "ticket_id": ticket_id
                }
                
                uploaded_files.append(file_record)
                
            except Exception as e:
                failed_uploads.append({
                    "filename": file.filename,
                    "error": f"Failed to save file: {str(e)}"
                })
                # Clean up partial file if it exists
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        # Update ticket attachments in database
        if uploaded_files:
            current_attachments = db_ticket.attached or []
            old_attachments = current_attachments.copy()
            current_attachments.extend(uploaded_files)
            
            # Update the ticket's attached field
            db_ticket.attached = current_attachments
            
            # Flag the JSON field as modified so SQLAlchemy detects the change
            flag_modified(db_ticket, "attached")
            
            # First commit the ticket update
            try:
                db.commit()
                print(f"DEBUG: Successfully updated ticket with {len(uploaded_files)} new files")
            except Exception as e:
                print(f"DEBUG: Error updating ticket: {e}")
                db.rollback()
                # Clean up uploaded files if database update fails
                for file_record in uploaded_files:
                    file_path = os.path.join(UPLOADS_DIR, file_record["path"])
                    if os.path.exists(file_path):
                        os.remove(file_path)
                raise HTTPException(status_code=500, detail=f"Error updating ticket: {str(e)}")
            
            # Now create the modification record
            try:
                file_names = [f["original_name"] for f in uploaded_files]
                modification = Modification(
                    ticket_id=ticket_id,
                    user_id=current_user.id,
                    reason=f"Files uploaded: {', '.join(file_names)}",
                    field_name="attached",
                    old_value=str(len(old_attachments)),
                    new_value=str(len(current_attachments))
                )
                db.add(modification)
                db.commit()
                print(f"DEBUG: Successfully created modification: {modification.reason}")
            except Exception as e:
                print(f"DEBUG: Error creating modification: {e}")
                # Don't rollback the ticket update, just log the error
                print(f"WARNING: Files were uploaded but modification tracking failed: {e}")
        
        return {
            "message": f"Upload completed. {len(uploaded_files)} files uploaded successfully.",
            "uploaded_files": uploaded_files,
            "failed_uploads": failed_uploads,
            "total_uploaded": len(uploaded_files),
            "total_failed": len(failed_uploads)
        }
        
    except Exception as e:
        # Rollback any successful uploads if database update fails
        for file_record in uploaded_files:
            file_path = os.path.join(UPLOADS_DIR, file_record["path"])
            if os.path.exists(file_path):
                os.remove(file_path)
        
        raise HTTPException(status_code=500, detail=f"Error during file upload: {str(e)}")

@app.post("/tickets/{ticket_id}/upload-single")
async def upload_single_file(
    ticket_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Upload a single file attachment to a ticket (for backward compatibility)"""
    result = await upload_files(ticket_id, [file], current_user, db)
    return result

def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of a file for integrity verification"""
    import hashlib
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

@app.get("/tickets/{ticket_id}/attachments")
async def get_ticket_attachments(
    ticket_id: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about all attachments for a ticket"""
    check_permission(current_user, 2)  # Level 2+ can view attachments
    
    # Verify ticket exists
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    attachments = db_ticket.attached or []
    
    # Add additional metadata
    enhanced_attachments = []
    for attachment in attachments:
        file_path = os.path.join(UPLOADS_DIR, attachment["path"])
        if os.path.exists(file_path):
            # Get file modification time
            stat_info = os.stat(file_path)
            attachment["last_modified"] = datetime.fromtimestamp(stat_info.st_mtime).isoformat()
            attachment["file_exists"] = True
        else:
            attachment["file_exists"] = False
            attachment["last_modified"] = None
        
        enhanced_attachments.append(attachment)
    
    # Also check the ticket's upload directory structure
    ticket_upload_dir = os.path.join(TICKETS_UPLOADS_DIR, ticket_id, "attachments")
    directory_info = {}
    if os.path.exists(ticket_upload_dir):
        try:
            for year_dir in os.listdir(ticket_upload_dir):
                year_path = os.path.join(ticket_upload_dir, year_dir)
                if os.path.isdir(year_path):
                    month_info = {}
                    for month_dir in os.listdir(year_path):
                        month_path = os.path.join(year_path, month_dir)
                        if os.path.isdir(month_path):
                            files = os.listdir(month_path)
                            month_info[month_dir] = files
                    directory_info[year_dir] = month_info
        except Exception as e:
            print(f"DEBUG: Error reading directory structure: {e}")
    
    return {
        "ticket_id": ticket_id,
        "total_attachments": len(enhanced_attachments),
        "total_size": sum(att.get("size", 0) for att in enhanced_attachments),
        "attachments": enhanced_attachments,
        "directory_structure": directory_info
    }

@app.get("/tickets/{ticket_id}/view/{file_path:path}")
async def view_attachment(
    ticket_id: str,
    file_path: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """View a file attachment from a ticket in browser (requires authentication)"""
    check_permission(current_user, 2)  # Level 2+ can view files
    
    # Verify ticket exists
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Construct full file path
    full_path = os.path.join(UPLOADS_DIR, file_path)
    
    # Verify file exists
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verify the file belongs to this ticket (security check)
    # The file path should start with tickets/{ticket_id}/
    if not file_path.startswith(f"tickets/{ticket_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get content type from attachment metadata or infer from file extension
    attachments = db_ticket.attached or []
    attachment = next((att for att in attachments if att.get("path") == file_path), None)
    
    if attachment and attachment.get("content_type"):
        media_type = attachment.get("content_type")
    else:
        # Infer content type from file extension
        import mimetypes
        media_type, _ = mimetypes.guess_type(full_path)
        if not media_type:
            media_type = 'application/octet-stream'
    
    # Return file for inline viewing (no filename parameter = inline display)
    return FileResponse(
        path=full_path,
        media_type=media_type
    )

@app.get("/tickets/{ticket_id}/download/{file_path:path}")
async def download_attachment(
    ticket_id: str,
    file_path: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Download a file attachment from a ticket (requires authentication)"""
    check_permission(current_user, 2)  # Level 2+ can download files
    
    # Verify ticket exists
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Construct full file path
    full_path = os.path.join(UPLOADS_DIR, file_path)
    
    # Verify file exists
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verify the file belongs to this ticket (security check)
    # The file path should start with tickets/{ticket_id}/
    if not file_path.startswith(f"tickets/{ticket_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get original filename and content type from attachment metadata if available
    attachments = db_ticket.attached or []
    attachment = next((att for att in attachments if att.get("path") == file_path), None)
    filename = attachment.get("original_name", os.path.basename(file_path)) if attachment else os.path.basename(file_path)
    
    # Get content type from attachment metadata or infer from file extension
    if attachment and attachment.get("content_type"):
        media_type = attachment.get("content_type")
    else:
        # Infer content type from file extension
        import mimetypes
        media_type, _ = mimetypes.guess_type(full_path)
        if not media_type:
            media_type = 'application/octet-stream'
    
    return FileResponse(
        path=full_path,
        filename=filename,
        media_type=media_type
    )

@app.delete("/tickets/{ticket_id}/attachments/{filename:path}")
async def delete_attachment(
    ticket_id: str,
    filename: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Delete a file attachment from a ticket"""
    print(f"DEBUG: Delete attachment called by user {current_user.username} with permission level {current_user.permission_level}")
    check_permission(current_user, 2)  # Level 1 (admin) or 2 (editor) can delete files
    
    # Decode the URL-encoded filename
    import urllib.parse
    decoded_filename = urllib.parse.unquote(filename)
    print(f"DEBUG: Original filename parameter: {filename}")
    print(f"DEBUG: Decoded filename: {decoded_filename}")
    
    # Verify ticket exists
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Find and remove attachment
    current_attachments = db_ticket.attached or []
    attachment_to_remove = None
    
    print(f"DEBUG: Looking for attachment with filename: {decoded_filename}")
    print(f"DEBUG: Current attachments: {current_attachments}")
    
    # The filename parameter is actually the path from the attachment object
    for attachment in current_attachments:
        print(f"DEBUG: Checking attachment: {attachment}")
        if attachment.get("path") == decoded_filename:
            attachment_to_remove = attachment
            print(f"DEBUG: Found attachment by path: {attachment}")
            break
    
    if not attachment_to_remove:
        # Try to find by original_name as fallback
        print(f"DEBUG: Not found by path, trying original_name")
        for attachment in current_attachments:
            if attachment.get("original_name") == decoded_filename:
                attachment_to_remove = attachment
                print(f"DEBUG: Found attachment by original_name: {attachment}")
                break
    
    if not attachment_to_remove:
        print(f"DEBUG: Attachment not found")
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Remove file from disk
    file_path = os.path.join(UPLOADS_DIR, attachment_to_remove["path"])
    print(f"DEBUG: UPLOADS_DIR: {UPLOADS_DIR}")
    print(f"DEBUG: Attachment path: {attachment_to_remove['path']}")
    print(f"DEBUG: Full file path: {file_path}")
    print(f"DEBUG: File exists: {os.path.exists(file_path)}")
    
    # List directory contents for debugging
    try:
        upload_dir = os.path.dirname(file_path)
        if os.path.exists(upload_dir):
            print(f"DEBUG: Directory contents of {upload_dir}: {os.listdir(upload_dir)}")
        else:
            print(f"DEBUG: Directory {upload_dir} does not exist")
    except Exception as e:
        print(f"DEBUG: Error listing directory: {e}")
    
    # Also check the ticket-specific directory
    try:
        ticket_upload_dir = os.path.join(TICKETS_UPLOADS_DIR, ticket_id, "attachments")
        if os.path.exists(ticket_upload_dir):
            print(f"DEBUG: Ticket upload directory contents: {os.listdir(ticket_upload_dir)}")
            for year_dir in os.listdir(ticket_upload_dir):
                year_path = os.path.join(ticket_upload_dir, year_dir)
                if os.path.isdir(year_path):
                    month_dirs = os.listdir(year_path)
                    print(f"DEBUG: Year {year_dir} contains months: {month_dirs}")
                    for month_dir in month_dirs:
                        month_path = os.path.join(year_path, month_dir)
                        if os.path.isdir(month_path):
                            files = os.listdir(month_path)
                            print(f"DEBUG: Month {month_dir} contains files: {files}")
    except Exception as e:
        print(f"DEBUG: Error listing ticket directory: {e}")
    
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            print(f"DEBUG: Successfully deleted file from disk")
        except OSError as e:
            print(f"DEBUG: Error deleting file from disk: {e}")
            raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
    else:
        print(f"DEBUG: File does not exist on disk, but continuing with database update")
    
    # Remove from database
    print(f"DEBUG: Removing attachment from database: {attachment_to_remove}")
    current_attachments.remove(attachment_to_remove)
    db_ticket.attached = current_attachments
    print(f"DEBUG: Updated attachments list: {db_ticket.attached}")
    
    # Flag the JSON field as modified so SQLAlchemy detects the change
    flag_modified(db_ticket, "attached")
    
    # First commit the ticket update
    try:
        db.commit()
        print(f"DEBUG: Successfully updated ticket after file deletion")
    except Exception as e:
        print(f"DEBUG: Error updating ticket: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating ticket: {str(e)}")
    
    # Now create the modification record
    try:
        print(f"DEBUG: Creating modification record")
        modification = Modification(
            ticket_id=ticket_id,
            user_id=current_user.id,
            reason=f"File deleted: {attachment_to_remove['original_name']}",
            field_name="attached",
            old_value=str(len(current_attachments) + 1),
            new_value=str(len(current_attachments))
        )
        db.add(modification)
        db.commit()
        print(f"DEBUG: Successfully created modification: {modification.reason}")
    except Exception as e:
        print(f"DEBUG: Error creating modification: {e}")
        # Don't rollback the ticket update, just log the error
        print(f"WARNING: File was deleted but modification tracking failed: {e}")
    
    # Clean up empty directories
    try:
        cleanup_empty_directories(ticket_id, attachment_to_remove["path"])
    except Exception as e:
        print(f"DEBUG: Warning: Failed to cleanup directories: {e}")
    
    print(f"DEBUG: Returning success response")
    return {
        "message": "Attachment deleted successfully",
        "deleted_file": attachment_to_remove["filename"],
        "remaining_attachments": len(current_attachments)
    }

# Ticket endpoints
@app.post("/tickets/", response_model=TicketModel)
async def create_ticket(
    ticket: TicketCreate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 2)  # Level 2+ can create tickets
    
    # Generate unique hex-based ticket ID
    ticket_id = generate_ticket_id(ticket.type, db)
    
    # Handle optional center_id
    ticket_data = ticket.dict()
    if ticket_data.get('center_id') == 0:
        ticket_data['center_id'] = None
    
    # Handle optional people - convert None to empty list
    if ticket_data.get('people') is None:
        ticket_data['people'] = []
    
    # Set creation date and creator
    ticket_data['creation_date'] = datetime.now().date()
    ticket_data['creator'] = current_user.id
    ticket_data['supports'] = 0  # Default value
    ticket_data['attached'] = []  # Initialize empty attachments
    
    # Create ticket with generated ID
    db_ticket = Ticket(id=ticket_id, **ticket_data)
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.get("/tickets/", response_model=TicketListResponse)
async def get_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status_id: Optional[int] = None,
    type: Optional[str] = None,
    crit_id: Optional[int] = None,
    tool_id: Optional[int] = None,
    center_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    search: Optional[str] = None,
    show_hidden: bool = Query(False, description="Show hidden tickets (discarted, solved, closed, deleted)"),
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    
    # Apply regular filters first
    if status_id:
        query = query.filter(Ticket.status_id == status_id)
    if type:
        query = query.filter(Ticket.type == type)
    
    # Filter out hidden statuses by default (discarted, solved, closed, deleted)
    if not show_hidden:
        # Get status IDs for hidden statuses
        hidden_statuses = db.query(Status).filter(
            Status.value.in_(['discarted', 'solved', 'closed', 'deleted'])
        ).all()
        hidden_status_ids = [s.id for s in hidden_statuses]
        if hidden_status_ids:
            query = query.filter(~Ticket.status_id.in_(hidden_status_ids))
    if crit_id:
        query = query.filter(Ticket.crit_id == crit_id)
    if tool_id:
        query = query.filter(Ticket.tool_id == tool_id)
    if center_id:
        query = query.filter(Ticket.center_id == center_id)
    if date_from:
        query = query.filter(Ticket.creation_date >= date_from)
    if date_to:
        query = query.filter(Ticket.creation_date <= date_to)
    
    # Apply search filter with proper joins
    if search and search.strip():
        search_term = f"%{search.strip().lower()}%"
        
        # First, save all the filters we've already applied
        # Create a subquery to find matching ticket IDs with search
        # Label the ID column explicitly
        search_query = db.query(Ticket.id.label('ticket_id'))
        
        # Apply all the same filters to the search subquery
        if status_id:
            search_query = search_query.filter(Ticket.status_id == status_id)
        if type:
            search_query = search_query.filter(Ticket.type == type)
        
        # Apply hidden status filter to search subquery too
        if not show_hidden:
            hidden_statuses = db.query(Status).filter(
                Status.value.in_(['discarted', 'solved', 'closed', 'deleted'])
            ).all()
            hidden_status_ids = [s.id for s in hidden_statuses]
            if hidden_status_ids:
                search_query = search_query.filter(~Ticket.status_id.in_(hidden_status_ids))
        
        if crit_id:
            search_query = search_query.filter(Ticket.crit_id == crit_id)
        if tool_id:
            search_query = search_query.filter(Ticket.tool_id == tool_id)
        if center_id:
            search_query = search_query.filter(Ticket.center_id == center_id)
        if date_from:
            search_query = search_query.filter(Ticket.creation_date >= date_from)
        if date_to:
            search_query = search_query.filter(Ticket.creation_date <= date_to)
        
        # Join tables needed for search
        from sqlalchemy.orm import aliased
        NotifierUser = aliased(User)
        search_query = search_query.join(User, Ticket.creator == User.id)
        search_query = search_query.join(Tool, Ticket.tool_id == Tool.id)
        search_query = search_query.outerjoin(NotifierUser, Ticket.notifier == NotifierUser.id)
        
        # Build search conditions
        search_conditions = [
            func.lower(Ticket.title).like(search_term),
            func.lower(Ticket.description).like(search_term),
            func.lower(Tool.desc).like(search_term),
            func.lower(User.username).like(search_term),
            func.lower(Ticket.id).like(search_term),  # Search in ticket ID
        ]
        
        # Handle notifier search by username
        notifier_match = and_(
            Ticket.notifier.isnot(None),
            func.lower(NotifierUser.username).like(search_term)
        )
        search_conditions.append(notifier_match)
        
        # Handle ticket_num search (only match if ticket_num is not NULL AND matches)
        ticket_num_match = and_(
            Ticket.ticket_num.isnot(None),
            func.lower(Ticket.ticket_num).like(search_term)
        )
        search_conditions.append(ticket_num_match)
        
        # Handle people array search for SQLite
        # Convert JSON array to text and search in it
        people_search = func.lower(func.cast(Ticket.people, String)).like(search_term)
        search_conditions.append(people_search)
        
        # Apply search filter and get distinct ticket IDs
        matching_ticket_ids = search_query.filter(or_(*search_conditions)).distinct().subquery()
        
        # Filter main query by matching ticket IDs
        # Use the labeled column name
        query = query.filter(Ticket.id.in_(select(matching_ticket_ids.c.ticket_id)))
    
    # Apply sorting
    # Track which tables we've already joined for search
    joined_tables = set()
    if search and search.strip():
        joined_tables.add('User')
        joined_tables.add('Tool')
    
    if sort_by:
        if sort_by == 'creation_date':
            if sort_order == 'desc':
                query = query.order_by(Ticket.creation_date.desc())
            else:
                query = query.order_by(Ticket.creation_date.asc())
        elif sort_by == 'title':
            if sort_order == 'desc':
                query = query.order_by(Ticket.title.desc())
            else:
                query = query.order_by(Ticket.title.asc())
        elif sort_by == 'ticket_num':
            if sort_order == 'desc':
                query = query.order_by(Ticket.ticket_num.desc())
            else:
                query = query.order_by(Ticket.ticket_num.asc())
        elif sort_by == 'status':
            # Only join if not already joined
            if 'Status' not in joined_tables:
                query = query.join(Status)
                joined_tables.add('Status')
            if sort_order == 'desc':
                query = query.order_by(Status.id.desc())
            else:
                query = query.order_by(Status.id.asc())
        elif sort_by == 'priority':
            # Only join if not already joined
            if 'Crit' not in joined_tables:
                query = query.join(Crit)
                joined_tables.add('Crit')
            if sort_order == 'desc':
                query = query.order_by(Crit.id.desc())
            else:
                query = query.order_by(Crit.id.asc())
    
    total = query.count()
    tickets = query.offset(skip).limit(limit).all()
    
    # Get all ticket IDs for batch comment count query
    ticket_ids = [ticket.id for ticket in tickets]
    
    # Batch query comment counts for all tickets
    comment_counts = {}
    if ticket_ids:
        comment_count_query = db.query(
            Comment.ticket_id,
            func.count(Comment.id).label('count')
        ).filter(Comment.ticket_id.in_(ticket_ids)).group_by(Comment.ticket_id).all()
        comment_counts = {ticket_id: count for ticket_id, count in comment_count_query}
    
    # Convert SQLAlchemy objects to dictionaries for Pydantic
    ticket_dicts = []
    for ticket in tickets:
        ticket_dict = {
            "id": ticket.id,
            "type": ticket.type,
            "title": ticket.title,
            "ticket_num": ticket.ticket_num,
            "description": ticket.description,
            "url": ticket.url,
            "status_id": ticket.status_id,
            "crit_id": ticket.crit_id,
            "center_id": ticket.center_id,
            "tool_id": ticket.tool_id,
            "creation_date": ticket.creation_date.isoformat() if ticket.creation_date else None,
            "modify_date": ticket.modify_date.isoformat() if ticket.modify_date else None,
            "resolution_date": ticket.resolution_date.isoformat() if ticket.resolution_date else None,
            "delete_date": ticket.delete_date.isoformat() if ticket.delete_date else None,
            "modify_reason": ticket.modify_reason,
            "notifier": ticket.notifier if isinstance(ticket.notifier, int) else None,
            "people": ticket.people if ticket.people else [],
            "creator": ticket.creator,
            "pathway": ticket.pathway,
            "supports": ticket.supports,
            "attached": ticket.attached,
            "comments_count": comment_counts.get(ticket.id, 0),
            "status": {
                "id": ticket.status.id,
                "value": ticket.status.value,
                "desc": ticket.status.desc
            } if ticket.status else None,
            "crit": {
                "id": ticket.crit.id,
                "value": ticket.crit.value,
                "desc": ticket.crit.desc
            } if ticket.crit else None,
            "center": {
                "id": ticket.center.id,
                "value": ticket.center.value,
                "desc": ticket.center.desc
            } if ticket.center else None,
            "tool": {
                "id": ticket.tool.id,
                "value": ticket.tool.value,
                "desc": ticket.tool.desc
            } if ticket.tool else None,
            "created_by_user": {
                "id": ticket.created_by_user.id,
                "username": ticket.created_by_user.username,
                "email": ticket.created_by_user.email,
                "permission_level": ticket.created_by_user.permission_level,
                "is_active": ticket.created_by_user.is_active
            } if ticket.created_by_user else None,
            "notifier_user": {
                "id": ticket.notifier_user.id,
                "username": ticket.notifier_user.username,
                "email": ticket.notifier_user.email,
                "permission_level": ticket.notifier_user.permission_level,
                "is_active": ticket.notifier_user.is_active
            } if ticket.notifier_user else None
        }
        ticket_dicts.append(ticket_dict)
    
    return TicketListResponse(
        tickets=ticket_dicts,
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@app.get("/tickets/{ticket_id}", response_model=TicketWithRelations)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get comment count for this ticket
    comments_count = db.query(func.count(Comment.id)).filter(Comment.ticket_id == ticket_id).scalar() or 0
    
    # Convert SQLAlchemy object to dictionary for Pydantic
    ticket_dict = {
        "id": ticket.id,
        "type": ticket.type,
        "title": ticket.title,
        "ticket_num": ticket.ticket_num,
        "description": ticket.description,
        "url": ticket.url,
        "status_id": ticket.status_id,
        "crit_id": ticket.crit_id,
        "center_id": ticket.center_id,
        "tool_id": ticket.tool_id,
        "creation_date": ticket.creation_date.isoformat() if ticket.creation_date else None,
        "modify_date": ticket.modify_date.isoformat() if ticket.modify_date else None,
        "resolution_date": ticket.resolution_date.isoformat() if ticket.resolution_date else None,
        "delete_date": ticket.delete_date.isoformat() if ticket.delete_date else None,
        "modify_reason": ticket.modify_reason,
        "notifier": ticket.notifier if isinstance(ticket.notifier, int) else None,
        "people": ticket.people if ticket.people else [],
        "creator": ticket.creator,
        "pathway": ticket.pathway,
        "supports": ticket.supports,
        "attached": ticket.attached,
        "comments_count": comments_count,
        "status": {
            "id": ticket.status.id,
            "value": ticket.status.value,
            "desc": ticket.status.desc
        } if ticket.status else None,
        "crit": {
            "id": ticket.crit.id,
            "value": ticket.crit.value,
            "desc": ticket.crit.desc
        } if ticket.crit else None,
        "center": {
            "id": ticket.center.id,
            "value": ticket.center.value,
            "desc": ticket.center.desc
        } if ticket.center else None,
        "tool": {
            "id": ticket.tool.id,
            "value": ticket.tool.value,
            "desc": ticket.tool.desc
        } if ticket.tool else None,
        "created_by_user": {
            "id": ticket.created_by_user.id,
            "username": ticket.created_by_user.username,
            "email": ticket.created_by_user.email,
            "permission_level": ticket.created_by_user.permission_level,
            "is_active": ticket.created_by_user.is_active
        } if ticket.created_by_user else None,
        "notifier_user": {
            "id": ticket.notifier_user.id,
            "username": ticket.notifier_user.username,
            "email": ticket.notifier_user.email,
            "permission_level": ticket.notifier_user.permission_level,
            "is_active": ticket.notifier_user.is_active
        } if ticket.notifier_user else None
    }
    return ticket_dict

@app.put("/tickets/{ticket_id}", response_model=TicketModel)
async def update_ticket(
    ticket_id: str,
    ticket_update: TicketUpdate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 2)  # Level 1 (admin) or 2 (editor) can modify tickets
    
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Store original values for comparison
    original_values = {
        'ticket_num': db_ticket.ticket_num,
        'type': db_ticket.type,
        'title': db_ticket.title,
        'description': db_ticket.description,
        'url': db_ticket.url,
        'status_id': db_ticket.status_id,
        'crit_id': db_ticket.crit_id,
        'center_id': db_ticket.center_id,
        'tool_id': db_ticket.tool_id,
        'notifier': db_ticket.notifier,
        'people': db_ticket.people,
        'pathway': db_ticket.pathway,
        'attached': db_ticket.attached
    }
    
    update_data = ticket_update.model_dump(exclude_unset=True)
    
    # Handle optional center_id
    if 'center_id' in update_data and update_data['center_id'] == 0:
        update_data['center_id'] = None
    
    # Handle optional people - convert None to empty list
    if 'people' in update_data and update_data['people'] is None:
        update_data['people'] = []
    
    # Validate status transition if status is being changed
    if 'status_id' in update_data and update_data['status_id'] != db_ticket.status_id:
        current_status = db.query(Status).filter(Status.id == db_ticket.status_id).first()
        new_status = db.query(Status).filter(Status.id == update_data['status_id']).first()
        
        if not new_status:
            raise HTTPException(status_code=400, detail="Invalid status ID")
        
        if current_status and not is_valid_status_transition(current_status.value, new_status.value):
            # Get valid next status descriptions
            valid_next_statuses = STATUS_TRANSITIONS.get(current_status.value, [])
            valid_status_descs = []
            for status_value in valid_next_statuses:
                status_obj = db.query(Status).filter(Status.value == status_value).first()
                if status_obj:
                    valid_status_descs.append(status_obj.desc)
            
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition: Cannot change from '{current_status.desc}' to '{new_status.desc}'. Valid next statuses: {', '.join(valid_status_descs)}"
            )
        
        # Auto-set resolution date if status changes to solved
        if new_status.value == 'solved':
            update_data['resolution_date'] = datetime.now().date()
        elif new_status.value == 'deleted':
            update_data['delete_date'] = datetime.now().date()
    
    # Update modify_date
    update_data['modify_date'] = datetime.now()
    
    # Track changes and create modifications
    for field, new_value in update_data.items():
        if field in ['modify_date', 'resolution_date', 'delete_date']:
            continue  # Skip auto-generated fields
            
        old_value = original_values.get(field)
        
        # Special handling for attached field (JSON array)
        if field == 'attached':
            old_count = len(old_value) if old_value else 0
            new_count = len(new_value) if new_value else 0
            
            if old_count != new_count:
                # Determine what changed
                if new_count > old_count:
                    # Files were added
                    added_files = []
                    if old_value:
                        old_paths = {att.get('path') for att in old_value}
                        for att in new_value:
                            if att.get('path') not in old_paths:
                                added_files.append(att.get('original_name', att.get('filename', 'Unknown')))
                    
                    reason = f"Files added: {', '.join(added_files)}" if added_files else f"Files added ({new_count - old_count} files)"
                else:
                    # Files were removed
                    reason = f"Files removed ({old_count - new_count} files)"
                
                modification = Modification(
                    ticket_id=ticket_id,
                    user_id=current_user.id,
                    reason=reason,
                    field_name=field,
                    old_value=str(old_count),
                    new_value=str(new_count)
                )
                db.add(modification)
        elif old_value != new_value:
            # Create modification record for other fields
            modification = Modification(
                ticket_id=ticket_id,
                user_id=current_user.id,
                reason=f"Updated {field}",
                field_name=field,
                old_value=str(old_value) if old_value is not None else "",
                new_value=str(new_value) if new_value is not None else ""
            )
            db.add(modification)
        
        setattr(db_ticket, field, new_value)
    
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.delete("/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 (admin) can delete tickets
    
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Soft delete - set delete_date instead of removing
    db_ticket.delete_date = datetime.now().date()
    db.commit()
    return {"message": "Ticket deleted successfully"}

# Modification endpoints
@app.post("/modifications/", response_model=ModificationModel)
async def create_modification(
    modification: ModificationCreate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == modification.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    db_modification = Modification(**modification.model_dump(), user_id=current_user.id)
    db.add(db_modification)
    db.commit()
    db.refresh(db_modification)
    return db_modification

@app.get("/tickets/{ticket_id}/modifications", response_model=GroupedModificationListResponse)
async def get_ticket_modifications(
    ticket_id: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    modifications = db.query(Modification).filter(Modification.ticket_id == ticket_id).order_by(Modification.date.desc()).all()
    
    # Group modifications by timestamp (within 1 second)
    grouped_modifications = []
    current_group = None
    
    for mod in modifications:
        if current_group is None or abs((mod.date - current_group['date']).total_seconds()) > 1:
            # Start new group
            current_group = {
                'id': mod.id,
                'user_id': mod.user_id,
                'date': mod.date,
                'user': mod.user,
                'changes': [],
                'total_changes': 0
            }
            grouped_modifications.append(current_group)
        
        # Add change description to current group
        if mod.field_name:
            change_desc = get_change_description(mod.field_name, mod.new_value, db)
            if change_desc:
                current_group['changes'].append(change_desc)
                current_group['total_changes'] += 1
        else:
            # For manual modifications without field tracking
            current_group['changes'].append(mod.reason)
            current_group['total_changes'] += 1
    
    return GroupedModificationListResponse(modifications=grouped_modifications, total=len(grouped_modifications))

def get_change_description(field_name: str, new_value: str, db: Session) -> str:
    """Generate natural language description of a field change in Catalan"""
    field_descriptions = {
        'ticket_num': 'El número de ticket',
        'type': 'El tipus',
        'title': 'El títol',
        'description': 'La descripció',
        'url': 'La URL',
        'status_id': 'L\'estat',
        'crit_id': 'La prioritat',
        'center_id': 'El centre',
        'tool_id': 'L\'eina',
        'notifier': 'El notificador',
        'people': 'Les persones implicades',
        'pathway': 'La via de creació',
        'attached': 'Els adjunts'
    }
    
    field_desc = field_descriptions.get(field_name, field_name)
    
    # Get reference data for better descriptions
    if field_name == 'status_id' and new_value:
        status = db.query(Status).filter(Status.id == int(new_value)).first()
        if status:
            return f"L'estat s'ha canviat per {status.desc}"
    
    elif field_name == 'crit_id' and new_value:
        crit = db.query(Crit).filter(Crit.id == int(new_value)).first()
        if crit:
            return f"La prioritat ha passat a ser {crit.desc}"
    
    elif field_name == 'center_id' and new_value:
        center = db.query(Center).filter(Center.id == int(new_value)).first()
        if center:
            return f"El centre s'ha canviat per {center.desc}"
        elif new_value == "0" or new_value == "":
            return "S'ha eliminat el centre"
    
    elif field_name == 'tool_id' and new_value:
        tool = db.query(Tool).filter(Tool.id == int(new_value)).first()
        if tool:
            return f"L'eina s'ha canviat per {tool.desc}"
        elif new_value == "0" or new_value == "":
            return "S'ha eliminat l'eina"
    
    elif field_name == 'type' and new_value:
        type_desc = "Incidència" if new_value == "incidence" else "Suggeriment"
        return f"El tipus s'ha canviat per {type_desc}"
    
    elif field_name == 'title' and new_value:
        return f"El títol s'ha canviat per \"{new_value}\""
    
    elif field_name == 'description' and new_value:
        return f"La descripció s'ha actualitzat"
    
    elif field_name == 'ticket_num' and new_value:
        return f"El número de ticket s'ha canviat per {new_value}"
    
    elif field_name == 'url' and new_value:
        if new_value:
            return f"La URL s'ha canviat per {new_value}"
        else:
            return "S'ha eliminat la URL"
    
    elif field_name == 'notifier' and new_value:
        if new_value:
            return f"El notificador s'ha canviat per {new_value}"
        else:
            return "S'ha eliminat el notificador"
    
    elif field_name == 'people' and new_value:
        return f"Les persones implicades s'han actualitzat"
    
    elif field_name == 'pathway' and new_value:
        pathway_labels = {
            'web': 'Web',
            'mobile': 'Mòbil',
            'email': 'Email',
            'phone': 'Telèfon',
            'in_person': 'En persona'
        }
        pathway_desc = pathway_labels.get(new_value, new_value)
        return f"La via de creació s'ha canviat per {pathway_desc}"
    
    elif field_name == 'attached':
        try:
            new_count = int(new_value) if new_value else 0
            return f"Els adjunts s'han actualitzat ({new_count} fitxer(s))"
        except (ValueError, TypeError):
            return "Els adjunts s'han actualitzat"
    
    # Fallback
    return f"{field_desc} s'ha canviat per {new_value}"

# Comment endpoints
@app.post("/tickets/{ticket_id}/comments", response_model=CommentModel)
async def create_comment(
    ticket_id: str,
    comment: CommentCreate,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Create a new comment on a ticket"""
    check_permission(current_user, 2)  # Level 2+ can post comments
    
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Ensure ticket_id matches
    if comment.ticket_id != ticket_id:
        raise HTTPException(status_code=400, detail="Ticket ID mismatch")
    
    # Create comment
    db_comment = Comment(
        ticket_id=ticket_id,
        user_id=current_user.id,
        content=comment.content,
        created_at=datetime.utcnow()
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    # Return comment with user relationship loaded
    db.refresh(db_comment)
    # Manually load the user relationship
    comment_dict = {
        "id": db_comment.id,
        "ticket_id": db_comment.ticket_id,
        "user_id": db_comment.user_id,
        "content": db_comment.content,
        "created_at": db_comment.created_at.isoformat() if db_comment.created_at else None,
        "user": {
            "id": db_comment.user.id,
            "username": db_comment.user.username,
            "email": db_comment.user.email,
            "name": db_comment.user.name,
            "surnames": db_comment.user.surnames,
            "permission_level": db_comment.user.permission_level,
            "is_active": db_comment.user.is_active
        }
    }
    return comment_dict

@app.get("/tickets/{ticket_id}/comments", response_model=CommentListResponse)
async def get_ticket_comments(
    ticket_id: str,
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Get all comments for a ticket, ordered by newest first"""
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get comments ordered by newest first (descending)
    comments = db.query(Comment).filter(Comment.ticket_id == ticket_id).order_by(Comment.created_at.desc()).all()
    
    # Convert to dictionaries with user information
    comment_dicts = []
    for comment in comments:
        comment_dict = {
            "id": comment.id,
            "ticket_id": comment.ticket_id,
            "user_id": comment.user_id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "user": {
                "id": comment.user.id,
                "username": comment.user.username,
                "email": comment.user.email,
                "name": comment.user.name,
                "surnames": comment.user.surnames,
                "permission_level": comment.user.permission_level,
                "is_active": comment.user.is_active
            }
        }
        comment_dicts.append(comment_dict)
    
    return CommentListResponse(comments=comment_dicts, total=len(comment_dicts))

# Reference data endpoints
@app.get("/status/", response_model=List[StatusModel])
async def get_statuses(db: Session = Depends(get_db)):
    return db.query(Status).all()

@app.get("/crit/", response_model=List[CritModel])
async def get_crits(db: Session = Depends(get_db)):
    return db.query(Crit).all()

@app.get("/center/", response_model=List[CenterModel])
async def get_centers(db: Session = Depends(get_db)):
    return db.query(Center).order_by(Center.desc).all()

@app.get("/tool/", response_model=List[ToolModel])
async def get_tools(db: Session = Depends(get_db)):
    return db.query(Tool).all()

# Initialize reference data
@app.post("/init-data")
async def initialize_reference_data(db: Session = Depends(get_db)):
    # Initialize statuses
    statuses = [
        {"value": "created", "desc": "Creada"},
        {"value": "reviewed", "desc": "Revisada"},
        {"value": "discarted", "desc": "Descartada"},
        {"value": "resolving", "desc": "En resolució"},
        {"value": "notified", "desc": "Notificada"},
        {"value": "solved", "desc": "Resolta"},
        {"value": "closed", "desc": "Tancada"},
        {"value": "deleted", "desc": "Eliminada"},
        {"value": "on_hold", "desc": "Aturada"},
        {"value": "reopened", "desc": "Reoberta"}
    ]
    
    for status_data in statuses:
        existing = db.query(Status).filter(Status.value == status_data["value"]).first()
        if not existing:
            db_status = Status(**status_data)
            db.add(db_status)
    
    # Initialize crits
    crits = [
        {"value": "low", "desc": "Baixa"},
        {"value": "mid", "desc": "Mitja"},
        {"value": "high", "desc": "Alta"},
        {"value": "critical", "desc": "Crítica"}
    ]
    
    for crit_data in crits:
        existing = db.query(Crit).filter(Crit.value == crit_data["value"]).first()
        if not existing:
            db_crit = Crit(**crit_data)
            db.add(db_crit)
    
    # Initialize centers
    centers = [
        {"value": "305", "desc": "EAP St. Andreu de Llavaneres"},
        {"value": "273", "desc": "EAP Arenys de Mar"},
        {"value": "302", "desc": "EAP Mataró- 3 (Perú)"},
        {"value": "279", "desc": "EAP Mataró- 1 (La Riera)"},
        {"value": "281", "desc": "EAP Mataró- 7 (Ronda Prim)"}
    ]
    
    for center_data in centers:
        existing = db.query(Center).filter(Center.value == center_data["value"]).first()
        if not existing:
            db_center = Center(**center_data)
            db.add(db_center)
    
    db.commit()
    return {"message": "Reference data initialized successfully"}

# Dashboard statistics endpoint
@app.get("/dashboard/statistics")
async def get_dashboard_statistics(
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics including ticket counts, distributions, and trends"""
    from datetime import date, timedelta
    
    # Total tickets (excluding deleted)
    total_tickets = db.query(Ticket).filter(
        Ticket.delete_date.is_(None)
    ).count()
    
    # Tickets by type
    tickets_by_type = db.query(
        Ticket.type,
        func.count(Ticket.id).label('count')
    ).filter(
        Ticket.delete_date.is_(None)
    ).group_by(Ticket.type).all()
    type_distribution = {t[0]: t[1] for t in tickets_by_type}
    
    # Tickets by criticality
    tickets_by_crit = db.query(
        Crit.desc,
        func.count(Ticket.id).label('count')
    ).join(
        Ticket, Ticket.crit_id == Crit.id
    ).filter(
        Ticket.delete_date.is_(None)
    ).group_by(Crit.id, Crit.desc).all()
    crit_distribution = {c[0]: c[1] for c in tickets_by_crit}
    
    # Tickets by status
    tickets_by_status = db.query(
        Status.desc,
        func.count(Ticket.id).label('count')
    ).join(
        Ticket, Ticket.status_id == Status.id
    ).filter(
        Ticket.delete_date.is_(None)
    ).group_by(Status.id, Status.desc).all()
    status_distribution = {s[0]: s[1] for s in tickets_by_status}
    
    # Tickets by center
    tickets_by_center = db.query(
        Center.desc,
        func.count(Ticket.id).label('count')
    ).join(
        Ticket, Ticket.center_id == Center.id
    ).filter(
        Ticket.delete_date.is_(None)
    ).group_by(Center.id, Center.desc).all()
    center_distribution = {c[0]: c[1] for c in tickets_by_center}
    
    # Active users count
    active_users = db.query(User).filter(User.is_active == True).count()
    total_users = db.query(User).count()
    
    # Tickets created in last 30 days (for trend)
    thirty_days_ago = date.today() - timedelta(days=30)
    recent_tickets = db.query(
        func.date(Ticket.creation_date).label('date'),
        func.count(Ticket.id).label('count')
    ).filter(
        Ticket.creation_date >= thirty_days_ago,
        Ticket.delete_date.is_(None)
    ).group_by(func.date(Ticket.creation_date)).order_by(
        func.date(Ticket.creation_date)
    ).all()
    
    # Format recent tickets for chart
    tickets_trend = [
        {"date": str(t[0]), "count": t[1]}
        for t in recent_tickets
    ]
    
    # Open tickets (not solved, closed, or deleted)
    open_statuses = db.query(Status).filter(
        ~Status.value.in_(['solved', 'closed', 'deleted', 'discarted'])
    ).all()
    open_status_ids = [s.id for s in open_statuses]
    open_tickets = db.query(Ticket).filter(
        Ticket.status_id.in_(open_status_ids),
        Ticket.delete_date.is_(None)
    ).count()
    
    # Tickets by tool
    tickets_by_tool = db.query(
        Tool.desc,
        func.count(Ticket.id).label('count')
    ).join(
        Ticket, Ticket.tool_id == Tool.id
    ).filter(
        Ticket.delete_date.is_(None)
    ).group_by(Tool.id, Tool.desc).order_by(
        func.count(Ticket.id).desc()
    ).limit(10).all()
    tool_distribution = {t[0]: t[1] for t in tickets_by_tool}
    
    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "tickets_by_type": type_distribution,
        "tickets_by_criticality": crit_distribution,
        "tickets_by_status": status_distribution,
        "tickets_by_center": center_distribution,
        "tickets_by_tool": tool_distribution,
        "active_users": active_users,
        "total_users": total_users,
        "tickets_trend": tickets_trend
    }

# File migration endpoint
@app.post("/migrate-files")
async def migrate_files_to_new_structure(
    current_user: User = Depends(get_current_complete_user),
    db: Session = Depends(get_db)
):
    """Migrate existing files from old structure to new ticket-based structure"""
    check_permission(current_user, 1)  # Only level 1 can migrate files
    
    try:
        migrate_existing_files_to_new_structure(db)
        return {"message": "File migration completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

def cleanup_empty_directories(ticket_id: str, file_path: str):
    """Clean up empty directories after file deletion"""
    try:
        # Parse the path: tickets/{ticket_id}/attachments/{year}/{month}/{filename}
        path_parts = file_path.split('/')
        if len(path_parts) >= 5:  # tickets, ticket_id, attachments, year, month, filename
            # Start from the month directory and work backwards
            current_dir = os.path.join(UPLOADS_DIR, *path_parts[:-1])  # Exclude filename
            
            while current_dir != os.path.join(UPLOADS_DIR, "tickets", ticket_id):
                if os.path.exists(current_dir) and os.path.isdir(current_dir):
                    try:
                        # Check if directory is empty
                        if not os.listdir(current_dir):
                            os.rmdir(current_dir)
                            print(f"DEBUG: Removed empty directory: {current_dir}")
                        else:
                            break  # Directory not empty, stop cleanup
                    except OSError:
                        break  # Can't remove directory, stop cleanup
                
                # Move up one level
                current_dir = os.path.dirname(current_dir)
                
                # Safety check to prevent going above tickets directory
                if not current_dir.startswith(os.path.join(UPLOADS_DIR, "tickets")):
                    break
    except Exception as e:
        print(f"DEBUG: Error in cleanup_empty_directories: {e}")

def migrate_existing_files_to_new_structure(db: Session):
    """Migrate existing files from old structure to new ticket-based structure"""
    try:
        print("🔄 Starting file migration to new structure...")
        
        # Get all tickets with attachments
        tickets = db.query(Ticket).filter(Ticket.attached.isnot(None)).all()
        
        for ticket in tickets:
            if not ticket.attached:
                continue
                
            print(f"🔄 Processing ticket {ticket.id} with {len(ticket.attached)} attachments")
            
            updated_attachments = []
            for attachment in ticket.attached:
                old_path = attachment.get("path", "")
                
                # Skip if already in new structure
                if old_path.startswith("tickets/"):
                    updated_attachments.append(attachment)
                    continue
                
                # Parse old path (format: YYYY/MM/filename)
                if "/" in old_path and len(old_path.split("/")) == 2:
                    year_month, filename = old_path.split("/", 1)
                    
                    # Create new path structure
                    new_path = f"tickets/{ticket.id}/attachments/{year_month}/{filename}"
                    
                    # Create new directory structure
                    new_dir = os.path.join(UPLOADS_DIR, "tickets", ticket.id, "attachments", year_month)
                    os.makedirs(new_dir, exist_ok=True)
                    
                    # Move file if it exists
                    old_file_path = os.path.join(UPLOADS_DIR, old_path)
                    new_file_path = os.path.join(UPLOADS_DIR, new_path)
                    
                    if os.path.exists(old_file_path):
                        try:
                            shutil.move(old_file_path, new_file_path)
                            print(f"✅ Moved file: {old_path} -> {new_path}")
                            
                            # Update attachment record
                            attachment["path"] = new_path
                            updated_attachments.append(attachment)
                        except Exception as e:
                            print(f"❌ Error moving file {old_path}: {e}")
                            # Keep old attachment if move fails
                            updated_attachments.append(attachment)
                    else:
                        print(f"⚠️ File not found: {old_file_path}")
                        # Keep old attachment if file doesn't exist
                        updated_attachments.append(attachment)
                else:
                    # Invalid path format, keep as is
                    updated_attachments.append(attachment)
            
            # Update ticket with new attachment paths
            if updated_attachments != ticket.attached:
                ticket.attached = updated_attachments
                flag_modified(ticket, "attached")
                print(f"✅ Updated ticket {ticket.id} attachments")
        
        # Commit all changes
        db.commit()
        print("✅ File migration completed successfully")
        
    except Exception as e:
        print(f"❌ Error during file migration: {e}")
        db.rollback()
        raise

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 