import React, { useState, useEffect } from 'react';
import { User, UserCreate, UserUpdate, Center } from '../types';
import { usersAPI, referenceAPI } from '../services/api';
import './UserForm.css';

interface UserFormProps {
  user?: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UserForm: React.FC<UserFormProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess
}) => {
  const isEditing = !!user;
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    surnames: '',
    password: '',
    confirmPassword: '',
    permission_level: 4,
    default_center_id: '',
    is_active: true,
    phone: '',
    worktime: '',
    role: ''
  });
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCenters();
      if (isEditing && user) {
        setFormData({
          username: user.username,
          email: user.email,
          name: user.name || '',
          surnames: user.surnames || '',
          password: '',
          confirmPassword: '',
          permission_level: user.permission_level,
          default_center_id: user.default_center_id?.toString() || '',
          is_active: user.is_active,
          phone: user.phone || '',
          worktime: user.worktime || '',
          role: user.role || ''
        });
      } else {
        setFormData({
          username: '',
          email: '',
          name: '',
          surnames: '',
          password: '',
          confirmPassword: '',
          permission_level: 4,
          default_center_id: '',
          is_active: true,
          phone: '',
          worktime: '',
          role: ''
        });
      }
      setError('');
    }
  }, [isOpen, user, isEditing]);

  const loadCenters = async () => {
    try {
      const centersData = await referenceAPI.getCenters();
      setCenters(centersData);
    } catch (error) {
      console.error('Error loading centers:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        // Update user
        const updateData: UserUpdate = {
          username: formData.username,
          email: formData.email,
          name: formData.name || undefined,
          surnames: formData.surnames || undefined,
          permission_level: formData.permission_level,
          default_center_id: formData.default_center_id ? parseInt(formData.default_center_id) : undefined,
          is_active: formData.is_active,
          phone: formData.phone || undefined,
          worktime: formData.worktime || undefined,
          role: formData.role || undefined
        };

        // Only include password if provided
        if (formData.password) {
          if (formData.password.length < 6) {
            setError('La contrasenya ha de tenir almenys 6 caràcters');
            setLoading(false);
            return;
          }
          if (formData.password !== formData.confirmPassword) {
            setError('Les contrasenyes no coincideixen');
            setLoading(false);
            return;
          }
          updateData.password = formData.password;
        }

        await usersAPI.updateUser(user!.id, updateData);
      } else {
        // Create user - password is auto-generated from email on backend
        const createData: UserCreate = {
          username: formData.username,
          email: formData.email,
          permission_level: formData.permission_level,
          default_center_id: formData.default_center_id ? parseInt(formData.default_center_id) : undefined,
          name: formData.name || undefined,
          surnames: formData.surnames || undefined,
          phone: formData.phone || undefined,
          worktime: formData.worktime || undefined,
          role: formData.role || undefined
        };

        await usersAPI.createUser(createData);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.detail || `Error al ${isEditing ? 'actualitzar' : 'crear'} l'usuari`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const permissionLevels = [
    { value: 1, label: 'Administrador' },
    { value: 2, label: 'Editor' },
    { value: 3, label: 'Gestor' },
    { value: 4, label: 'Visualitzador' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Editar usuari' : 'Crear nou usuari'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="username">Nom d'usuari: *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={isEditing}
              placeholder="Nom d'usuari únic"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correu electrònic: *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="usuari@exemple.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Nom:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Nom de l'usuari"
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
              placeholder="Cognoms de l'usuari"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Rol:</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="">Selecciona un rol</option>
              <option value="administratiu">Administratiu</option>
              <option value="Metge de familia">Metge de familia</option>
              <option value="Infermeria">Infermeria</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telèfon (recomanat):</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Número de telèfon"
            />
          </div>

          <div className="form-group">
            <label htmlFor="worktime">Horari laboral (recomanat):</label>
            <textarea
              id="worktime"
              name="worktime"
              value={formData.worktime}
              onChange={handleInputChange}
              placeholder="Descriu l'horari de treball"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="permission_level">Nivell de permisos: *</label>
            <select
              id="permission_level"
              name="permission_level"
              value={formData.permission_level}
              onChange={handleInputChange}
              required
            >
              {permissionLevels.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
            <small>
              {formData.permission_level === 1 && 'Administrador: pot gestionar usuaris i editar incidències'}
              {formData.permission_level === 2 && 'Editor: pot editar incidències però no gestionar usuaris'}
              {formData.permission_level === 3 && 'Gestor: pot crear i visualitzar incidències'}
              {formData.permission_level === 4 && 'Visualitzador: només pot visualitzar incidències'}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="default_center_id">Centre per defecte:</label>
            <select
              id="default_center_id"
              name="default_center_id"
              value={formData.default_center_id}
              onChange={handleInputChange}
            >
              <option value="">Cap centre per defecte</option>
              {centers.map(center => (
                <option key={center.id} value={center.id}>
                  {center.desc}
                </option>
              ))}
            </select>
          </div>

          {isEditing && (
            <>
              <div className="form-group">
                <label htmlFor="is_active">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                  />
                  Usuari actiu
                </label>
              </div>

              <div className="form-section">
                <h3>Canviar contrasenya (opcional)</h3>
                <div className="form-group">
                  <label htmlFor="password">Nova contrasenya:</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Deixa buit per mantenir la contrasenya actual"
                  />
                </div>

                {formData.password && (
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
                )}
              </div>
            </>
          )}

          {!isEditing && (
            <p className="info-message" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '4px', fontSize: '0.9rem' }}>
              <strong>Nota:</strong> La contrasenya inicial es generarà automàticament a partir del correu electrònic (la part abans de @). L'usuari haurà de canviar-la al primer inici de sessió.
            </p>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel·lar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardant...' : isEditing ? 'Guardar canvis' : 'Crear usuari'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;

