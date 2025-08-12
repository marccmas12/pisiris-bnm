#!/usr/bin/env python3
"""
Script to check the current attachment data structure in the database.
"""

import os
import sys
import json

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, Ticket

def check_attachments():
    """Check the current attachment data structure"""
    print("Checking attachment data structure...")
    
    db = next(get_db())
    
    try:
        # Get all tickets with attachments
        tickets = db.query(Ticket).filter(Ticket.attached.isnot(None)).all()
        
        for ticket in tickets:
            print(f"\nTicket {ticket.id}:")
            print(f"  Attachments: {len(ticket.attached) if ticket.attached else 0}")
            
            if ticket.attached:
                for i, attachment in enumerate(ticket.attached):
                    print(f"    Attachment {i+1}:")
                    print(f"      Type: {type(attachment)}")
                    print(f"      Content: {attachment}")
                    
                    if isinstance(attachment, dict):
                        print(f"      Keys: {list(attachment.keys())}")
                        
                        # Check for required fields
                        required_fields = ["filename", "path", "size", "uploaded_by", "uploaded_at"]
                        missing_fields = [field for field in required_fields if field not in attachment]
                        if missing_fields:
                            print(f"      Missing fields: {missing_fields}")
                        
                        # Show file path info
                        if "path" in attachment:
                            print(f"      File path: {attachment['path']}")
                            full_path = os.path.join("uploads", attachment["path"])
                            if os.path.exists(full_path):
                                print(f"      File exists: YES")
                                stat_info = os.stat(full_path)
                                print(f"      File size: {stat_info.st_size} bytes")
                            else:
                                print(f"      File exists: NO")
                    
                    print()
                    
    except Exception as e:
        print(f"Error checking attachments: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    check_attachments() 