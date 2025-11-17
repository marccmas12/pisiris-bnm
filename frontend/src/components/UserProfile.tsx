import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, TicketWithRelations } from '../types';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, User as UserIcon, Ticket } from 'lucide-react';
import './UserProfile.css';

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser && currentUser.permission_level > 1) {
      navigate('/tickets');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (id) {
      loadUserData();
    }
  }, [id]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [usersData, ticketsData] = await Promise.all([
        usersAPI.getUsers(),
        usersAPI.getUserTickets(parseInt(id!))
      ]);

      const foundUser = usersData.find(u => u.id === parseInt(id!));
      if (!foundUser) {
        setError('Usuari no trobat');
        return;
      }

      setUser(foundUser);
      setTickets(ticketsData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error carregant dades de l\'usuari');
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

  const handleTicketClick = (ticketId: string) => {
    navigate(`/tickets/${ticketId}`);
  };

  if (!currentUser || currentUser.permission_level > 1) {
    return null;
  }

  if (loading) {
    return (
      <div className="user-profile">
        <div className="loading">Carregant dades de l'usuari...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="user-profile">
        <div className="error-message">{error || 'Usuari no trobat'}</div>
        <button className="btn-secondary" onClick={() => navigate('/users')}>
          <ArrowLeft size={16} />
          Tornar a gestió d'usuaris
        </button>
      </div>
    );
  }

  return (
    <div className="user-profile">
      <div className="user-profile-header">
        <button className="btn-back" onClick={() => navigate('/users')}>
          <ArrowLeft size={20} />
          Tornar
        </button>
        <h1>Perfil d'usuari</h1>
      </div>

      <div className="user-profile-content">
        <div className="user-info-card">
          <div className="user-info-header">
            <div className="user-avatar-large">
              <UserIcon size={48} />
            </div>
            <div className="user-info-title">
              <h2>{user.username}</h2>
              <span className={`permission-badge level-${user.permission_level}`}>
                {getPermissionLevelLabel(user.permission_level)}
              </span>
            </div>
          </div>

          <div className="user-info-details">
            <div className="info-row">
              <span className="info-label">Correu electrònic:</span>
              <span className="info-value">{user.email}</span>
            </div>
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
            <div className="info-row">
              <span className="info-label">Estat:</span>
              <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                {user.is_active ? 'Actiu' : 'Inactiu'}
              </span>
            </div>
          </div>
        </div>

        <div className="user-tickets-section">
          <div className="section-header">
            <h3>
              <Ticket size={20} />
              Incidències creades ({tickets.length})
            </h3>
          </div>

          {tickets.length === 0 ? (
            <div className="no-tickets">
              Aquest usuari no ha creat cap incidència o suggeriment.
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="ticket-card"
                  onClick={() => handleTicketClick(ticket.id)}
                >
                  <div className="ticket-header">
                    <span className="ticket-id">{ticket.id}</span>
                    <span className={`ticket-type ${ticket.type}`}>
                      {ticket.type === 'incidence' ? 'Incidència' : 'Suggeriment'}
                    </span>
                  </div>
                  <h4 className="ticket-title">{ticket.title}</h4>
                  <div className="ticket-meta">
                    <span className="ticket-date">
                      Creada: {new Date(ticket.creation_date).toLocaleDateString('ca-ES')}
                    </span>
                    {ticket.status && (
                      <span className="ticket-status">{ticket.status.desc}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;

