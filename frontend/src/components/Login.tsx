import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import logo from '../assets/images/Logo_DAPMN.jpeg';
import './Login.css';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/tickets', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Don't render login form if still loading or already authenticated
  if (authLoading || isAuthenticated) {
    return <div className="loading">Loading...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowInactiveModal(false);

    try {
      await login(username, password);
      // After successful login, the useEffect will handle the redirect
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