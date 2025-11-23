#!/usr/bin/env python3
"""
Migration script to add new user profile fields to the database.

This script adds:
- phone (String, nullable)
- worktime (Text, nullable)
- role (String, nullable)
- must_complete_profile (Boolean, default=True)
- must_change_password (Boolean, default=True)

For existing users:
- must_complete_profile = True (they need to complete profile on next login)
- must_change_password = False (they already have their password)

For new users (created after this migration):
- Both flags will be True (handled in create_user endpoint)
"""

import sys
import os

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from database import DATABASE_URL

def migrate():
    """Run the migration to add new user profile fields"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    print("🔄 Starting migration: Adding user profile fields...")
    
    with engine.connect() as conn:
        try:
            # Add phone column
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR"))
                print("✅ Added column: phone")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("⚠️  Column 'phone' already exists, skipping...")
                else:
                    raise
            
            # Add worktime column
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN worktime TEXT"))
                print("✅ Added column: worktime")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("⚠️  Column 'worktime' already exists, skipping...")
                else:
                    raise
            
            # Add role column
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR"))
                print("✅ Added column: role")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("⚠️  Column 'role' already exists, skipping...")
                else:
                    raise
            
            # Add must_complete_profile column
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN must_complete_profile BOOLEAN DEFAULT 1"))
                print("✅ Added column: must_complete_profile")
                # Set existing users to need profile completion
                conn.execute(text("UPDATE users SET must_complete_profile = 1 WHERE must_complete_profile IS NULL"))
                print("✅ Set must_complete_profile=True for existing users")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("⚠️  Column 'must_complete_profile' already exists, skipping...")
                else:
                    raise
            
            # Add must_change_password column
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0"))
                print("✅ Added column: must_change_password")
                # Set existing users to NOT need password change (they already have their password)
                conn.execute(text("UPDATE users SET must_change_password = 0 WHERE must_change_password IS NULL"))
                print("✅ Set must_change_password=False for existing users")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("⚠️  Column 'must_change_password' already exists, skipping...")
                else:
                    raise
            
            conn.commit()
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Migration failed: {e}")
            raise

if __name__ == "__main__":
    migrate()


