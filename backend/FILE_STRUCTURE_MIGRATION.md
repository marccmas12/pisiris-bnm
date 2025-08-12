# File Structure Migration Guide

## 🎯 **New File Structure**

The file management system has been completely rewritten to use a more organized, ticket-based structure:

### **Before (Old Structure):**
```
uploads/
├── 2025/
│   ├── 08/
│   │   ├── INCD3E5CE_20250812_094634_2937a473.jpeg
│   │   └── INCD3E5CE_20250812_094645_42bbf938.pdf
│   └── 09/
└── 2024/
    └── 12/
```

### **After (New Structure):**
```
uploads/
└── tickets/
    ├── INCD3E5CE/
    │   └── attachments/
    │       ├── 2025/
    │       │   └── 08/
    │       │       ├── 20250812_094634_2937a473.jpeg
    │       │       └── 20250812_094645_42bbf938.pdf
    │       └── 2024/
    │           └── 12/
    └── INCF9E6FE/
        └── attachments/
            └── 2025/
                └── 08/
```

## 🚀 **Benefits of New Structure**

1. **Better Organization**: Files are grouped by ticket ID
2. **Easier Management**: Each ticket has its own directory
3. **Cleaner Deletion**: Removing a ticket removes all its files
4. **Better Security**: Files are isolated by ticket
5. **Easier Backup**: Can backup specific tickets individually

## 📋 **Migration Process**

### **Option 1: Automatic Migration via API (Recommended)**

1. **Restart the backend server** to load the new code
2. **Call the migration endpoint** (requires level 1 permissions):
   ```bash
   curl -X POST "http://localhost:8000/migrate-files" \
        -H "Authorization: Bearer YOUR_TOKEN"
   ```

### **Option 2: Manual Migration Script**

1. **Run the migration script**:
   ```bash
   cd backend
   python migrate_files.py
   ```

2. **The script will**:
   - Move all existing files to the new structure
   - Update the database with new file paths
   - Clean up empty old directories
   - Provide detailed progress logs

## 🔧 **Technical Changes**

### **Backend Changes:**

1. **New Directory Constants**:
   ```python
   UPLOADS_DIR = "uploads"
   TICKETS_UPLOADS_DIR = os.path.join(UPLOADS_DIR, "tickets")
   ```

2. **Updated File Upload Path**:
   ```python
   # Old: f"{year_month}/{unique_filename}"
   # New: f"tickets/{ticket_id}/attachments/{year_month}/{unique_filename}"
   ```

3. **Enhanced File Deletion**:
   - Uses `{filename:path}` parameter to handle full paths
   - URL decodes the filename parameter
   - Cleans up empty directories after deletion

4. **New Endpoints**:
   - `POST /migrate-files` - Trigger file migration
   - Enhanced `GET /tickets/{ticket_id}/attachments` - Shows directory structure

### **Frontend Changes:**

1. **URL Encoding**: File paths are now URL-encoded before sending to backend
2. **New API Method**: `ticketsAPI.migrateFiles()` for triggering migration

## 🧪 **Testing After Migration**

1. **Verify File Structure**:
   ```bash
   ls -la uploads/tickets/
   ```

2. **Test File Upload**: Upload a new file to a ticket
3. **Test File Deletion**: Delete an attachment from a ticket
4. **Check Database**: Verify file paths are updated

## ⚠️ **Important Notes**

1. **Backup First**: Always backup your database and uploads directory before migration
2. **Downtime**: The backend should be restarted after migration
3. **Permissions**: Migration requires level 1 user permissions
4. **Rollback**: The old files are moved, not copied, so ensure you have backups

## 🔍 **Troubleshooting**

### **Migration Fails:**
- Check file permissions on uploads directory
- Ensure database is accessible
- Check logs for specific error messages

### **Files Not Found After Migration:**
- Verify the migration completed successfully
- Check if file paths were updated in the database
- Ensure the backend is using the new code

### **Permission Errors:**
- Ensure the user has level 1 permissions
- Check if the migration endpoint is accessible

## 📞 **Support**

If you encounter issues during migration:

1. Check the backend logs for detailed error messages
2. Verify the file structure matches the expected format
3. Ensure all dependencies are properly installed
4. Contact the development team with specific error details

---

**Migration Status**: ✅ **Ready for Production**
**Last Updated**: $(date)
**Version**: 2.0.0 