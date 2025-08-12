#!/usr/bin/env python3
"""
Quick Configuration Helper for Ticket Manager
Provides easy commands for common configuration tasks
"""

import sys
import os
import json
from pathlib import Path

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config_manager import config_manager

def add_center(value: str, desc: str):
    """Add a new center to the configuration"""
    config_file = Path("config/centers.json")
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            centers = json.load(f)
        
        # Check if center already exists
        for center in centers:
            if center["value"] == value:
                print(f"❌ Center with value '{value}' already exists")
                return
        
        # Add new center
        new_center = {"value": value, "desc": desc}
        centers.append(new_center)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(centers, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Added center: {desc} ({value})")
        print("💡 Run 'python init_db.py' to update the database")
        
    except Exception as e:
        print(f"❌ Error adding center: {e}")

def add_status(value: str, desc: str):
    """Add a new status to the configuration"""
    config_file = Path("config/statuses.json")
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            statuses = json.load(f)
        
        # Check if status already exists
        for status in statuses:
            if status["value"] == value:
                print(f"❌ Status with value '{value}' already exists")
                return
        
        # Add new status
        new_status = {"value": value, "desc": desc}
        statuses.append(new_status)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(statuses, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Added status: {desc} ({value})")
        print("💡 Run 'python init_db.py' to update the database")
        
    except Exception as e:
        print(f"❌ Error adding status: {e}")

def add_crit(value: str, desc: str):
    """Add a new criticality level to the configuration"""
    config_file = Path("config/crits.json")
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            crits = json.load(f)
        
        # Check if crit already exists
        for crit in crits:
            if crit["value"] == value:
                print(f"❌ Criticality level with value '{value}' already exists")
                return
        
        # Add new crit
        new_crit = {"value": value, "desc": desc}
        crits.append(new_crit)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(crits, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Added criticality level: {desc} ({value})")
        print("💡 Run 'python init_db.py' to update the database")
        
    except Exception as e:
        print(f"❌ Error adding criticality level: {e}")

def list_centers():
    """List all centers"""
    try:
        centers = config_manager.get_centers()
        print("📋 Centers:")
        for center in centers:
            print(f"  - {center['desc']} ({center['value']})")
    except Exception as e:
        print(f"❌ Error loading centers: {e}")

def list_statuses():
    """List all statuses"""
    try:
        statuses = config_manager.get_statuses()
        print("📋 Statuses:")
        for status in statuses:
            print(f"  - {status['desc']} ({status['value']})")
    except Exception as e:
        print(f"❌ Error loading statuses: {e}")

def list_crits():
    """List all criticality levels"""
    try:
        crits = config_manager.get_crits()
        print("📋 Criticality Levels:")
        for crit in crits:
            print(f"  - {crit['desc']} ({crit['value']})")
    except Exception as e:
        print(f"❌ Error loading criticality levels: {e}")

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print("Quick Configuration Helper")
        print("\nUsage:")
        print("  python quick_config.py add-center <value> <description>")
        print("  python quick_config.py add-status <value> <description>")
        print("  python quick_config.py add-crit <value> <description>")
        print("  python quick_config.py list-centers")
        print("  python quick_config.py list-statuses")
        print("  python quick_config.py list-crits")
        print("\nExamples:")
        print("  python quick_config.py add-center 307 'EAP Nova Centre'")
        print("  python quick_config.py add-status urgent 'Urgent'")
        print("  python quick_config.py add-crit urgent 'Urgent'")
        return
    
    command = sys.argv[1]
    
    if command == "add-center":
        if len(sys.argv) < 4:
            print("Error: Please provide value and description")
            print("Example: python quick_config.py add-center 307 'EAP Nova Centre'")
            return
        add_center(sys.argv[2], sys.argv[3])
    
    elif command == "add-status":
        if len(sys.argv) < 4:
            print("Error: Please provide value and description")
            print("Example: python quick_config.py add-status urgent 'Urgent'")
            return
        add_status(sys.argv[2], sys.argv[3])
    
    elif command == "add-crit":
        if len(sys.argv) < 4:
            print("Error: Please provide value and description")
            print("Example: python quick_config.py add-crit urgent 'Urgent'")
            return
        add_crit(sys.argv[2], sys.argv[3])
    
    elif command == "list-centers":
        list_centers()
    
    elif command == "list-statuses":
        list_statuses()
    
    elif command == "list-crits":
        list_crits()
    
    else:
        print(f"Unknown command: {command}")
        print("Use 'python quick_config.py' for help")

if __name__ == "__main__":
    main() 