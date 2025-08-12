#!/usr/bin/env python3
"""
Migration script to add new user fields to the database.
This script adds name, surnames, and default_center_id columns to the users table.
"""

import sqlite3
import os

def migrate_user_fields():
    # Get the database path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, 'ticket_manager.db')
    
    if not os.path.exists(db_path):
        print("Database file not found. Please run the application first to create the database.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add name column if it doesn't exist
        if 'name' not in columns:
            print("Adding 'name' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
        
        # Add surnames column if it doesn't exist
        if 'surnames' not in columns:
            print("Adding 'surnames' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN surnames TEXT")
        
        # Add default_center_id column if it doesn't exist
        if 'default_center_id' not in columns:
            print("Adding 'default_center_id' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN default_center_id INTEGER REFERENCES center(id)")
        
        conn.commit()
        print("Migration completed successfully!")
        
        # Show the updated table structure
        cursor.execute("PRAGMA table_info(users)")
        print("\nUpdated users table structure:")
        for column in cursor.fetchall():
            print(f"  {column[1]} ({column[2]})")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_user_fields() 