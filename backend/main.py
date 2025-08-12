from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from datetime import timedelta, datetime
import uuid
import os
import shutil

from database import get_db, create_tables, User, Ticket, Modification, Status, Crit, Center, Tool
from models import (
    UserCreate, User as UserModel, TicketCreate, Ticket as TicketModel, 
    TicketUpdate, TicketWithRelations, ModificationCreate, Modification as ModificationModel,
    Token, Status as StatusModel, Crit as CritModel, Center as CenterModel, Tool as ToolModel,
    TicketListResponse, ModificationListResponse, GroupedModificationListResponse, UserUpdate
)
from auth import (
    authenticate_user, create_access_token, get_current_active_user, 
    get_password_hash, check_permission, ACCESS_TOKEN_EXPIRE_MINUTES
)
from ticket_id_generator import generate_ticket_id

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
    current_user: User = Depends(get_current_active_user),
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
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        permission_level=user.permission_level
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/", response_model=List[UserModel])
async def get_users(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)
    users = db.query(User).all()
    return users

@app.put("/users/me", response_model=UserModel)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Update only the fields that are provided
    update_data = user_update.dict(exclude_unset=True)
    
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

@app.put("/users/{user_id}", response_model=UserModel)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 can update other users
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update only the fields that are provided
    update_data = user_update.dict(exclude_unset=True)
    
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

# File upload endpoints
@app.post("/tickets/{ticket_id}/upload")
async def upload_files(
    ticket_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about all attachments for a ticket"""
    check_permission(current_user, 1)  # Level 1+ can view attachments
    
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

@app.delete("/tickets/{ticket_id}/attachments/{filename:path}")
async def delete_attachment(
    ticket_id: str,
    filename: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a file attachment from a ticket"""
    print(f"DEBUG: Delete attachment called by user {current_user.username} with permission level {current_user.permission_level}")
    check_permission(current_user, 1)  # Only level 1 can delete files
    
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 2)  # Level 2+ can create tickets
    
    # Generate unique hex-based ticket ID
    ticket_id = generate_ticket_id(ticket.type, db)
    
    # Handle optional center_id
    ticket_data = ticket.dict()
    if ticket_data.get('center_id') == 0:
        ticket_data['center_id'] = None
    
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    
    if status_id:
        query = query.filter(Ticket.status_id == status_id)
    if type:
        query = query.filter(Ticket.type == type)
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
    
    # Apply sorting
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
            if sort_order == 'desc':
                query = query.join(Status).order_by(Status.id.desc())
            else:
                query = query.join(Status).order_by(Status.id.asc())
        elif sort_by == 'priority':
            if sort_order == 'desc':
                query = query.join(Crit).order_by(Crit.id.desc())
            else:
                query = query.join(Crit).order_by(Crit.id.asc())
    
    total = query.count()
    tickets = query.offset(skip).limit(limit).all()
    
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
            "notifier": ticket.notifier,
            "people": ticket.people,
            "creator": ticket.creator,
            "pathway": ticket.pathway,
            "supports": ticket.supports,
            "attached": ticket.attached,
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
    
    return TicketListResponse(
        tickets=ticket_dicts,
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@app.get("/tickets/{ticket_id}", response_model=TicketWithRelations)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
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
        "notifier": ticket.notifier,
        "people": ticket.people,
        "creator": ticket.creator,
        "pathway": ticket.pathway,
        "supports": ticket.supports,
        "attached": ticket.attached,
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
    return ticket_dict

@app.put("/tickets/{ticket_id}", response_model=TicketModel)
async def update_ticket(
    ticket_id: str,
    ticket_update: TicketUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 can modify tickets
    
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
    
    # Auto-set resolution date if status changes to solved
    if 'status_id' in update_data and update_data['status_id'] != db_ticket.status_id:
        new_status = db.query(Status).filter(Status.id == update_data['status_id']).first()
        if new_status and new_status.value == 'solved':
            update_data['resolution_date'] = datetime.now().date()
        elif new_status and new_status.value == 'deleted':
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    check_permission(current_user, 1)  # Only level 1 can delete tickets
    
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
        {"value": "deleted", "desc": "Eliminada"}
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

# File migration endpoint
@app.post("/migrate-files")
async def migrate_files_to_new_structure(
    current_user: User = Depends(get_current_active_user),
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