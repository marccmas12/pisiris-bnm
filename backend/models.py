from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, date

# User models
class UserBase(BaseModel):
    username: str
    email: EmailStr
    name: Optional[str] = None
    surnames: Optional[str] = None
    permission_level: int = 3
    default_center_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    surnames: Optional[str] = None
    permission_level: Optional[int] = None
    default_center_id: Optional[int] = None
    password: Optional[str] = None

class User(UserBase):
    id: int
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)

# Ticket models
class FileAttachment(BaseModel):
    filename: str
    original_name: str
    path: str
    size: int
    hash: str
    uploaded_by: str
    uploaded_at: str
    file_type: str
    content_type: str
    ticket_id: str
    last_modified: Optional[str] = None
    file_exists: Optional[bool] = None

class TicketBase(BaseModel):
    ticket_num: Optional[str] = None
    type: str
    title: str
    description: str
    url: Optional[str] = None
    status_id: int
    crit_id: int
    center_id: Optional[int] = None
    tool_id: int
    notifier: Optional[str] = None
    people: List[str]
    pathway: str
    attached: Optional[List[FileAttachment]] = None

class TicketCreate(BaseModel):
    ticket_num: Optional[str] = None
    type: str
    title: str
    description: str
    url: Optional[str] = None
    status_id: int
    crit_id: int
    center_id: Optional[int] = None
    tool_id: int
    notifier: Optional[str] = None
    people: List[str]
    pathway: str

class TicketUpdate(BaseModel):
    ticket_num: Optional[str] = None
    type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    status_id: Optional[int] = None
    crit_id: Optional[int] = None
    center_id: Optional[int] = None
    tool_id: Optional[int] = None
    notifier: Optional[str] = None
    people: Optional[List[str]] = None
    pathway: Optional[str] = None

class Ticket(TicketBase):
    id: str  # Hex-based ID (INCXXXXXX/SUGXXXXXX)
    creator: int
    creation_date: date
    modify_date: Optional[datetime] = None
    resolution_date: Optional[date] = None
    delete_date: Optional[date] = None
    modify_reason: Optional[str] = None
    supports: int
    attached: Optional[List[FileAttachment]] = None
    
    model_config = ConfigDict(from_attributes=True)

class TicketWithRelations(BaseModel):
    id: str
    ticket_num: Optional[str] = None
    type: str
    title: str
    description: str
    url: Optional[str] = None
    status_id: int
    crit_id: int
    center_id: Optional[int] = None
    tool_id: int
    creation_date: date
    modify_date: Optional[datetime] = None
    resolution_date: Optional[date] = None
    delete_date: Optional[date] = None
    modify_reason: Optional[str] = None
    notifier: Optional[str] = None
    people: List[str]
    creator: int
    pathway: str
    supports: int
    attached: Optional[List[FileAttachment]] = None
    created_by_user: 'User'
    status: 'Status'
    crit: 'Crit'
    center: Optional['Center'] = None
    tool: 'Tool'
    model_config = ConfigDict(from_attributes=True)

# Modification models
class ModificationBase(BaseModel):
    ticket_id: str
    reason: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None

class ModificationCreate(ModificationBase):
    pass

class Modification(ModificationBase):
    id: int
    user_id: int
    date: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ModificationWithUser(Modification):
    user: User

# Status, Crit, Center, Tool models
class StatusBase(BaseModel):
    value: str
    desc: str

class Status(StatusBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class CritBase(BaseModel):
    value: str
    desc: str

class Crit(CritBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class CenterBase(BaseModel):
    value: str
    desc: str

class Center(CenterBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class ToolBase(BaseModel):
    value: str
    desc: str

class Tool(ToolBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# Authentication models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Response models
class TicketListResponse(BaseModel):
    tickets: List[TicketWithRelations]
    total: int
    page: int
    size: int

class ModificationListResponse(BaseModel):
    modifications: List[ModificationWithUser]
    total: int

class GroupedModification(BaseModel):
    id: int
    user_id: int
    date: datetime
    user: User
    changes: List[str]  # Natural language descriptions of changes
    total_changes: int

class GroupedModificationListResponse(BaseModel):
    modifications: List[GroupedModification]
    total: int 