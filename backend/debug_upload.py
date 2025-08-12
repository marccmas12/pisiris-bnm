#!/usr/bin/env python3
"""
Debug script to test file upload logic and identify issues.
"""

import os
import sys
import json
from datetime import datetime

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, Ticket
from sqlalchemy.orm import Session

def debug_upload():
    """Debug the file upload process"""
    print("Debugging file upload process...")
    
    db = next(get_db())
    
    try:
        # Get the ticket
        ticket = db.query(Ticket).filter(Ticket.id == "INCF9E6FE").first()
        if not ticket:
            print("Ticket not found")
            return
        
        print(f"Ticket {ticket.id} found")
        print(f"Current attachments: {len(ticket.attached) if ticket.attached else 0}")
        
        if ticket.attached:
            print("Current attachment data:")
            for i, att in enumerate(ticket.attached):
                print(f"  {i+1}: {att}")
        
        # Simulate adding a new attachment
        new_attachment = {
            "filename": "debug_test.txt",
            "original_name": "debug_test.txt",
            "path": "debug/test.txt",
            "size": 100,
            "hash": "debug_hash",
            "uploaded_by": "admin",
            "uploaded_at": datetime.now().isoformat(),
            "file_type": ".txt",
            "content_type": "text/plain",
            "ticket_id": "INCF9E6FE"
        }
        
        print(f"\nAdding new attachment: {new_attachment}")
        
        # Get current attachments
        current_attachments = ticket.attached or []
        print(f"Current attachments array: {current_attachments}")
        print(f"Type: {type(current_attachments)}")
        
        # Add new attachment
        current_attachments.append(new_attachment)
        print(f"After adding: {len(current_attachments)} attachments")
        
        # Update ticket
        ticket.attached = current_attachments
        print("Updated ticket.attached")
        
        # Commit to database
        db.commit()
        print("Committed to database")
        
        # Refresh and check
        db.refresh(ticket)
        print(f"After refresh: {len(ticket.attached)} attachments")
        
        if ticket.attached:
            for i, att in enumerate(ticket.attached):
                print(f"  {i+1}: {att}")
        
    except Exception as e:
        print(f"Error during debug: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    debug_upload() 