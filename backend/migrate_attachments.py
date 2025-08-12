#!/usr/bin/env python3
"""
Migration script to update existing attachment data to match the new FileAttachment model structure.
This script converts old attachment format to the new enhanced format.
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, Ticket
from sqlalchemy.orm import Session

def migrate_attachments():
    """Migrate existing attachments to new format"""
    print("Starting attachment migration...")
    
    db = next(get_db())
    
    try:
        # Get all tickets with attachments
        tickets = db.query(Ticket).filter(Ticket.attached.isnot(None)).all()
        
        migrated_count = 0
        
        for ticket in tickets:
            if not ticket.attached:
                continue
                
            print(f"Processing ticket {ticket.id}...")
            
            # Check if attachments need migration
            needs_migration = False
            new_attachments = []
            
            for attachment in ticket.attached:
                # Check if this is the old format (missing required fields)
                if isinstance(attachment, dict):
                    required_fields = ["filename", "path", "size", "uploaded_by", "uploaded_at"]
                    missing_fields = [field for field in required_fields if field not in attachment]
                    
                    if missing_fields or "original_name" not in attachment:
                        needs_migration = True
                        print(f"  Migrating attachment: {attachment.get('filename', 'unknown')}")
                        
                        # Fill in missing fields with defaults
                        new_attachment = attachment.copy()
                        new_attachment.update({
                            "original_name": attachment.get("filename", ""),
                            "hash": attachment.get("hash", ""),
                            "file_type": attachment.get("file_type", os.path.splitext(attachment.get("filename", ""))[1]),
                            "content_type": attachment.get("content_type", "application/octet-stream"),
                            "ticket_id": ticket.id
                        })
                        new_attachments.append(new_attachment)
                    else:
                        # Already in new format, just ensure all fields are present
                        new_attachment = attachment.copy()
                        new_attachment.update({
                            "original_name": attachment.get("original_name", attachment.get("filename", "")),
                            "hash": attachment.get("hash", ""),
                            "file_type": attachment.get("file_type", os.path.splitext(attachment.get("filename", ""))[1]),
                            "content_type": attachment.get("content_type", "application/octet-stream"),
                            "ticket_id": ticket.id
                        })
                        new_attachments.append(new_attachment)
                elif isinstance(attachment, str):
                    needs_migration = True
                    print(f"  Converting string attachment: {attachment}")
                    # Convert old string format to new object format
                    new_attachment = {
                        "filename": attachment,
                        "original_name": attachment,
                        "path": attachment,
                        "size": 0,  # We can't determine size from old data
                        "hash": "",  # We can't determine hash from old data
                        "uploaded_by": "admin",  # Default value
                        "uploaded_at": datetime.now().isoformat(),
                        "file_type": os.path.splitext(attachment)[1] if attachment else "",
                        "content_type": "application/octet-stream",
                        "ticket_id": ticket.id
                    }
                    new_attachments.append(new_attachment)
                else:
                    # Unknown format, skip
                    print(f"  Skipping unknown attachment format: {type(attachment)}")
                    continue
            
            if needs_migration:
                print(f"  Migrating {len(new_attachments)} attachments...")
                ticket.attached = new_attachments
                migrated_count += 1
            else:
                # Ensure all fields are present even if migration not needed
                ticket.attached = new_attachments
        
        if migrated_count > 0:
            db.commit()
            print(f"Migration completed! {migrated_count} tickets updated.")
        else:
            db.commit()
            print("All attachments updated to ensure consistency.")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_attachments() 