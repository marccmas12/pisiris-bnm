#!/usr/bin/env python3
"""
Migration script to make center_id nullable in the tickets table.
"""

import sqlite3
import os

def migrate_center_nullable():
    # Get the database path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, 'ticket_manager.db')
    
    if not os.path.exists(db_path):
        print("Database file not found. Please run the application first to create the database.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if center_id column exists and is nullable
        cursor.execute("PRAGMA table_info(tickets)")
        columns = cursor.fetchall()
        center_column = None
        
        for column in columns:
            if column[1] == 'center_id':
                center_column = column
                break
        
        if center_column:
            print(f"Current center_id column: {center_column}")
            if center_column[3] == 0:  # NOT NULL
                print("Making center_id nullable...")
                # SQLite doesn't support ALTER COLUMN to change nullability
                # We need to recreate the table
                print("Note: This migration requires recreating the tickets table.")
                print("Please backup your data before proceeding.")
                return
            else:
                print("center_id is already nullable.")
        else:
            print("center_id column not found in tickets table.")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_center_nullable() 