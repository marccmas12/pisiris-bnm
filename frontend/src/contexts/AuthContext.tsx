import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    console.log('Logging out user...');
    localStorage.removeItem('token');
    setUser(null);
    console.log('User logged out successfully');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getCurrentUser()
        .then(user => {
          setUser(user);
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for storage changes to handle logout from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' && e.newValue === null) {
        logout();
      }
    };

    const handleAuthLogout = () => {
      console.log('Auth logout event received');
      logout();
    };

    const handleAuthIncomplete = async () => {
      console.log('Auth incomplete event received, refreshing user...');
      try {
        await refreshUser();
      } catch (error) {
        console.error('Failed to refresh user:', error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleAuthLogout);
    window.addEventListener('auth:incomplete', handleAuthIncomplete);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleAuthLogout);
      window.removeEventListener('auth:incomplete', handleAuthIncomplete);
    };
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authAPI.login({ username, password });
      localStorage.setItem('token', response.access_token);
      const user = await authAPI.getCurrentUser();
      setUser(user);
    } catch (error) {
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const user = await authAPI.getCurrentUser();
      setUser(user);
    } catch (error) {
      logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 