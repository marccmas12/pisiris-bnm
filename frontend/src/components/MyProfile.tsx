import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Edit, Save, X, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { User, Center } from '../types';
import { usersAPI, referenceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import Badge from './Badge';
import './MyProfile.css';

const MyProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    surnames: '',
    role: '',
    phone: '',
    worktime: '',
    default_center_id: '' as string | number,
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadCenters();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        surnames: user.surnames || '',
        role: user.role || '',
        phone: user.phone || '',
        worktime: user.worktime || '',
        default_center_id: user.default_center_id || '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [user]);

  const loadCenters = async () => {
    try {
      const centersData = await referenceAPI.getCenters();
      setCenters(centersData);
    } catch (error) {
      console.error('Error loading centers:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditClick = () => {
    setIsEditMode(true);
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setShowPasswordSection(false);
    setError('');
    setSuccess('');
    // Reset form data to current user data
    if (user) {
      setFormData({
        name: user.name || '',
        surnames: user.surnames || '',
        role: user.role || '',
        phone: user.phone || '',
        worktime: user.worktime || '',
        default_center_id: user.default_center_id || '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  };

  const handleSaveClick = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData: any = {
        name: formData.name || null,
        surnames: formData.surnames || null,
        role: formData.role || null,
        phone: formData.phone || null,
        worktime: formData.worktime || null,
        default_center_id: formData.default_center_id ? parseInt(formData.default_center_id as string) : null
      };

      // Only include password if user wants to change it
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setError('Les contrasenyes no coincideixen');
          setLoading(false);
          return;
        }
        if (formData.newPassword.length < 6) {
          setError('La contrasenya ha de tenir almenys 6 caràcters');
          setLoading(false);
          return;
        }
        updateData.password = formData.newPassword;
      }

      await usersAPI.updateCurrentUser(updateData);
      
      // Refresh user data in auth context
      await refreshUser();
      
      setSuccess('Perfil actualitzat correctament');
      setIsEditMode(false);
      setShowPasswordSection(false);
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Error al actualitzar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionLevelLabel = (level: number): string => {
    const labels: { [key: number]: string } = {
      1: 'Administrador',
      2: 'Editor',
      3: 'Gestor',
      4: 'Visualitzador'
    };
    return labels[level] || 'Desconegut';
  };

  const getCenterName = (centerId?: number): string => {
    if (!centerId) return 'Cap centre per defecte';
    const center = centers.find(c => c.id === centerId);
    return center ? center.desc : 'Desconegut';
  };

  if (!user) {
    return (
      <div className="my-profile">
        <div className="loading">Carregant perfil...</div>
      </div>
    );
  }

  return (
    <div className="my-profile">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-avatar-large">
              <Avatar user={user} size="large" />
            </div>
            <div className="profile-title">
              <h2>{user.username}</h2>
              <Badge type="permission" value={user.permission_level}>
                {getPermissionLevelLabel(user.permission_level)}
              </Badge>
            </div>
            {!isEditMode && (
              <button className="btn-edit-inline" onClick={handleEditClick}>
                <Edit size={16} />
                Editar perfil
              </button>
            )}
          </div>

          <div className="profile-details">
            <div className="profile-section">
              <h3>Informació personal</h3>
              
              <div className="info-row">
                <span className="info-label">Nom d'usuari:</span>
                <span className="info-value">{user.username}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Correu electrònic:</span>
                <span className="info-value">{user.email}</span>
              </div>

              {isEditMode ? (
                <>
                  <div className="info-row edit-mode">
                    <label className="info-label" htmlFor="name">Nom:</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Introdueix el teu nom"
                      className="form-input"
                    />
                  </div>

                  <div className="info-row edit-mode">
                    <label className="info-label" htmlFor="surnames">Cognoms:</label>
                    <input
                      type="text"
                      id="surnames"
                      name="surnames"
                      value={formData.surnames}
                      onChange={handleInputChange}
                      placeholder="Introdueix els teus cognoms"
                      className="form-input"
                    />
                  </div>

                  <div className="info-row edit-mode">
                    <label className="info-label" htmlFor="role">Rol:</label>
                    <input
                      type="text"
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      placeholder="Ex: Tècnic, Coordinador..."
                      className="form-input"
                    />
                  </div>

                  <div className="info-row edit-mode">
                    <label className="info-label" htmlFor="phone">Telèfon:</label>
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Número de telèfon"
                      className="form-input"
                    />
                  </div>

                  <div className="info-row edit-mode">
                    <label className="info-label" htmlFor="worktime">Horari laboral:</label>
                    <textarea
                      id="worktime"
                      name="worktime"
                      value={formData.worktime}
                      onChange={handleInputChange}
                      placeholder="Ex: Dl-Dv 9:00-17:00"
                      className="form-textarea"
                      rows={2}
                    />
                  </div>

                  <div className="info-row edit-mode">
                    <label className="info-label" htmlFor="default_center_id">Centre per defecte:</label>
                    <select
                      id="default_center_id"
                      name="default_center_id"
                      value={formData.default_center_id || ''}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="">Cap centre per defecte</option>
                      {centers.map(center => (
                        <option key={center.id} value={center.id}>
                          {center.desc}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {user.name && (
                    <div className="info-row">
                      <span className="info-label">Nom:</span>
                      <span className="info-value">{user.name}</span>
                    </div>
                  )}

                  {user.surnames && (
                    <div className="info-row">
                      <span className="info-label">Cognoms:</span>
                      <span className="info-value">{user.surnames}</span>
                    </div>
                  )}

                  {user.role && (
                    <div className="info-row">
                      <span className="info-label">Rol:</span>
                      <span className="info-value">{user.role}</span>
                    </div>
                  )}

                  {user.phone && (
                    <div className="info-row">
                      <span className="info-label">Telèfon:</span>
                      <span className="info-value">{user.phone}</span>
                    </div>
                  )}

                  {user.worktime && (
                    <div className="info-row">
                      <span className="info-label">Horari laboral:</span>
                      <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>{user.worktime}</span>
                    </div>
                  )}

                  <div className="info-row">
                    <span className="info-label">Centre per defecte:</span>
                    <span className="info-value">{getCenterName(user.default_center_id)}</span>
                  </div>
                </>
              )}

              <div className="info-row">
                <span className="info-label">Nivell de permís:</span>
                <Badge type="permission" value={user.permission_level}>
                  {getPermissionLevelLabel(user.permission_level)}
                </Badge>
              </div>

              <div className="info-row">
                <span className="info-label">Estat del compte:</span>
                <Badge type="user-status" value={user.is_active ? 'active' : 'inactive'}>
                  {user.is_active ? 'Actiu' : 'Inactiu'}
                </Badge>
              </div>
            </div>

            {isEditMode && (
              <div className="profile-section password-section">
                <button
                  type="button"
                  className="password-section-toggle"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                >
                  <Lock size={18} />
                  <span>Canviar contrasenya</span>
                  {showPasswordSection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showPasswordSection && (
                  <div className="password-fields">
                    <div className="info-row edit-mode">
                      <label className="info-label" htmlFor="newPassword">Nova contrasenya:</label>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        placeholder="Mínim 6 caràcters"
                        className="form-input"
                      />
                    </div>

                    <div className="info-row edit-mode">
                      <label className="info-label" htmlFor="confirmPassword">Confirmar contrasenya:</label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirma la nova contrasenya"
                        className="form-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditMode && (
            <div className="profile-actions">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary"
                disabled={loading}
              >
                <X size={16} />
                Cancel·lar
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                className="btn-primary"
                disabled={loading}
              >
                <Save size={16} />
                {loading ? 'Guardant...' : 'Guardar canvis'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyProfile;

