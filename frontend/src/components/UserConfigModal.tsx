import React, { useState, useEffect } from 'react';
import { User, Center } from '../types';
import { usersAPI, referenceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './UserConfigModal.css';

interface UserConfigModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

const UserConfigModal: React.FC<UserConfigModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated
}) => {
  const { refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user.name || '',
    surnames: user.surnames || '',
    default_center_id: user.default_center_id || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCenters();
      setFormData({
        name: user.name || '',
        surnames: user.surnames || '',
        default_center_id: user.default_center_id || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, user]);

  const loadCenters = async () => {
    try {
      const centersData = await referenceAPI.getCenters();
      setCenters(centersData);
    } catch (error) {
      console.error('Error loading centers:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData: any = {
        name: formData.name,
        surnames: formData.surnames,
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

      const updatedUser = await usersAPI.updateCurrentUser(updateData);
      
      // Refresh user data in auth context
      await refreshUser();
      
      onUserUpdated(updatedUser);
      setSuccess('Configuració actualitzada correctament');
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Error al actualitzar la configuració');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuració de l'usuari</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Nom:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Introdueix el teu nom"
            />
          </div>

          <div className="form-group">
            <label htmlFor="surnames">Cognoms:</label>
            <input
              type="text"
              id="surnames"
              name="surnames"
              value={formData.surnames}
              onChange={handleInputChange}
              placeholder="Introdueix els teus cognoms"
            />
          </div>

          <div className="form-group">
            <label htmlFor="default_center_id">Centre per defecte:</label>
            <select
              id="default_center_id"
              name="default_center_id"
              value={formData.default_center_id || ''}
              onChange={handleInputChange}
            >
              <option value="">Cap centre per defecte</option>
              {centers.map(center => (
                <option key={center.id} value={center.id}>
                  {center.desc}
                </option>
              ))}
            </select>
            <small>El centre seleccionat s'aplicarà automàticament a les noves incidències</small>
          </div>

          <div className="form-section">
            <h3>Canviar contrasenya</h3>
            <div className="form-group">
              <label htmlFor="newPassword">Nova contrasenya:</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="Deixa buit per mantenir la contrasenya actual"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar nova contrasenya:</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirma la nova contrasenya"
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel·lar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardant...' : 'Guardar canvis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserConfigModal; 