#!/usr/bin/env python3
"""
Migration script to update notifier field from String to Integer (user ID FK)
and make people field nullable.
"""

import os
import sys
import sqlite3

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import DATABASE_URL, engine, SessionLocal
from sqlalchemy import text

def migrate_notifier_and_people():
    """Migrate notifier from String to Integer FK and make people nullable"""
    print("Starting notifier and people migration...")
    
    # Get database path from SQLite URL
    db_path = DATABASE_URL.replace("sqlite:///", "")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(tickets)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        
        print(f"Current notifier column type: {columns.get('notifier', 'NOT FOUND')}")
        print(f"Current people column nullable: {columns.get('people', 'NOT FOUND')}")
        
        # Step 1: Create new table with updated schema
        print("\nStep 1: Creating new table with updated schema...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets_new (
                id TEXT NOT NULL PRIMARY KEY,
                ticket_num TEXT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                url TEXT,
                status_id INTEGER NOT NULL,
                crit_id INTEGER NOT NULL,
                creation_date DATE NOT NULL,
                modify_date DATETIME,
                resolution_date DATE,
                delete_date DATE,
                modify_reason TEXT,
                notifier INTEGER,
                people TEXT,
                creator INTEGER NOT NULL,
                center_id INTEGER,
                tool_id INTEGER NOT NULL,
                pathway TEXT NOT NULL,
                supports INTEGER NOT NULL,
                attached TEXT,
                FOREIGN KEY(status_id) REFERENCES status(id),
                FOREIGN KEY(crit_id) REFERENCES crit(id),
                FOREIGN KEY(creator) REFERENCES users(id),
                FOREIGN KEY(center_id) REFERENCES center(id),
                FOREIGN KEY(tool_id) REFERENCES tool(id),
                FOREIGN KEY(notifier) REFERENCES users(id)
            )
        """)
        
        # Step 2: Copy data from old table to new table
        print("Step 2: Copying data from old table...")
        cursor.execute("""
            INSERT INTO tickets_new (
                id, ticket_num, type, title, description, url,
                status_id, crit_id, creation_date, modify_date,
                resolution_date, delete_date, modify_reason,
                notifier, people, creator, center_id, tool_id,
                pathway, supports, attached
            )
            SELECT 
                id, ticket_num, type, title, description, url,
                status_id, crit_id, creation_date, modify_date,
                resolution_date, delete_date, modify_reason,
                NULL as notifier,  -- Convert string notifier to NULL (can't map to user ID)
                people, creator, center_id, tool_id,
                pathway, supports, attached
            FROM tickets
        """)
        
        # Step 3: Drop old table
        print("Step 3: Dropping old table...")
        cursor.execute("DROP TABLE tickets")
        
        # Step 4: Rename new table
        print("Step 4: Renaming new table...")
        cursor.execute("ALTER TABLE tickets_new RENAME TO tickets")
        
        # Step 5: Recreate indexes
        print("Step 5: Recreating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_id ON tickets(id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_creator ON tickets(creator)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_status_id ON tickets(status_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_crit_id ON tickets(crit_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_center_id ON tickets(center_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_tool_id ON tickets(tool_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tickets_notifier ON tickets(notifier)")
        
        conn.commit()
        print("\nMigration completed successfully!")
        print("- notifier column changed from String to Integer (FK to users.id)")
        print("- people column is now nullable")
        print("- All existing string notifier values set to NULL")
        
    except Exception as e:
        print(f"\nError during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_notifier_and_people()

