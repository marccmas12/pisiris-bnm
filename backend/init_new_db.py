import os
import sqlite3
from database import engine, Base, SessionLocal
from sqlalchemy import text
import json

def clean_database():
    """Remove the existing database file and recreate it"""
    db_path = os.path.join(os.path.dirname(__file__), 'ticket_manager.db')
    if os.path.exists(db_path):
        os.remove(db_path)
        print("Existing database removed.")

def create_tables():
    """Create all tables with the new schema"""
    Base.metadata.create_all(bind=engine)
    print("New database schema created.")

def insert_initial_data():
    """Insert initial configuration data"""
    db = SessionLocal()
    try:
        # Insert statuses (load from config file to ensure consistency)
        from config_manager import config_manager
        try:
            statuses = config_manager.get_statuses()
            for status in statuses:
                db.execute(text("INSERT INTO status (value, desc) VALUES (:value, :desc)"), status)
        except Exception as e:
            print(f"Warning: Could not load statuses from config, using fallback: {e}")
            # Fallback to hardcoded list if config fails
            statuses = [
                {"value": "created", "desc": "Creada"},
                {"value": "reviewed", "desc": "Revisada"},
                {"value": "discarted", "desc": "Descartada"},
                {"value": "resolving", "desc": "En resolució"},
                {"value": "notified", "desc": "Notificada"},
                {"value": "solved", "desc": "Resolta"},
                {"value": "closed", "desc": "Tancada"},
                {"value": "deleted", "desc": "Eliminada"},
                {"value": "on_hold", "desc": "Aturada"},
                {"value": "reopened", "desc": "Reoberta"}
            ]
            for status in statuses:
                db.execute(text("INSERT INTO status (value, desc) VALUES (:value, :desc)"), status)
        
        # Insert crits
        crits = [
            {"value": "low", "desc": "Baixa"},
            {"value": "mid", "desc": "Mitja"},
            {"value": "high", "desc": "Alta"},
            {"value": "critical", "desc": "Crítica"}
        ]
        
        for crit in crits:
            db.execute(text("INSERT INTO crit (value, desc) VALUES (:value, :desc)"), crit)
        
        # Insert centers (using the existing centers.json)
        centers_path = os.path.join(os.path.dirname(__file__), 'config', 'centers.json')
        with open(centers_path, 'r', encoding='utf-8') as f:
            centers_data = json.load(f)
        
        for center in centers_data:
            db.execute(text("INSERT INTO center (value, desc) VALUES (:value, :desc)"), center)
        
        # Insert tools (using the existing tools.json)
        tools_path = os.path.join(os.path.dirname(__file__), 'config', 'tools.json')
        with open(tools_path, 'r', encoding='utf-8') as f:
            tools_data = json.load(f)
        
        for tool in tools_data:
            db.execute(text("INSERT INTO tool (value, desc) VALUES (:value, :desc)"), tool)
        
        # Insert a default admin user
        from auth import get_password_hash
        admin_user = {
            "username": "admin",
            "email": "admin@example.com",
            "hashed_password": get_password_hash("admin123"),
            "name": "Administrador",
            "surnames": "Sistema",
            "permission_level": 1,
            "is_active": True,
            "must_complete_profile": False,
            "must_change_password": False
        }
        
        db.execute(text("""
            INSERT INTO users (username, email, hashed_password, name, surnames, permission_level, is_active, must_complete_profile, must_change_password)
            VALUES (:username, :email, :hashed_password, :name, :surnames, :permission_level, :is_active, :must_complete_profile, :must_change_password)
        """), admin_user)
        
        db.commit()
        print("Initial data inserted successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Error inserting initial data: {e}")
        raise
    finally:
        db.close()

def main():
    """Main function to initialize the new database"""
    print("Starting new database initialization...")
    
    try:
        clean_database()
        create_tables()
        insert_initial_data()
        print("Database initialization completed successfully!")
        
    except Exception as e:
        print(f"Error during database initialization: {e}")
        raise

if __name__ == "__main__":
    main() 