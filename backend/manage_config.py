#!/usr/bin/env python3
"""
Configuration Management Utility for Ticket Manager
Provides tools to manage and validate configuration files
"""

import sys
import os
import json
from pathlib import Path

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config_manager import config_manager

def list_config_files():
    """List all available configuration files"""
    print("Available configuration files:")
    config_files = config_manager.list_config_files()
    if not config_files:
        print("No configuration files found.")
        return
    
    for config_file in config_files:
        print(f"- {config_file}.json")

def validate_config(config_name: str):
    """Validate a specific configuration file"""
    print(f"Validating {config_name}.json...")
    
    if config_manager.validate_config(config_name):
        print(f"✅ {config_name}.json is valid")
        try:
            data = config_manager.load_config(config_name)
            print(f"   Contains {len(data)} items")
        except Exception as e:
            print(f"   Error loading data: {e}")
    else:
        print(f"❌ {config_name}.json is invalid or missing")

def validate_all_configs():
    """Validate all configuration files"""
    print("Validating all configuration files...")
    config_files = config_manager.list_config_files()
    
    if not config_files:
        print("No configuration files found.")
        return
    
    all_valid = True
    for config_file in config_files:
        if config_manager.validate_config(config_file):
            print(f"✅ {config_file}.json")
        else:
            print(f"❌ {config_file}.json")
            all_valid = False
    
    if all_valid:
        print("\nAll configuration files are valid!")
    else:
        print("\nSome configuration files have issues.")

def show_config_content(config_name: str):
    """Show the content of a configuration file"""
    print(f"Content of {config_name}.json:")
    try:
        data = config_manager.load_config(config_name)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error loading {config_name}.json: {e}")

def reload_config(config_name: str = None):
    """Reload configuration from files"""
    if config_name:
        print(f"Reloading {config_name}.json...")
        config_manager.reload_config(config_name)
        print(f"✅ {config_name}.json reloaded")
    else:
        print("Reloading all configuration files...")
        config_manager.reload_config()
        print("✅ All configuration files reloaded")

def create_sample_config(config_name: str):
    """Create a sample configuration file"""
    sample_data = {
        "statuses": [
            {"value": "created", "desc": "Creada"},
            {"value": "reviewed", "desc": "Revisada"}
        ],
        "crits": [
            {"value": "low", "desc": "Baixa"},
            {"value": "high", "desc": "Alta"}
        ],
        "centers": [
            {"value": "001", "desc": "Centre 1"},
            {"value": "002", "desc": "Centre 2"}
        ],
        "tools": [
            {"value": "tool1", "desc": "Eina 1"},
            {"value": "tool2", "desc": "Eina 2"}
        ]
    }
    
    if config_name not in sample_data:
        print(f"Unknown configuration type: {config_name}")
        print(f"Available types: {list(sample_data.keys())}")
        return
    
    config_file = Path("config") / f"{config_name}.json"
    
    if config_file.exists():
        print(f"Warning: {config_file} already exists. Overwrite? (y/N): ", end="")
        response = input().lower()
        if response != 'y':
            print("Operation cancelled.")
            return
    
    try:
        config_file.parent.mkdir(exist_ok=True)
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(sample_data[config_name], f, indent=2, ensure_ascii=False)
        print(f"✅ Created {config_file}")
    except Exception as e:
        print(f"Error creating {config_file}: {e}")

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print("Configuration Management Utility")
        print("\nUsage:")
        print("  python manage_config.py list                    - List all config files")
        print("  python manage_config.py validate [config_name]  - Validate config files")
        print("  python manage_config.py show <config_name>      - Show config content")
        print("  python manage_config.py reload [config_name]    - Reload config files")
        print("  python manage_config.py create <config_name>    - Create sample config")
        return
    
    command = sys.argv[1]
    
    if command == "list":
        list_config_files()
    
    elif command == "validate":
        if len(sys.argv) > 2:
            validate_config(sys.argv[2])
        else:
            validate_all_configs()
    
    elif command == "show":
        if len(sys.argv) < 3:
            print("Error: Please specify a configuration name")
            return
        show_config_content(sys.argv[2])
    
    elif command == "reload":
        if len(sys.argv) > 2:
            reload_config(sys.argv[2])
        else:
            reload_config()
    
    elif command == "create":
        if len(sys.argv) < 3:
            print("Error: Please specify a configuration name")
            print("Available types: statuses, crits, centers, tools")
            return
        create_sample_config(sys.argv[2])
    
    else:
        print(f"Unknown command: {command}")
        print("Use 'python manage_config.py' for help")

if __name__ == "__main__":
    main() 