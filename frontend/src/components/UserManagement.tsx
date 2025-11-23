import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Center } from '../types';
import { usersAPI, referenceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Key, Search, X, XCircle, CircleCheck, MoreHorizontal, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import UserForm from './UserForm';
import Badge from './Badge';
import './UserManagement.css';

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [actionDropdown, setActionDropdown] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{top: boolean, left: boolean, x: number, y: number}>({top: false, left: false, x: 0, y: 0});
  const [userToToggleStatus, setUserToToggleStatus] = useState<User | null>(null);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (currentUser && currentUser.permission_level > 1) {
      navigate('/tickets');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    loadUsers();
    loadCenters();
  }, []);

  const loadCenters = async () => {
    try {
      const centersData = await referenceAPI.getCenters();
      setCenters(centersData);
    } catch (err) {
      console.error('Error loading centers:', err);
    }
  };

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionDropdown !== null) {
        const target = event.target as HTMLElement;
        
        // Check if click is inside any dropdown
        if (target.closest('.action-dropdown')) {
          return; // Don't close if clicking inside dropdown
        }
        
        // Check if clicking on any multiaction button
        if (target.closest('.action-button.multiaction')) {
          return; // Don't close if clicking the button (it will toggle itself)
        }
        
        setActionDropdown(null);
        setDropdownPosition({top: false, left: false, x: 0, y: 0});
      }
    };

    if (actionDropdown !== null) {
      // Use a small timeout to allow click events on dropdown items to fire first
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 10);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [actionDropdown]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await usersAPI.getUsers();
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error carregant usuaris');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => {
      return (
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.name && user.name.toLowerCase().includes(query)) ||
        (user.surnames && user.surnames.toLowerCase().includes(query))
      );
    });
    setFilteredUsers(filtered);
  };

  const handleCreateUser = () => {
    setSelectedUser(undefined);
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: User) => {
    setActionDropdown(null);
    setSelectedUser(user);
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    setActionDropdown(null);
    if (window.confirm(`Estàs segur que vols eliminar l'usuari "${user.username}"?`)) {
      try {
        await usersAPI.deleteUser(user.id);
        await loadUsers();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Error eliminant l\'usuari');
      }
    }
  };

  const handleResetPassword = async (user: User) => {
    setActionDropdown(null);
    if (window.confirm(`Estàs segur que vols restablir la contrasenya de "${user.username}"? La nova contrasenya serà la part abans del @ del correu electrònic.`)) {
      try {
        const result = await usersAPI.resetUserPassword(user.id);
        alert(`Contrasenya restablida. La nova contrasenya és: ${result.default_password}`);
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Error restablint la contrasenya');
      }
    }
  };

  const handleToggleUserStatusClick = (user: User, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setActionDropdown(null);
    setUserToToggleStatus(user);
    setShowStatusConfirmModal(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!userToToggleStatus) return;
    
    const action = userToToggleStatus.is_active ? 'desactivar' : 'activar';
    const newStatus = !userToToggleStatus.is_active;
    
    try {
      const updatedUser = await usersAPI.toggleUserStatus(userToToggleStatus.id, newStatus);
      console.log('User status updated:', updatedUser);
      await loadUsers();
      setShowStatusConfirmModal(false);
      setUserToToggleStatus(null);
    } catch (err: any) {
      console.error('Error toggling user status:', err);
      alert(err.response?.data?.detail || `Error ${action} l'usuari`);
      setShowStatusConfirmModal(false);
      setUserToToggleStatus(null);
    }
  };

  const handleViewUser = (userId: number) => {
    navigate(`/users/${userId}`);
  };

  const handleActionDropdown = (userId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (actionDropdown === userId) {
      setActionDropdown(null);
      setDropdownPosition({top: false, left: false, x: 0, y: 0});
      return;
    }

    // Calculate position
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const shouldShowTop = rect.bottom + 100 > viewportHeight; // 100px for dropdown height
    const shouldShowLeft = rect.right + 120 > viewportWidth; // 120px for dropdown width
    
    // Calculate coordinates
    let x = shouldShowLeft ? rect.left - 120 : rect.right;
    let y = shouldShowTop ? rect.top - 100 : rect.bottom;
    
    setDropdownPosition({
      top: shouldShowTop,
      left: shouldShowLeft,
      x: x,
      y: y
    });
    setActionDropdown(userId);
  };

  const handleFormSuccess = () => {
    loadUsers();
  };

  const getPermissionLevelLabel = (level: number): string => {
    const labels: { [key: number]: string } = {
      1: 'Admin',
      2: 'Editor',
      3: 'Creador',
      4: 'Visor'
    };
    return labels[level] || 'Desconegut';
  };

  const getDefaultCenterName = (centerId?: number): string => {
    if (!centerId) return '-';
    const center = centers.find(c => c.id === centerId);
    return center ? center.desc : '-';
  };

  if (!currentUser || currentUser.permission_level > 1) {
    return null;
  }

  return (
    <div className="ticket-table-container">
      {error && <div className="error-message">{error}</div>}

      <div className="filter-controls">
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Cercar per nom d'usuari, correu, nom o cognoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear-button"
                onClick={() => setSearchQuery('')}
                title="Netejar cerca"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <button className="create-button" onClick={handleCreateUser}>
          <Plus size={16} />
          Crear usuari
        </button>
      </div>

      {loading && filteredUsers.length === 0 ? (
        <div className="loading">Carregant usuaris...</div>
      ) : (
        <div className="table-wrapper">
          <table className="ticket-table">
            <thead>
              <tr>
                <th></th>
                <th>Nom</th>
                <th>Cognoms</th>
                <th>Correu electrònic</th>
                <th>Centre per defecte</th>
                <th></th>
                <th>Accions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-tickets">
                    {searchQuery ? 'No s\'han trobat usuaris amb aquesta cerca' : 'No hi ha usuaris'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr 
                    key={user.id} 
                    className="ticket-row"
                    onClick={() => handleViewUser(user.id)}
                  >
                    <td>
                      <Badge type="permission" value={user.permission_level}>
                        {getPermissionLevelLabel(user.permission_level)}
                      </Badge>
                    </td>
                    <td>{user.name || '-'}</td>
                    <td>{user.surnames || '-'}</td>
                    <td>{user.email}</td>
                    <td>{getDefaultCenterName(user.default_center_id)}</td>
                    <td className="status-icon-cell">
                      {user.is_active ? (
                        <CircleCheck size={20} className="status-icon active" />
                      ) : (
                        <XCircle size={20} className="status-icon inactive" />
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                        <div className="multiaction-container">
                          <button
                            className="action-button multiaction"
                            onClick={(e) => handleActionDropdown(user.id, e)}
                            title="Més accions"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {actionDropdown === user.id && (
                            <div 
                              className={`action-dropdown ${dropdownPosition.top ? 'top' : ''} ${dropdownPosition.left ? 'left' : ''}`} 
                              style={{ top: dropdownPosition.y, left: dropdownPosition.x }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="dropdown-item edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditUser(user);
                                }}
                              >
                                <Edit size={16} />
                                Editar
                              </button>
                              <button
                                className="dropdown-item reset"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResetPassword(user);
                                }}
                              >
                                <Key size={16} />
                                Restablir contrasenya
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleUserStatusClick(user, e);
                                }}
                                disabled={user.id === currentUser.id}
                              >
                                {user.is_active ? (
                                  <>
                                    <UserX size={16} />
                                    Desactivar usuari
                                  </>
                                ) : (
                                  <>
                                    <UserCheck size={16} />
                                    Activar usuari
                                  </>
                                )}
                              </button>
                              <button
                                className="dropdown-item delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUser(user);
                                }}
                                disabled={user.id === currentUser.id}
                              >
                                <Trash2 size={16} />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <UserForm
        user={selectedUser}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedUser(undefined);
        }}
        onSuccess={handleFormSuccess}
      />

      {/* Confirmation modal for user status toggle */}
      {showStatusConfirmModal && userToToggleStatus && (
        <div className="modal-overlay" onClick={() => {
          setShowStatusConfirmModal(false);
          setUserToToggleStatus(null);
        }}>
          <div className="modal-content status-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} color="#f59e0b" />
                <h2>
                  {userToToggleStatus.is_active ? 'Desactivar usuari' : 'Activar usuari'}
                </h2>
              </div>
              <button className="modal-close" onClick={() => {
                setShowStatusConfirmModal(false);
                setUserToToggleStatus(null);
              }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {userToToggleStatus.is_active ? (
                  <>
                    Estàs segur que vols <strong>desactivar</strong> l'usuari <strong>"{userToToggleStatus.username}"</strong>?
                    <br /><br />
                    Un cop desactivat, l'usuari no podrà iniciar sessió a l'aplicació.
                  </>
                ) : (
                  <>
                    Estàs segur que vols <strong>activar</strong> l'usuari <strong>"{userToToggleStatus.username}"</strong>?
                    <br /><br />
                    Un cop activat, l'usuari podrà tornar a iniciar sessió a l'aplicació.
                  </>
                )}
              </p>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                onClick={() => {
                  setShowStatusConfirmModal(false);
                  setUserToToggleStatus(null);
                }} 
                className="btn-secondary"
              >
                Cancel·lar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmToggleStatus} 
                className="btn-primary"
              >
                {userToToggleStatus.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

