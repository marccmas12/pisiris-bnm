# Configuration System Guide

## Overview

The Ticket Manager application now uses a flexible configuration system that separates reference data from application code. This allows you to easily manage centers, statuses, criticality levels, and tools without modifying the application code.

## File Structure

```
backend/
├── config/
│   ├── centers.json      # Center definitions
│   ├── statuses.json     # Status definitions  
│   ├── crits.json        # Criticality levels
│   ├── tools.json        # Tool definitions
│   └── README.md         # Configuration documentation
├── config_manager.py     # Configuration loader
├── manage_config.py      # Configuration management utility
├── quick_config.py       # Quick configuration helper
└── init_db.py           # Database initialization (updated)
```

## Configuration Files

### centers.json
Contains the list of centers where tickets can be created:
```json
[
  {
    "value": "305",
    "desc": "EAP St. Andreu de Llavaneres"
  },
  {
    "value": "306", 
    "desc": "EAP Nova Centre"
  }
]
```

### statuses.json
Contains ticket status definitions:
```json
[
  {
    "value": "created",
    "desc": "Creada"
  },
  {
    "value": "pending",
    "desc": "Pendent"
  }
]
```

### crits.json
Contains criticality/priority levels:
```json
[
  {
    "value": "low",
    "desc": "Baixa"
  },
  {
    "value": "high",
    "desc": "Alta"
  }
]
```

### tools.json
Contains available tools (optional):
```json
[
  {
    "value": "tool1",
    "desc": "Eina 1"
  }
]
```

## Management Tools

### 1. Configuration Management Utility (`manage_config.py`)

**List all configuration files:**
```bash
python manage_config.py list
```

**Validate all configuration files:**
```bash
python manage_config.py validate
```

**Validate a specific configuration:**
```bash
python manage_config.py validate centers
```

**Show configuration content:**
```bash
python manage_config.py show centers
```

**Reload configuration files:**
```bash
python manage_config.py reload
```

### 2. Quick Configuration Helper (`quick_config.py`)

**Add a new center:**
```bash
python quick_config.py add-center 307 "EAP Nova Centre"
```

**Add a new status:**
```bash
python quick_config.py add-status pending "Pendent"
```

**Add a new criticality level:**
```bash
python quick_config.py add-crit urgent "Urgent"
```

**List all centers:**
```bash
python quick_config.py list-centers
```

**List all statuses:**
```bash
python quick_config.py list-statuses
```

**List all criticality levels:**
```bash
python quick_config.py list-crits
```

## Workflow for Adding New Reference Data

### Adding a New Center

1. **Using the quick helper:**
   ```bash
   python quick_config.py add-center 307 "EAP Nova Centre"
   ```

2. **Manual editing:**
   - Edit `config/centers.json`
   - Add new entry with unique `value` and `desc`
   - Save the file

3. **Update the database:**
   ```bash
   python init_db.py
   ```

### Adding a New Status

1. **Using the quick helper:**
   ```bash
   python quick_config.py add-status pending "Pendent"
   ```

2. **Manual editing:**
   - Edit `config/statuses.json`
   - Add new entry with unique `value` and `desc`
   - Save the file

3. **Update the database:**
   ```bash
   python init_db.py
   ```

## Database Initialization

The `init_db.py` script now:

1. **Loads configuration files** from the `config/` directory
2. **Validates the data** to ensure it's properly formatted
3. **Checks for existing data** in the database to avoid duplicates
4. **Adds new items** from the configuration files
5. **Reports what was added** to help track changes

### Running Database Initialization

```bash
python init_db.py
```

**Example output:**
```
Creating database tables...
Loading reference data from configuration files...
Added center: EAP Nova Centre (306)
Added status: Pendent (pending)

Database initialization completed successfully!

Available configuration files:
- tools.json
- centers.json
- statuses.json
- crits.json
```

## Benefits of This System

### 1. **Separation of Concerns**
- Configuration data is separate from application code
- Easy to maintain and update without touching code
- Clear distinction between data and logic

### 2. **Version Control**
- Configuration changes can be tracked in git
- Easy to see what changed and when
- Rollback capability for configuration changes

### 3. **Flexibility**
- Add new centers, statuses, etc. without code changes
- Easy to test different configurations
- Support for multiple environments

### 4. **Validation**
- Built-in validation ensures data integrity
- Prevents invalid configurations from being applied
- Clear error messages for configuration issues

### 5. **User-Friendly Tools**
- Quick commands for common tasks
- Helpful error messages and guidance
- Easy-to-use management utilities

## Best Practices

### 1. **Backup Before Changes**
Always backup configuration files before making changes:
```bash
cp config/centers.json config/centers.json.backup
```

### 2. **Validate After Changes**
Always validate configuration files after editing:
```bash
python manage_config.py validate
```

### 3. **Test in Development**
Test configuration changes in a development environment before applying to production.

### 4. **Use Descriptive Values**
Use meaningful values for the `value` field:
- Centers: Use center codes (e.g., "305", "306")
- Statuses: Use descriptive names (e.g., "created", "pending")
- Criticality: Use clear levels (e.g., "low", "high", "critical")

### 5. **Consistent Naming**
Maintain consistent naming conventions across all configuration files.

## Troubleshooting

### Configuration File Not Found
- Check that the file exists in the `config/` directory
- Verify the file name is correct (case-sensitive)
- Ensure proper file permissions

### Invalid JSON
- Use a JSON validator to check syntax
- Ensure proper UTF-8 encoding
- Check for missing commas or brackets

### Database Not Updated
- Run `python init_db.py` to reinitialize the database
- Check that configuration files are valid
- Verify the database connection

### Duplicate Values
- The system prevents duplicate `value` fields
- Use unique values for each entry
- Check existing data before adding new entries

## Migration from Hardcoded Data

If you're migrating from the old hardcoded system:

1. **Backup your current data**
2. **Create configuration files** with your existing data
3. **Test the new system** in a development environment
4. **Update the database** using `python init_db.py`
5. **Verify everything works** correctly

## Future Enhancements

The configuration system is designed to be extensible. Future enhancements could include:

- **Environment-specific configurations** (dev, staging, prod)
- **Configuration validation rules** (e.g., required fields, format validation)
- **Configuration import/export** functionality
- **Web-based configuration interface**
- **Configuration change notifications**

## Support

If you encounter issues with the configuration system:

1. **Check the validation** using `python manage_config.py validate`
2. **Review the error messages** for specific issues
3. **Check the configuration file format** against the examples
4. **Verify database connectivity** and permissions
5. **Consult the troubleshooting section** above 