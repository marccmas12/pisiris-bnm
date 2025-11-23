import axios from 'axios';
import {
  User,
  Ticket,
  TicketWithRelations,
  TicketCreate,
  TicketUpdate,
  UserCreate,
  UserUpdate,
  LoginForm,
  AuthResponse,
  TicketListResponse,
  GroupedModificationListResponse,
  Status,
  Crit,
  Center,
  Tool,
  CommentWithUser,
  CommentCreate,
  CommentListResponse,
  ProfileCompleteRequest,
  FirstPasswordChange
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 and 403 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('401 Unauthorized detected, logging out user...');
      // Clear token
      localStorage.removeItem('token');
      // Dispatch custom event to notify auth context
      window.dispatchEvent(new CustomEvent('auth:logout'));
      console.log('User logged out due to 401 response');
    } else if (error.response?.status === 403) {
      const detail = error.response?.data?.detail;
      // Check if user needs to complete profile or change password
      if (detail === 'must_complete_profile' || detail === 'must_change_password') {
        console.log('User needs to complete setup, redirecting...');
        // Trigger auth refresh to check user state
        window.dispatchEvent(new CustomEvent('auth:incomplete'));
      }
    }
    return Promise.reject(error);
  }
);

// Authentication
export const authAPI = {
  login: async (credentials: LoginForm): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    
    const response = await api.post('/token', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data;
  },
};

// Users
export const usersAPI = {
  createUser: async (user: UserCreate): Promise<User> => {
    const response = await api.post('/users/', user);
    return response.data;
  },

  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/users/');
    return response.data;
  },

  updateCurrentUser: async (userUpdate: Partial<User> & { password?: string }): Promise<User> => {
    const response = await api.put('/users/me', userUpdate);
    return response.data;
  },

  updateUser: async (userId: number, userUpdate: UserUpdate): Promise<User> => {
    const response = await api.put(`/users/${userId}`, userUpdate);
    return response.data;
  },

  deleteUser: async (userId: number): Promise<void> => {
    await api.delete(`/users/${userId}`);
  },

  resetUserPassword: async (userId: number): Promise<{ message: string; default_password: string }> => {
    const response = await api.post(`/users/${userId}/reset-password`);
    return response.data;
  },

  getUserTickets: async (userId: number): Promise<TicketWithRelations[]> => {
    const response = await api.get(`/users/${userId}/tickets`);
    return response.data;
  },

  toggleUserStatus: async (userId: number, isActive: boolean): Promise<User> => {
    const response = await api.put(`/users/${userId}`, { is_active: isActive });
    return response.data;
  },

  getUsersList: async (): Promise<User[]> => {
    const response = await api.get('/users/list');
    return response.data;
  },

  completeProfile: async (profileData: ProfileCompleteRequest): Promise<User> => {
    const response = await api.post('/users/me/complete-profile', profileData);
    return response.data;
  },

  changeFirstPassword: async (passwordData: FirstPasswordChange): Promise<User> => {
    const response = await api.post('/users/me/change-first-password', passwordData);
    return response.data;
  },
};

// Tickets
export const ticketsAPI = {
  createTicket: async (ticket: TicketCreate): Promise<Ticket> => {
    const response = await api.post('/tickets/', ticket);
    return response.data;
  },

  getTickets: async (
    skip: number = 0,
    limit: number = 10,
    status_id?: number,
    type?: string,
    crit_id?: number,
    tool_id?: number,
    center_id?: number,
    date_from?: string,
    date_to?: string,
    sort_by?: string,
    sort_order?: string,
    search?: string,
    show_hidden?: boolean
  ): Promise<TicketListResponse> => {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (status_id) params.append('status_id', status_id.toString());
    if (type) params.append('type', type);
    if (crit_id) params.append('crit_id', crit_id.toString());
    if (tool_id) params.append('tool_id', tool_id.toString());
    if (center_id) params.append('center_id', center_id.toString());
    if (date_from) params.append('date_from', date_from);
    if (date_to) params.append('date_to', date_to);
    if (sort_by) params.append('sort_by', sort_by);
    if (sort_order) params.append('sort_order', sort_order);
    if (search) params.append('search', search);
    if (show_hidden) params.append('show_hidden', 'true');

    const response = await api.get(`/tickets/?${params.toString()}`);
    return response.data;
  },

  getTicket: async (id: string): Promise<TicketWithRelations> => {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  },

  updateTicket: async (id: string, ticket: TicketUpdate): Promise<Ticket> => {
    const response = await api.put(`/tickets/${id}`, ticket);
    return response.data;
  },

  deleteTicket: async (id: string): Promise<void> => {
    await api.delete(`/tickets/${id}`);
  },

  // File attachment methods
  uploadFiles: async (ticketId: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.post(`/tickets/${ticketId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadSingleFile: async (ticketId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/tickets/${ticketId}/upload-single`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteAttachment: async (ticketId: string, filename: string): Promise<void> => {
    await api.delete(`/tickets/${ticketId}/attachments/${filename}`);
  },

  getTicketAttachments: async (ticketId: string): Promise<any> => {
    const response = await api.get(`/tickets/${ticketId}/attachments`);
    return response.data;
  },

  getFileDownloadUrl: (filename: string): string => {
    return `${API_BASE_URL}/uploads/${filename}`;
  },

  // File migration
  migrateFiles: async (): Promise<any> => {
    const response = await api.post('/migrate-files');
    return response.data;
  },
};

// Modifications
export const modificationsAPI = {
  createModification: async (ticketId: string, reason: string) => {
    const response = await api.post('/modifications/', {
      ticket_id: ticketId,
      reason,
    });
    return response.data;
  },

  getTicketModifications: async (ticketId: string): Promise<GroupedModificationListResponse> => {
    const response = await api.get(`/tickets/${ticketId}/modifications`);
    return response.data;
  },
};

// Reference data
export const referenceAPI = {
  getStatuses: async (): Promise<Status[]> => {
    const response = await api.get('/status/');
    return response.data;
  },

  getCrits: async (): Promise<Crit[]> => {
    const response = await api.get('/crit/');
    return response.data;
  },

  getCenters: async (): Promise<Center[]> => {
    const response = await api.get('/center/');
    return response.data;
  },

  getTools: async (): Promise<Tool[]> => {
    const response = await api.get('/tool/');
    return response.data;
  },

  initializeData: async (): Promise<void> => {
    await api.post('/init-data');
  },
};

// Comments
export const commentsAPI = {
  createComment: async (ticketId: string, comment: CommentCreate): Promise<CommentWithUser> => {
    const response = await api.post(`/tickets/${ticketId}/comments`, comment);
    return response.data;
  },

  getTicketComments: async (ticketId: string): Promise<CommentListResponse> => {
    const response = await api.get(`/tickets/${ticketId}/comments`);
    return response.data;
  },
};

// Dashboard
export interface DashboardStatistics {
  total_tickets: number;
  open_tickets: number;
  tickets_by_type: { [key: string]: number };
  tickets_by_criticality: { [key: string]: number };
  tickets_by_status: { [key: string]: number };
  tickets_by_center: { [key: string]: number };
  tickets_by_tool: { [key: string]: number };
  active_users: number;
  total_users: number;
  tickets_trend: Array<{ date: string; count: number }>;
}

export const dashboardAPI = {
  getStatistics: async (): Promise<DashboardStatistics> => {
    const response = await api.get('/dashboard/statistics');
    return response.data;
  },
};

export { api };
export default api; 