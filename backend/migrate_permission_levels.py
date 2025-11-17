"""
Migration script to update permission levels:
- Level 2 (Manager) → Level 3
- Level 3 (Viewer) → Level 4

This creates space for the new Level 2 (Editor) permission level.
"""
from database import SessionLocal, User

def migrate_permission_levels():
    """Migrate existing users to new permission level structure"""
    db = SessionLocal()
    try:
        # Get all users
        users = db.query(User).all()
        
        print(f"Found {len(users)} users to migrate")
        
        migrated_count = 0
        for user in users:
            old_level = user.permission_level
            
            # Migrate level 2 → 3 (Manager)
            if user.permission_level == 2:
                user.permission_level = 3
                migrated_count += 1
                print(f"  User {user.username} (ID: {user.id}): Level {old_level} → 3 (Manager)")
            
            # Migrate level 3 → 4 (Viewer)
            elif user.permission_level == 3:
                user.permission_level = 4
                migrated_count += 1
                print(f"  User {user.username} (ID: {user.id}): Level {old_level} → 4 (Viewer)")
            
            # Level 1 (Admin) stays the same
            elif user.permission_level == 1:
                print(f"  User {user.username} (ID: {user.id}): Level {old_level} (Admin) - unchanged")
        
        db.commit()
        print(f"\n✅ Migration completed: {migrated_count} users migrated")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 Starting permission level migration...")
    print("  Level 2 (Manager) → Level 3")
    print("  Level 3 (Viewer) → Level 4\n")
    
    migrate_permission_levels()
    
    print("\n✅ Migration script completed successfully!")

