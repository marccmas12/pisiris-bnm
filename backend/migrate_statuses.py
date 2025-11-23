#!/usr/bin/env python3
"""
Migration script to add missing statuses to existing database
This script can be run during deployment to ensure all statuses from config are present
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, Status
from config_manager import config_manager

def migrate_statuses():
    """Add missing statuses from config file to database"""
    db = SessionLocal()
    try:
        print("🔄 Checking for missing statuses...")
        
        # Load statuses from config
        statuses = config_manager.get_statuses()
        
        added_count = 0
        for status_data in statuses:
            existing = db.query(Status).filter(Status.value == status_data["value"]).first()
            if not existing:
                db_status = Status(**status_data)
                db.add(db_status)
                print(f"✅ Added status: {status_data['desc']} ({status_data['value']})")
                added_count += 1
            else:
                print(f"✓ Status already exists: {status_data['desc']} ({status_data['value']})")
        
        if added_count > 0:
            db.commit()
            print(f"\n✅ Successfully added {added_count} new status(es) to the database!")
        else:
            print("\n✓ All statuses are already in the database.")
        
        return added_count
        
    except Exception as e:
        print(f"❌ Error migrating statuses: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_statuses()


