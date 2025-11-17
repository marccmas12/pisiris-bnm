export interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  surnames?: string;
  permission_level: number;
  is_active: boolean;
  default_center_id?: number;
}

export interface FileAttachment {
  filename: string;
  original_name: string;
  path: string;
  size: number;
  hash: string;
  uploaded_by: string;
  uploaded_at: string;
  file_type: string;
  content_type: string;
  ticket_id: string;
  last_modified?: string;
  file_exists?: boolean;
}

export interface Ticket {
  id: string;  // Hex-based ID (INCXXXXXX/SUGXXXXXX)
  ticket_num?: string;  // User-provided external ticket number (from external platforms)
  type: string;
  title: string;
  description: string;
  url?: string;
  status_id: number;
  crit_id: number;
  center_id?: number;
  tool_id: number;
  creation_date: string;
  modify_date?: string;
  resolution_date?: string;
  delete_date?: string;
  modify_reason?: string;
  notifier?: string;
  people: string[];
  creator: number;
  pathway: string;
  supports: number;
  attached?: FileAttachment[];
}

export interface TicketWithRelations extends Ticket {
  comments_count?: number;
  created_by_user: User;
  status: Status;
  crit: Crit;
  center?: Center;
  tool: Tool;
}

export interface Status {
  id: number;
  value: string;
  desc: string;
}

export interface Crit {
  id: number;
  value: string;
  desc: string;
}

export interface Center {
  id: number;
  value: string;
  desc: string;
}

export interface Tool {
  id: number;
  value: string;
  desc: string;
}

export interface Modification {
  id: number;
  ticket_id: string;  // Now string ID
  user_id: number;
  date: string;
  reason: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
}

export interface ModificationWithUser extends Modification {
  user: User;
}

export interface TicketCreate {
  ticket_num?: string;  // Optional external ticket number
  type: string;
  title: string;
  description: string;
  url?: string;
  status_id: number;
  crit_id: number;
  center_id?: number;
  tool_id: number;
  notifier?: string;
  people: string[];
  pathway: string;
}

export interface TicketUpdate {
  ticket_num?: string;  // Optional external ticket number
  type?: string;
  title?: string;
  description?: string;
  url?: string;
  status_id?: number;
  crit_id?: number;
  center_id?: number;
  tool_id?: number;
  notifier?: string;
  people?: string[];
  pathway?: string;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  name?: string;
  surnames?: string;
  permission_level: number;
  default_center_id?: number;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  name?: string;
  surnames?: string;
  permission_level?: number;
  default_center_id?: number;
  is_active?: boolean;
  password?: string;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface TicketListResponse {
  tickets: TicketWithRelations[];
  total: number;
  page: number;
  size: number;
}

export interface ModificationListResponse {
  modifications: ModificationWithUser[];
  total: number;
}

export interface GroupedModification {
  id: number;
  user_id: number;
  date: string;
  user: User;
  changes: string[];
  total_changes: number;
}

export interface GroupedModificationListResponse {
  modifications: GroupedModification[];
  total: number;
}

export interface Comment {
  id: number;
  ticket_id: string;
  user_id: number;
  content: string;
  created_at: string;
}

export interface CommentWithUser extends Comment {
  user: User;
}

export interface CommentCreate {
  ticket_id: string;
  content: string;
}

export interface CommentListResponse {
  comments: CommentWithUser[];
  total: number;
}

// User management interfaces
export interface UserListResponse {
  users: User[];
  total: number;
}

export interface UserWithTickets extends User {
  tickets: TicketWithRelations[];
  total_tickets: number;
}

// Permission level constants (for reference)
// Level 1: Admin (manage users + edit tickets)
// Level 2: Editor (edit tickets, cannot manage users)
// Level 3: Manager (create/view tickets)
// Level 4: Viewer (view only)