#!/usr/bin/env python3
"""
Configuration Manager for Ticket Manager
Loads reference data from JSON configuration files
"""

import json
import os
from typing import List, Dict, Any
from pathlib import Path

class ConfigManager:
    """Manages configuration data loaded from JSON files"""
    
    def __init__(self, config_dir: str = "config"):
        self.config_dir = Path(config_dir)
        self._cache = {}
    
    def load_config(self, config_name: str) -> List[Dict[str, Any]]:
        """
        Load configuration data from a JSON file
        
        Args:
            config_name: Name of the configuration file (without .json extension)
            
        Returns:
            List of configuration items
            
        Raises:
            FileNotFoundError: If the configuration file doesn't exist
            json.JSONDecodeError: If the JSON file is malformed
        """
        if config_name in self._cache:
            return self._cache[config_name]
        
        config_file = self.config_dir / f"{config_name}.json"
        
        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_file}")
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._cache[config_name] = data
                return data
        except json.JSONDecodeError as e:
            raise json.JSONDecodeError(f"Invalid JSON in {config_file}: {e}", e.doc, e.pos)
    
    def get_statuses(self) -> List[Dict[str, Any]]:
        """Get statuses configuration"""
        return self.load_config("statuses")
    
    def get_crits(self) -> List[Dict[str, Any]]:
        """Get criticality levels configuration"""
        return self.load_config("crits")
    
    def get_centers(self) -> List[Dict[str, Any]]:
        """Get centers configuration"""
        return self.load_config("centers")
    
    def get_tools(self) -> List[Dict[str, Any]]:
        """Get tools configuration"""
        return self.load_config("tools")
    
    def reload_config(self, config_name: str = None):
        """
        Reload configuration data from files
        
        Args:
            config_name: Specific configuration to reload, or None to reload all
        """
        if config_name:
            if config_name in self._cache:
                del self._cache[config_name]
        else:
            self._cache.clear()
    
    def validate_config(self, config_name: str) -> bool:
        """
        Validate that a configuration file exists and contains valid JSON
        
        Args:
            config_name: Name of the configuration file
            
        Returns:
            True if valid, False otherwise
        """
        try:
            self.load_config(config_name)
            return True
        except (FileNotFoundError, json.JSONDecodeError):
            return False
    
    def list_config_files(self) -> List[str]:
        """List all available configuration files"""
        config_files = []
        for file_path in self.config_dir.glob("*.json"):
            config_files.append(file_path.stem)
        return config_files

# Global instance for easy access
config_manager = ConfigManager() 