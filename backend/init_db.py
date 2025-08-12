#!/usr/bin/env python3
"""
Database initialization script for Ticket Manager
Creates tables, reference data, and admin user
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import create_tables, SessionLocal, User, Status, Crit, Center, Tool
from auth import get_password_hash
from config_manager import config_manager

def init_database():
    """Initialize database with tables and sample data"""
    print("Creating database tables...")
    create_tables()
    
    db = SessionLocal()
    try:
        # Initialize reference data from configuration files
        print("Loading reference data from configuration files...")
        
        # Load and initialize statuses
        try:
            statuses = config_manager.get_statuses()
            for status_data in statuses:
                existing = db.query(Status).filter(Status.value == status_data["value"]).first()
                if not existing:
                    db_status = Status(**status_data)
                    db.add(db_status)
                    print(f"Added status: {status_data['desc']}")
        except Exception as e:
            print(f"Warning: Could not load statuses from config: {e}")
        
        # Load and initialize crits (Priority levels)
        try:
            crits = config_manager.get_crits()
            for crit_data in crits:
                existing = db.query(Crit).filter(Crit.value == crit_data["value"]).first()
                if not existing:
                    db_crit = Crit(**crit_data)
                    db.add(db_crit)
                    print(f"Added crit: {crit_data['desc']}")
        except Exception as e:
            print(f"Warning: Could not load crits from config: {e}")
        
        # Load and initialize centers
        try:
            centers = config_manager.get_centers()
            for center_data in centers:
                existing = db.query(Center).filter(Center.value == center_data["value"]).first()
                if not existing:
                    db_center = Center(**center_data)
                    db.add(db_center)
                    print(f"Added center: {center_data['desc']}")
        except Exception as e:
            print(f"Warning: Could not load centers from config: {e}")
        
        # Load and initialize tools
        try:
            tools = config_manager.get_tools()
            for tool_data in tools:
                existing = db.query(Tool).filter(Tool.value == tool_data["value"]).first()
                if not existing:
                    db_tool = Tool(**tool_data)
                    db.add(db_tool)
                    print(f"Added tool: {tool_data['desc']}")
        except Exception as e:
            print(f"Warning: Could not load tools from config: {e}")
        
        # Create admin user
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                permission_level=1,
                is_active=True
            )
            db.add(admin_user)
            print("Created admin user: admin/admin123")
        
        # Create sample users
        sample_users = [
            {
                "username": "manager",
                "email": "manager@example.com",
                "password": "manager123",
                "permission_level": 2
            },
            {
                "username": "viewer",
                "email": "viewer@example.com",
                "password": "viewer123",
                "permission_level": 3
            }
        ]
        
        for user_data in sample_users:
            existing = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing:
                user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    permission_level=user_data["permission_level"],
                    is_active=True
                )
                db.add(user)
                print(f"Created user: {user_data['username']}/{user_data['password']}")
        
        db.commit()
        print("\nDatabase initialization completed successfully!")
        print("\nSample users created:")
        print("- admin/admin123 (Level 1 - Full access)")
        print("- manager/manager123 (Level 2 - Create/View)")
        print("- viewer/viewer123 (Level 3 - View only)")
        
        # List available configuration files
        print("\nAvailable configuration files:")
        for config_file in config_manager.list_config_files():
            print(f"- {config_file}.json")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_database() 