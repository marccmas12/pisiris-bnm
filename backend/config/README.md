# Configuration Management

This directory contains JSON configuration files for managing reference data in the Ticket Manager application. This system allows you to easily update and maintain reference data without modifying the application code.

## Configuration Files

### `statuses.json`
Contains the different status values for tickets:
- `value`: Internal identifier (e.g., "created", "reviewed")
- `desc`: Human-readable description in Catalan (e.g., "Creada", "Revisada")

### `crits.json`
Contains criticality/priority levels:
- `value`: Internal identifier (e.g., "low", "high")
- `desc`: Human-readable description in Catalan (e.g., "Baixa", "Alta")

### `centers.json`
Contains the list of centers:
- `value`: Center code (e.g., "305", "273")
- `desc`: Center name (e.g., "EAP St. Andreu de Llavaneres")

### `tools.json`
Contains available tools (optional):
- `value`: Tool identifier
- `desc`: Tool description

## Managing Configuration

### Using the Management Utility

The `manage_config.py` script provides tools to manage configuration files:

```bash
# List all configuration files
python manage_config.py list

# Validate all configuration files
python manage_config.py validate

# Validate a specific configuration file
python manage_config.py validate centers

# Show the content of a configuration file
python manage_config.py show centers

# Reload all configuration files (useful after editing)
python manage_config.py reload

# Create a sample configuration file
python manage_config.py create centers
```

### Manual Editing

You can edit the JSON files directly with any text editor. The files use UTF-8 encoding and support Catalan characters.

Example of editing `centers.json`:
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

### Adding New Centers

1. Open `centers.json` in your preferred editor
2. Add a new entry with a unique `value` and `desc`
3. Save the file
4. Run `python manage_config.py reload` to reload the configuration
5. Restart the application or reinitialize the database

### Updating Existing Data

1. Edit the appropriate JSON file
2. Save the changes
3. Run `python manage_config.py reload`
4. Reinitialize the database to apply changes:
   ```bash
   python init_db.py
   ```

## Database Initialization

When you run `python init_db.py`, the system will:

1. Load all configuration files
2. Check for existing data in the database
3. Add any new items from the configuration files
4. Skip existing items (no duplicates)

## File Format

All configuration files follow the same JSON array format:

```json
[
  {
    "value": "unique_identifier",
    "desc": "Human readable description"
  }
]
```

## Validation

The system validates:
- JSON syntax
- Required fields (`value` and `desc`)
- File existence and readability

## Benefits

- **Separation of Concerns**: Configuration data is separate from application code
- **Easy Maintenance**: Update reference data without touching code
- **Version Control**: Track changes to configuration files in git
- **Flexibility**: Add new centers, statuses, etc. without code changes
- **Validation**: Built-in validation ensures data integrity

## Troubleshooting

### Configuration File Not Found
- Ensure the file exists in the `config/` directory
- Check file permissions
- Verify the file name matches exactly (case-sensitive)

### Invalid JSON
- Use a JSON validator to check syntax
- Ensure proper UTF-8 encoding
- Check for missing commas or brackets

### Database Not Updated
- Run `python init_db.py` to reinitialize the database
- Check that the configuration files are valid
- Verify the database connection

## Best Practices

1. **Backup**: Always backup configuration files before making changes
2. **Test**: Validate configuration files before applying to production
3. **Version Control**: Commit configuration changes to version control
4. **Documentation**: Document any special values or requirements
5. **Consistency**: Use consistent naming conventions for `value` fields 