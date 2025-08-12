#!/usr/bin/env python3
"""
File Migration Script
Migrates existing files from old structure to new ticket-based structure
"""

import os
import shutil
import sqlite3
import json
from datetime import datetime

# Configuration
UPLOADS_DIR = "uploads"
TICKETS_UPLOADS_DIR = os.path.join(UPLOADS_DIR, "tickets")
DATABASE_PATH = "ticket_manager.db"

def get_db_connection():
    """Get database connection"""
    return sqlite3.connect(DATABASE_PATH)

def migrate_existing_files_to_new_structure():
    """Migrate existing files from old structure to new ticket-based structure"""
    try:
        print("🔄 Starting file migration to new structure...")
        
        # Create tickets upload directory if it doesn't exist
        if not os.path.exists(TICKETS_UPLOADS_DIR):
            os.makedirs(TICKETS_UPLOADS_DIR)
            print(f"✅ Created directory: {TICKETS_UPLOADS_DIR}")
        
        # Get database connection
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get all tickets with attachments
        cursor.execute("SELECT id, attached FROM tickets WHERE attached IS NOT NULL AND attached != '[]'")
        tickets = cursor.fetchall()
        
        print(f"📋 Found {len(tickets)} tickets with attachments")
        
        total_files_moved = 0
        total_files_skipped = 0
        total_files_failed = 0
        
        for ticket_id, attached_json in tickets:
            try:
                # Parse JSON attachments
                attachments = json.loads(attached_json)
                
                if not attachments:
                    continue
                    
                print(f"\n🔄 Processing ticket {ticket_id} with {len(attachments)} attachments")
                
                updated_attachments = []
                for i, attachment in enumerate(attachments):
                    old_path = attachment.get("path", "")
                    print(f"  📁 Processing attachment {i+1}/{len(attachments)}: {old_path}")
                    
                    # Skip if already in new structure
                    if old_path.startswith("tickets/"):
                        print(f"    ✅ Already in new structure, skipping")
                        updated_attachments.append(attachment)
                        continue
                    
                    # Parse old path (format: YYYY/MM/filename)
                    path_parts = old_path.split("/")
                    if len(path_parts) == 2:
                        year_month, filename = path_parts
                        print(f"    📅 Parsed: year_month={year_month}, filename={filename}")
                        
                        # Create new path structure
                        new_path = f"tickets/{ticket_id}/attachments/{year_month}/{filename}"
                        print(f"    🆕 New path: {new_path}")
                        
                        # Create new directory structure
                        new_dir = os.path.join(UPLOADS_DIR, "tickets", ticket_id, "attachments", year_month)
                        os.makedirs(new_dir, exist_ok=True)
                        print(f"    📂 Created directory: {new_dir}")
                        
                        # Move file if it exists
                        old_file_path = os.path.join(UPLOADS_DIR, old_path)
                        new_file_path = os.path.join(UPLOADS_DIR, new_path)
                        
                        print(f"    🔍 Old file path: {old_file_path}")
                        print(f"    🔍 New file path: {new_file_path}")
                        print(f"    🔍 Old file exists: {os.path.exists(old_file_path)}")
                        
                        if os.path.exists(old_file_path):
                            try:
                                # Check if new file already exists
                                if os.path.exists(new_file_path):
                                    print(f"    ⚠️ New file already exists, removing old one")
                                    os.remove(old_file_path)
                                else:
                                    # Move the file
                                    shutil.move(old_file_path, new_file_path)
                                    print(f"    ✅ Moved file: {old_path} -> {new_path}")
                                    total_files_moved += 1
                                
                                # Update attachment record
                                attachment["path"] = new_path
                                updated_attachments.append(attachment)
                                
                            except Exception as e:
                                print(f"    ❌ Error moving file {old_path}: {e}")
                                # Keep old attachment if move fails
                                updated_attachments.append(attachment)
                                total_files_failed += 1
                        else:
                            print(f"    ⚠️ File not found: {old_file_path}")
                            # Keep old attachment if file doesn't exist
                            updated_attachments.append(attachment)
                            total_files_skipped += 1
                    else:
                        print(f"    ⚠️ Invalid path format (expected YYYY/MM/filename): {old_path}")
                        # Invalid path format, keep as is
                        updated_attachments.append(attachment)
                        total_files_skipped += 1
                
                # Update ticket with new attachment paths
                if updated_attachments != attachments:
                    new_attached_json = json.dumps(updated_attachments)
                    cursor.execute(
                        "UPDATE tickets SET attached = ? WHERE id = ?",
                        (new_attached_json, ticket_id)
                    )
                    print(f"  ✅ Updated ticket {ticket_id} attachments in database")
                else:
                    print(f"  ℹ️ No changes needed for ticket {ticket_id}")
                
            except Exception as e:
                print(f"❌ Error processing ticket {ticket_id}: {e}")
                continue
        
        # Commit all changes
        conn.commit()
        print(f"\n✅ File migration completed successfully!")
        print(f"📊 Summary:")
        print(f"   • Files moved: {total_files_moved}")
        print(f"   • Files skipped: {total_files_skipped}")
        print(f"   • Files failed: {total_files_failed}")
        
        # Close connection
        conn.close()
        
        return total_files_moved, total_files_skipped, total_files_failed
        
    except Exception as e:
        print(f"❌ Error during file migration: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        raise

def cleanup_old_directories():
    """Clean up old empty directories"""
    try:
        print("\n🧹 Cleaning up old empty directories...")
        
        directories_removed = 0
        
        # Look for old YYYY/MM directories
        if os.path.exists(UPLOADS_DIR):
            for item in os.listdir(UPLOADS_DIR):
                item_path = os.path.join(UPLOADS_DIR, item)
                
                # Skip tickets directory and non-directories
                if item == "tickets" or not os.path.isdir(item_path):
                    continue
                
                # Check if it's a year directory (4 digits)
                if len(item) == 4 and item.isdigit():
                    year_path = item_path
                    print(f"🔄 Checking year directory: {item}")
                    
                    for month_item in os.listdir(year_path):
                        month_path = os.path.join(year_path, month_item)
                        
                        # Check if it's a month directory (1-2 digits)
                        if month_item.isdigit() and 1 <= int(month_item) <= 12:
                            print(f"🔄 Checking month directory: {item}/{month_item}")
                            
                            # If directory is empty, remove it
                            if os.path.exists(month_path) and os.path.isdir(month_path):
                                try:
                                    if not os.listdir(month_path):
                                        os.rmdir(month_path)
                                        print(f"✅ Removed empty month directory: {item}/{month_item}")
                                        directories_removed += 1
                                    else:
                                        print(f"⚠️ Month directory not empty: {item}/{month_item}")
                                except OSError as e:
                                    print(f"⚠️ Could not remove month directory {item}/{month_item}: {e}")
                    
                    # Check if year directory is now empty
                    try:
                        if not os.listdir(year_path):
                            os.rmdir(year_path)
                            print(f"✅ Removed empty year directory: {item}")
                            directories_removed += 1
                    except OSError as e:
                        print(f"⚠️ Could not remove year directory {item}: {e}")
        
        print(f"✅ Directory cleanup completed. Removed {directories_removed} empty directories.")
        return directories_removed
        
    except Exception as e:
        print(f"❌ Error during directory cleanup: {e}")
        return 0

def verify_migration():
    """Verify that files were moved correctly"""
    try:
        print("\n🔍 Verifying migration...")
        
        if not os.path.exists(TICKETS_UPLOADS_DIR):
            print("❌ Tickets upload directory not found!")
            return False
        
        # Check each ticket directory
        ticket_dirs = os.listdir(TICKETS_UPLOADS_DIR)
        print(f"📁 Found {len(ticket_dirs)} ticket directories")
        
        total_files = 0
        for ticket_dir in ticket_dirs:
            ticket_path = os.path.join(TICKETS_UPLOADS_DIR, ticket_dir)
            if os.path.isdir(ticket_path):
                attachments_dir = os.path.join(ticket_path, "attachments")
                if os.path.exists(attachments_dir):
                    # Count files recursively
                    for root, dirs, files in os.walk(attachments_dir):
                        total_files += len(files)
                        if files:
                            print(f"  📂 {ticket_dir}: {len(files)} files in {root}")
        
        print(f"✅ Migration verification complete. Total files found: {total_files}")
        return total_files > 0
        
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting file migration process...")
    print(f"📁 Source directory: {UPLOADS_DIR}")
    print(f"📁 Target directory: {TICKETS_UPLOADS_DIR}")
    print(f"🗄️ Database: {DATABASE_PATH}")
    print()
    
    try:
        # Check if source directory exists
        if not os.path.exists(UPLOADS_DIR):
            print(f"❌ Source directory {UPLOADS_DIR} does not exist!")
            exit(1)
        
        # Check if database exists
        if not os.path.exists(DATABASE_PATH):
            print(f"❌ Database {DATABASE_PATH} does not exist!")
            exit(1)
        
        # Run migration
        files_moved, files_skipped, files_failed = migrate_existing_files_to_new_structure()
        print()
        
        # Clean up old directories
        dirs_removed = cleanup_old_directories()
        print()
        
        # Verify migration
        migration_success = verify_migration()
        print()
        
        if migration_success:
            print("🎉 Migration process completed successfully!")
            print()
            print("📋 Summary:")
            print(f"   • Files moved: {files_moved}")
            print(f"   • Files skipped: {files_skipped}")
            print(f"   • Files failed: {files_failed}")
            print(f"   • Directories cleaned up: {dirs_removed}")
            print(f"   • New structure: {TICKETS_UPLOADS_DIR}")
            print()
            print("💡 Next steps:")
            print("   • Restart the backend server")
            print("   • Test file uploads and deletions")
            print("   • Verify file paths in the database")
        else:
            print("⚠️ Migration completed but verification failed!")
            print("Please check the logs above for issues.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        exit(1) 