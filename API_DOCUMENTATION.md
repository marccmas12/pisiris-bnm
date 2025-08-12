# Ticket Management API Documentation

## Overview

The Ticket Management API provides a comprehensive RESTful interface for creating, managing, and tracking tickets in the healthcare support system. This API enables external integrations, automation workflows, and third-party applications to interact with the ticket management platform.

**Base URL:** `http://localhost:8000`  
**API Version:** 1.0.0  
**Authentication:** Bearer Token (OAuth2)

---

## Table of Contents

- [Authentication](#authentication)
- [Tickets](#tickets)
- [File Attachments](#file-attachments)
- [Users](#users)
- [Modifications](#modifications)
- [Reference Data](#reference-data)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Examples](#examples)

---

## Authentication

### Get Access Token

**Endpoint:** `POST /token`

**Description:** Authenticate user and receive access token for API requests.

**Request Body:**
```http
Content-Type: application/x-www-form-urlencoded

username=your_username&password=your_password
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

**Usage:**
```bash
curl -X POST "http://localhost:8000/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=your_username&password=your_password"
```

**Note:** Include the token in subsequent requests using the `Authorization: Bearer {token}` header.

---

## Tickets

### Create Ticket

**Endpoint:** `POST /tickets/`

**Description:** Create a new ticket with specified details.

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "incidence",
  "title": "System Error in ECAP",
  "description": "Users cannot access the patient records module",
  "status_id": 1,
  "crit_id": 3,
  "tool_id": 1,
  "center_id": 305,
  "people": ["Dr. Smith", "Nurse Johnson"],
  "pathway": "web",
  "notifier": "Dr. Smith",
  "url": "https://example.com/issue-details"
}
```

**Required Fields:**
- `type`: Ticket type (`"incidence"` or `"suggestion"`)
- `title`: Ticket title (string)
- `description`: Detailed description (string)
- `status_id`: Status identifier (integer, 1-8)
- `crit_id`: Priority level (integer, 1-4)
- `tool_id`: Tool identifier (integer, 1-8)
- `people`: Array of people involved (array of strings)
- `pathway`: Creation method (`"web"`, `"mobile"`, `"email"`, `"phone"`, `"in_person"`)

**Optional Fields:**
- `ticket_num`: Custom ticket number (string)
- `center_id`: Center identifier (integer, nullable)
- `notifier`: Person who reported the issue (string)
- `url`: Related URL (string)

**Response:**
```json
{
  "id": "INC123456",
  "type": "incidence",
  "title": "System Error in ECAP",
  "description": "Users cannot access the patient records module",
  "status_id": 1,
  "crit_id": 3,
  "tool_id": 1,
  "center_id": 305,
  "people": ["Dr. Smith", "Nurse Johnson"],
  "pathway": "web",
  "notifier": "Dr. Smith",
  "url": "https://example.com/issue-details",
  "creator": 1,
  "creation_date": "2025-01-15",
  "supports": 0,
  "attached": []
}
```

### Get Tickets

**Endpoint:** `GET /tickets/`

**Description:** Retrieve a paginated list of tickets with optional filtering.

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 10, max: 100)
- `status_id`: Filter by status ID
- `type`: Filter by ticket type
- `crit_id`: Filter by priority level
- `tool_id`: Filter by tool
- `center_id`: Filter by center
- `date_from`: Filter by creation date (YYYY-MM-DD)
- `date_to`: Filter by creation date (YYYY-MM-DD)
- `sort_by`: Sort field (`creation_date`, `title`, `ticket_num`, `status`, `priority`)
- `sort_order`: Sort direction (`asc` or `desc`)

**Example Request:**
```bash
curl -X GET "http://localhost:8000/tickets/?skip=0&limit=20&status_id=1&sort_by=creation_date&sort_order=desc" \
  -H "Authorization: Bearer {access_token}"
```

**Response:**
```json
{
  "tickets": [...],
  "total": 150,
  "page": 1,
  "size": 20
}
```

### Get Ticket

**Endpoint:** `GET /tickets/{ticket_id}`

**Description:** Retrieve detailed information about a specific ticket.

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `ticket_id`: Ticket identifier (e.g., "INC123456")

**Response:**
```json
{
  "id": "INC123456",
  "type": "incidence",
  "title": "System Error in ECAP",
  "description": "Users cannot access the patient records module",
  "status_id": 1,
  "crit_id": 3,
  "tool_id": 1,
  "center_id": 305,
  "people": ["Dr. Smith", "Nurse Johnson"],
  "pathway": "web",
  "notifier": "Dr. Smith",
  "url": "https://example.com/issue-details",
  "creator": 1,
  "creation_date": "2025-01-15",
  "modify_date": null,
  "resolution_date": null,
  "delete_date": null,
  "supports": 0,
  "attached": [],
  "created_by_user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "permission_level": 1,
    "is_active": true
  },
  "status": {
    "id": 1,
    "value": "created",
    "desc": "Creada"
  },
  "crit": {
    "id": 3,
    "value": "high",
    "desc": "Alta"
  },
  "center": {
    "id": 305,
    "value": "305",
    "desc": "EAP St. Andreu de Llavaneres"
  },
  "tool": {
    "id": 1,
    "value": "ECAP",
    "desc": "ECAP"
  }
}
```

### Update Ticket

**Endpoint:** `PUT /tickets/{ticket_id}`

**Description:** Update an existing ticket with new information.

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Path Parameters:**
- `ticket_id`: Ticket identifier

**Request Body:** (All fields are optional - only include fields to update)
```json
{
  "status_id": 4,
  "description": "Updated description with additional context",
  "crit_id": 4,
  "people": ["Dr. Smith", "Nurse Johnson", "IT Support"]
}
```

**Response:** Updated ticket object

**Notes:**
- Only fields included in the request will be updated
- `modify_date` is automatically set to current timestamp
- `resolution_date` is automatically set when status changes to "solved"
- `delete_date` is automatically set when status changes to "deleted"
- All changes are tracked in the modifications log

### Delete Ticket

**Endpoint:** `DELETE /tickets/{ticket_id}`

**Description:** Soft delete a ticket (sets delete_date instead of removing).

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `ticket_id`: Ticket identifier

**Response:**
```json
{
  "message": "Ticket deleted successfully"
}
```

---

## File Attachments

### Upload Files

**Endpoint:** `POST /tickets/{ticket_id}/upload`

**Description:** Upload multiple files to a ticket.

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Path Parameters:**
- `ticket_id`: Ticket identifier

**Form Data:**
- `files`: File objects (multiple files supported)

**File Restrictions:**
- **Max Size:** 50MB per file
- **Allowed Extensions:** `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.xls`, `.xlsx`, `.csv`, `.ppt`, `.pptx`, `.zip`, `.rar`, `.7z`, `.tar`, `.gz`

**Example Request:**
```bash
curl -X POST "http://localhost:8000/tickets/INC123456/upload" \
  -H "Authorization: Bearer {access_token}" \
  -F "files=@/path/to/document.pdf" \
  -F "files=@/path/to/screenshot.png"
```

**Response:**
```json
{
  "message": "Upload completed. 2 files uploaded successfully.",
  "uploaded_files": [
    {
      "filename": "document.pdf",
      "original_name": "document.pdf",
      "path": "tickets/INC123456/attachments/2025/01/20250115_143022_a1b2c3d4.pdf",
      "size": 1024000,
      "hash": "sha256_hash_here",
      "uploaded_by": "username",
      "uploaded_at": "2025-01-15T14:30:22",
      "file_type": ".pdf",
      "content_type": "application/pdf",
      "ticket_id": "INC123456"
    }
  ],
  "failed_uploads": [],
  "total_uploaded": 2,
  "total_failed": 0
}
```

### Upload Single File

**Endpoint:** `POST /tickets/{ticket_id}/upload-single`

**Description:** Upload a single file to a ticket (backward compatibility).

**Usage:** Same as multiple upload but with single file.

### Get Attachments

**Endpoint:** `GET /tickets/{ticket_id}/attachments`

**Description:** Retrieve detailed information about all attachments for a ticket.

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "ticket_id": "INC123456",
  "total_attachments": 2,
  "total_size": 2048000,
  "attachments": [...],
  "directory_structure": {
    "2025": {
      "01": ["20250115_143022_a1b2c3d4.pdf", "20250115_143025_e5f6g7h8.png"]
    }
  }
}
```

### Delete Attachment

**Endpoint:** `DELETE /tickets/{ticket_id}/attachments/{filename}`

**Description:** Remove a specific file attachment from a ticket.

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `ticket_id`: Ticket identifier
- `filename`: File path (URL-encoded)

**Response:**
```json
{
  "message": "Attachment deleted successfully",
  "deleted_file": "document.pdf",
  "remaining_attachments": 1
}
```

---

## Users

### Get Current User

**Endpoint:** `GET /users/me`

**Description:** Retrieve information about the currently authenticated user.

**Headers:**
```http
Authorization: Bearer {access_token}
```

### Create User

**Endpoint:** `POST /users/`

**Description:** Create a new user account (requires level 1 permission).

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepassword",
  "permission_level": 3,
  "name": "John",
  "surnames": "Doe",
  "default_center_id": 305
}
```

### Update User

**Endpoint:** `PUT /users/{user_id}`

**Description:** Update user information (requires level 1 permission).

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

---

## Modifications

### Create Modification

**Endpoint:** `POST /modifications/`

**Description:** Manually create a modification record for a ticket.

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "ticket_id": "INC123456",
  "reason": "Manual update by external system",
  "field_name": "description",
  "old_value": "Previous description",
  "new_value": "Updated description"
}
```

### Get Ticket Modifications

**Endpoint:** `GET /tickets/{ticket_id}/modifications`

**Description:** Retrieve all modifications for a specific ticket.

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "modifications": [
    {
      "id": 1,
      "user_id": 1,
      "date": "2025-01-15T14:30:22",
      "user": {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com"
      },
      "changes": ["El títol s'ha canviat per \"Updated Title\""],
      "total_changes": 1
    }
  ],
  "total": 1
}
```

---

## Reference Data

### Get Statuses

**Endpoint:** `GET /status/`

**Description:** Retrieve all available ticket statuses.

**Response:**
```json
[
  {"id": 1, "value": "created", "desc": "Creada"},
  {"id": 2, "value": "reviewed", "desc": "Revisada"},
  {"id": 3, "value": "discarted", "desc": "Descartada"},
  {"id": 4, "value": "resolving", "desc": "En resolució"},
  {"id": 5, "value": "notified", "desc": "Notificada"},
  {"id": 6, "value": "solved", "desc": "Resolta"},
  {"id": 7, "value": "closed", "desc": "Tancada"},
  {"id": 8, "value": "deleted", "desc": "Eliminada"}
]
```

### Get Priorities

**Endpoint:** `GET /crit/`

**Description:** Retrieve all available priority levels.

**Response:**
```json
[
  {"id": 1, "value": "low", "desc": "Baixa"},
  {"id": 2, "value": "mid", "desc": "Mitja"},
  {"id": 3, "value": "high", "desc": "Alta"},
  {"id": 4, "value": "critical", "desc": "Crítica"}
]
```

### Get Tools

**Endpoint:** `GET /tool/`

**Description:** Retrieve all available tools/systems.

**Response:**
```json
[
  {"id": 1, "value": "ECAP", "desc": "ECAP"},
  {"id": 2, "value": "PXM", "desc": "Programació per motius - HES"},
  {"id": 3, "value": "AIN", "desc": "Alertes i Notificacions - HES"},
  {"id": 4, "value": "CAM", "desc": "Centre d'Ajuda - HES"},
  {"id": 5, "value": "AXIA", "desc": "Axia | Suport clínic - HES"},
  {"id": 6, "value": "LAND_MED", "desc": "Pàgina d'inici Medicina"},
  {"id": 7, "value": "LAND_INF", "desc": "Pàgina d'inici Infermeria"},
  {"id": 8, "value": "LAND_GIS", "desc": "Pàgina d'inici Administratiu"}
]
```

### Get Centers

**Endpoint:** `GET /center/`

**Description:** Retrieve all available healthcare centers.

**Response:**
```json
[
  {"id": 1, "value": "305", "desc": "EAP St. Andreu de Llavaneres"},
  {"id": 2, "value": "273", "desc": "EAP Arenys de Mar"},
  {"id": 3, "value": "302", "desc": "EAP Mataró- 3 (Perú)"}
]
```

---

## Error Handling

### HTTP Status Codes

- **200 OK:** Request successful
- **201 Created:** Resource created successfully
- **400 Bad Request:** Invalid request data or validation error
- **401 Unauthorized:** Missing or invalid authentication token
- **403 Forbidden:** Insufficient permissions for the operation
- **404 Not Found:** Resource not found
- **500 Internal Server Error:** Server-side error

### Error Response Format

```json
{
  "detail": "Error description message"
}
```

### Common Error Scenarios

- **Authentication Required:** Missing or expired access token
- **Permission Denied:** User lacks required permission level
- **Validation Error:** Invalid field values or missing required fields
- **Resource Not Found:** Ticket, user, or file doesn't exist
- **File Upload Error:** File too large or unsupported format

---

## Rate Limits

Currently, no rate limiting is implemented. However, it's recommended to:
- Limit requests to reasonable volumes
- Implement exponential backoff for retries
- Cache reference data when possible

---

## Examples

### Complete Ticket Lifecycle

```python
import requests
import json

class TicketAPI:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.token = None
    
    def authenticate(self):
        """Get authentication token"""
        response = requests.post(
            f"{self.base_url}/token",
            data={"username": self.username, "password": self.password}
        )
        self.token = response.json()["access_token"]
        return self.token
    
    def create_ticket(self, ticket_data):
        """Create a new ticket"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/tickets/",
            json=ticket_data,
            headers=headers
        )
        return response.json()
    
    def update_ticket(self, ticket_id, update_data):
        """Update ticket status"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.put(
            f"{self.base_url}/tickets/{ticket_id}",
            json=update_data,
            headers=headers
        )
        return response.json()
    
    def upload_files(self, ticket_id, file_paths):
        """Upload files to ticket"""
        headers = {"Authorization": f"Bearer {self.token}"}
        files = [('files', open(path, 'rb')) for path in file_paths]
        response = requests.post(
            f"{self.base_url}/tickets/{ticket_id}/upload",
            files=files,
            headers=headers
        )
        return response.json()

# Usage
api = TicketAPI("http://localhost:8000", "username", "password")
api.authenticate()

# 1. Create ticket
ticket = api.create_ticket({
    "type": "incidence",
    "title": "AI Detected Issue",
    "description": "Performance degradation detected",
    "status_id": 1,
    "crit_id": 3,
    "tool_id": 1,
    "people": ["System Admin"],
    "pathway": "web"
})

# 2. Upload evidence
if ticket.get('id'):
    api.upload_files(ticket['id'], ["/path/to/logs.pdf"])

# 3. Update status
api.update_ticket(ticket['id'], {"status_id": 4})
```

### Webhook Integration

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/webhook/ticket', methods=['POST'])
def create_ticket_webhook():
    """Webhook endpoint for creating tickets from external systems"""
    
    # Validate webhook payload
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid payload"}), 400
    
    # Transform webhook data to ticket format
    ticket_data = {
        "type": data.get("type", "incidence"),
        "title": data.get("title"),
        "description": data.get("description"),
        "status_id": 1,  # Always start as "created"
        "crit_id": data.get("priority", 2),  # Default to medium
        "tool_id": data.get("tool_id", 1),
        "people": data.get("people", []),
        "pathway": "web",
        "notifier": data.get("reporter")
    }
    
    # Create ticket via API
    try:
        response = requests.post(
            "http://localhost:8000/tickets/",
            json=ticket_data,
            headers={"Authorization": f"Bearer {get_api_token()}"}
        )
        
        if response.status_code == 201:
            return jsonify({
                "success": True,
                "ticket_id": response.json()["id"],
                "message": "Ticket created successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": response.json().get("detail", "Unknown error")
            }), response.status_code
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

---

## Support

For technical support or questions about the API:
- Check the error responses for detailed information
- Verify authentication and permissions
- Ensure all required fields are provided
- Review the reference data for valid IDs

---

**Last Updated:** January 2025  
**API Version:** 1.0.0 