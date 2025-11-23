import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import logo from '../assets/images/Logo_DAPMN.jpeg';
import { usersAPI, referenceAPI } from '../services/api';
import { ProfileCompleteRequest, Center } from '../types';
import './Login.css';

type LoginStep = 'login' | 'change-password' | 'complete-profile';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<LoginStep>('login');
  
  // Password change form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Profile completion form
  const [profileData, setProfileData] = useState<ProfileCompleteRequest>({
    name: '',
    surnames: '',
    role: '',
    default_center_id: undefined,
    phone: '',
    worktime: ''
  });
  
  const [centers, setCenters] = useState<Center[]>([]);
  
  const { login, isAuthenticated, loading: authLoading, user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Fetch centers when component mounts
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centersData = await referenceAPI.getCenters();
        setCenters(centersData);
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // Handle navigation and step changes based on user state
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.must_change_password) {
        setCurrentStep('change-password');
      } else if (user.must_complete_profile) {
        setCurrentStep('complete-profile');
      } else {
      navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  // Only show loading spinner during initial auth check
  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  // If authenticated but still on login page, they need to complete setup
  // Don't redirect yet - let the forms show

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowInactiveModal(false);

    try {
      await login(username, password);
      // After successful login, the useEffect will handle the redirect or next steps
    } catch (err: any) {
      if (err.response?.data?.detail === 'user_inactive') {
        setShowInactiveModal(true);
      } else {
        setError(err.response?.data?.detail || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 6) {
      setError('La contrasenya ha de tenir almenys 6 caràcters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Les contrasenyes no coincideixen');
      return;
    }

    setLoading(true);
    try {
      await usersAPI.changeFirstPassword({ new_password: newPassword });
      await refreshUser();
      // The useEffect will handle next step or redirect
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error canviant la contrasenya');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!profileData.name || !profileData.surnames || !profileData.role) {
      setError('Si us plau, omple tots els camps obligatoris');
      return;
    }

    setLoading(true);
    try {
      await usersAPI.completeProfile(profileData);
      await refreshUser();
      // The useEffect will handle redirect
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error completant el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Convert default_center_id to number if it's that field
    const processedValue = name === 'default_center_id' ? (value ? parseInt(value, 10) : undefined) : value;
    setProfileData(prev => ({ ...prev, [name]: processedValue }));
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img
          src={logo}
          alt="Logo"
          className="logo"
          style={{
            display: 'block',
            margin: '0 auto 1.5rem auto',
            maxWidth: '250px',
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
        <h1>Gestor d'incidències i Suggeriments</h1>
        
        {currentStep === 'login' && (
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Usuari</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasenya</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Iniciant sessió...' : 'Iniciar sessió'}
          </button>
          <p className="login-footer" style={{ fontSize: '0.85rem', textAlign: 'center', color: 'var(--color-text-secondary, #888)' }}>
            Si no teniu usuari, i creieu que n'haurieu de tenir un, podeu demanar-ne un al referent territorial. Feu-ho a través de WhatsApp al número 677110351 o per correu electrònic a <a href="mailto:dapmn@dapmn.cat">ticprimariabnm.ics@gencat.cat</a>
          </p>
        </form>
        )}

        {currentStep === 'change-password' && (
          <form onSubmit={handlePasswordChange} className="login-form">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Canvia la teva contrasenya</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
              Per seguretat, has de canviar la contrasenya temporal.
            </p>
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="newPassword">Nova contrasenya *</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Mínim 6 caràcters"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirma la contrasenya *</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Repeteix la contrasenya"
              />
            </div>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Guardant...' : 'Canviar contrasenya'}
            </button>
          </form>
        )}

        {currentStep === 'complete-profile' && (
          <form onSubmit={handleProfileComplete} className="login-form">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Completa el teu perfil</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
              Si us plau, completa la informació del teu perfil per continuar.
            </p>
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="name">Nom *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={profileData.name}
                onChange={handleProfileInputChange}
                required
                disabled={loading}
                placeholder="El teu nom"
              />
            </div>

            <div className="form-group">
              <label htmlFor="surnames">Cognoms *</label>
              <input
                type="text"
                id="surnames"
                name="surnames"
                value={profileData.surnames}
                onChange={handleProfileInputChange}
                required
                disabled={loading}
                placeholder="Els teus cognoms"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Rol *</label>
              <select
                id="role"
                name="role"
                value={profileData.role}
                onChange={handleProfileInputChange}
                required
                disabled={loading}
              >
                <option value="">Selecciona un rol</option>
                <option value="administratiu">Administratiu</option>
                <option value="Metge de familia">Metge de familia</option>
                <option value="Infermeria">Infermeria</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="default_center_id">Centre per defecte (recomanat)</label>
              <select
                id="default_center_id"
                name="default_center_id"
                value={profileData.default_center_id || ''}
                onChange={handleProfileInputChange}
                disabled={loading}
              >
                <option value="">Selecciona un centre</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.desc}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="phone">Telèfon (recomanat)</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={profileData.phone}
                onChange={handleProfileInputChange}
                disabled={loading}
                placeholder="El teu número de telèfon"
              />
            </div>

            <div className="form-group">
              <label htmlFor="worktime">Horari laboral (recomanat)</label>
              <textarea
                id="worktime"
                name="worktime"
                value={profileData.worktime}
                onChange={handleProfileInputChange}
                disabled={loading}
                placeholder="Descriu el teu horari de treball"
                rows={3}
              />
            </div>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Guardant...' : 'Completar perfil'}
            </button>
          </form>
        )}
      </div>

      {showInactiveModal && (
        <div className="modal-overlay" onClick={() => setShowInactiveModal(false)}>
          <div className="modal-content inactive-user-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Usuari desactivat</h2>
              <button className="modal-close" onClick={() => setShowInactiveModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                El vostre usuari ha estat desactivat. Si creieu que això és incorrecte, 
                podeu contactar amb el responsable de l'aplicació per sol·licitar la reactivació.
              </p>
              <p>
                Contacte: <a href="mailto:ticprimariabnm.ics@gencat.cat">ticprimariabnm.ics@gencat.cat</a>
              </p>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                onClick={() => setShowInactiveModal(false)} 
                className="btn-primary"
              >
                Entesos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login; 