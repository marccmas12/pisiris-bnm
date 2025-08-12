import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicketWithRelations, Status, Crit, Center, Tool } from '../types';
import { ticketsAPI, referenceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  Filter, 
  ChevronUp, 
  ChevronDown, 
  Paperclip, 
  ExternalLink,
  Info,
  MoreHorizontal,
  AlertTriangle,
  AlertCircle,
  AlertOctagon
} from 'lucide-react';
import FilterDialog, { FilterValues } from './FilterDialog';
import FilterBadge from './FilterBadge';
import './TicketTable.css';

const TicketTable: React.FC = () => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [crits, setCrits] = useState<Crit[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [contentType, setContentType] = useState<'incidence' | 'suggestion'>('incidence');
  const [filters, setFilters] = useState<FilterValues>({});
  const [sortConfig, setSortConfig] = useState<{
    field: string;
    order: 'asc' | 'desc';
  } | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [descriptionPopover, setDescriptionPopover] = useState<string | null>(null);
  const [actionDropdown, setActionDropdown] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{top: boolean, left: boolean, right: boolean, x: number, y: number}>({top: false, left: false, right: false, x: 0, y: 0});
  const [dropdownPosition, setDropdownPosition] = useState<{top: boolean, left: boolean, x: number, y: number}>({top: false, left: false, x: 0, y: 0});

  const { user } = useAuth();
  const navigate = useNavigate();

  const loadReferenceData = useCallback(async () => {
    try {
      const [statusesData, critsData, centersData, toolsData] = await Promise.all([
        referenceAPI.getStatuses(),
        referenceAPI.getCrits(),
        referenceAPI.getCenters(),
        referenceAPI.getTools(),
      ]);
      setStatuses(statusesData);
      setCrits(critsData);
      setCenters(centersData);
      setTools(toolsData);
    } catch (err) {
      console.error('Error loading reference data:', err);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const response = await ticketsAPI.getTickets(
        skip,
        pageSize,
        filters.status_id,
        contentType,
        filters.crit_id,
        filters.tool_id,
        filters.center_id,
        filters.date_from,
        filters.date_to,
        sortConfig?.field,
        sortConfig?.order
      );
      setTickets(response.tickets);
      setTotalPages(Math.ceil(response.total / pageSize));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading tickets');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters, contentType, sortConfig]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleRemoveFilter = (filterKey: keyof FilterValues) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    setSortConfig(prev => {
      const newConfig: { field: string; order: 'asc' | 'desc' } = prev?.field === field 
        ? {
            field,
            order: prev.order === 'asc' ? 'desc' : 'asc'
          }
        : {
            field,
            order: 'asc'
          };
      return newConfig;
    });
    setCurrentPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortConfig?.field !== field) {
      return <ChevronUp size={16} className="sort-icon inactive" />;
    }
    return sortConfig.order === 'asc' 
      ? <ChevronUp size={16} className="sort-icon active" />
      : <ChevronDown size={16} className="sort-icon active" />;
  };

  const handleContentTypeChange = (type: 'incidence' | 'suggestion') => {
    setContentType(type);
    setCurrentPage(1);
  };

  const handleViewTicket = (ticketId: string) => {
    navigate(`/tickets/${ticketId}`);
  };

  const handleEditTicket = (ticketId: string) => {
    navigate(`/tickets/${ticketId}/edit`);
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) {
      return;
    }

    try {
      await ticketsAPI.deleteTicket(ticketId);
      loadTickets();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error deleting ticket');
    }
  };

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'created': return '#17a2b8';
      case 'reviewed': return '#ffc107';
      case 'resolving': return '#007bff';
      case 'notified': return '#28a745';
      case 'discarted': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getCritIcon = (critValue: string) => {
    switch (critValue) {
      case 'low': return <AlertCircle size={16} />;
      case 'mid': return <AlertTriangle size={16} />;
      case 'high': return <AlertOctagon size={16} />;
      case 'critical': return <AlertTriangle size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const getCritTooltip = (critValue: string) => {
    const crit = crits.find(c => c.value === critValue);
    return crit?.desc || critValue;
  };

  const handleDescriptionClick = (description: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (descriptionPopover === description) {
      setDescriptionPopover(null);
      setPopoverPosition({top: false, left: false, right: false, x: 0, y: 0});
      return;
    }

    // Calculate position
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const shouldShowTop = rect.bottom + 200 > viewportHeight; // 200px for popover height
    const shouldShowLeft = rect.left + 150 > viewportWidth; // 150px for popover width
    const shouldShowRight = rect.right - 150 < 0; // 150px for popover width
    
    // Calculate coordinates
    let x = rect.left + (rect.width / 2);
    let y = shouldShowTop ? rect.top - 200 : rect.bottom;
    
    if (shouldShowLeft) {
      x = rect.right - 150;
    } else if (shouldShowRight) {
      x = rect.left;
    }
    
    setPopoverPosition({
      top: shouldShowTop,
      left: shouldShowLeft,
      right: shouldShowRight,
      x: x,
      y: y
    });
    setDescriptionPopover(description);
  };

  const handleActionDropdown = (ticketId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (actionDropdown === ticketId) {
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
    setActionDropdown(ticketId);
  };

  const closePopovers = () => {
    setDescriptionPopover(null);
    setActionDropdown(null);
    setPopoverPosition({top: false, left: false, right: false, x: 0, y: 0});
    setDropdownPosition({top: false, left: false, x: 0, y: 0});
  };



  if (loading && tickets.length === 0) {
    return <div className="loading">Loading tickets...</div>;
  }

  return (
    <div className="ticket-table-container" onClick={closePopovers}>
      <div className="table-header">
        <div className="header-content">
          <h2>{contentType === 'incidence' ? 'Incidències' : 'Suggeriments'}</h2>
          <div className="content-switcher">
            <button
              className={`switcher-button ${contentType === 'incidence' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('incidence')}
            >
              Incidències
            </button>
            <button
              className={`switcher-button ${contentType === 'suggestion' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('suggestion')}
            >
              Suggeriments
            </button>
          </div>
        </div>
        {user && user.permission_level <= 2 && (
          <button 
            className="create-button"
            onClick={() => navigate(`/tickets/create/${contentType}`)}
          >
            <Plus size={16} />
            Crear {contentType === 'incidence' ? 'Incidència' : 'Suggeriment'}
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filter-controls">
        <button
          className="filter-button"
          onClick={() => setIsFilterDialogOpen(true)}
        >
          <Filter size={16} />
          Filtres
        </button>
      </div>

      <FilterBadge
        filters={filters}
        referenceData={{ statuses, crits, centers, tools }}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
      />

      <div className="table-wrapper">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Criticitat</th>
              <th>ID</th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('title')}
              >
                <div className="header-content">
                  Títol
                  {getSortIcon('title')}
                </div>
              </th>
              <th></th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('status')}
              >
                <div className="header-content">
                  Estat
                  {getSortIcon('status')}
                </div>
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('creation_date')}
              >
                <div className="header-content">
                  Data Creació
                  {getSortIcon('creation_date')}
                </div>
              </th>
              <th>Eina</th>
              <th>Adjunts</th>
              <th>URL</th>
              <th>Accions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => (
              <tr key={ticket.id}>
                <td className="criticity-cell">
                  <div 
                    className="criticity-icon"
                    title={getCritTooltip(ticket.crit.value)}
                  >
                    {getCritIcon(ticket.crit.value)}
                  </div>
                </td>
                <td className="internal-id">#{ticket.id}</td>
                <td className="title-cell">{ticket.title}</td>
                <td className="description-cell">
                  {ticket.description && (
                    <button
                      className="description-button"
                      onClick={(e) => handleDescriptionClick(ticket.description!, e)}
                      title="Veure descripció"
                    >
                      <Info size={16} />
                    </button>
                  )}
                  {descriptionPopover === ticket.description && (
                    <div className={`description-popover ${popoverPosition.top ? 'top' : ''} ${popoverPosition.left ? 'left' : ''} ${popoverPosition.right ? 'right' : ''}`} style={{ top: popoverPosition.y, left: popoverPosition.x }}>
                      {ticket.description}
                    </div>
                  )}
                </td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(ticket.status.value) }}
                  >
                    {ticket.status.desc}
                  </span>
                </td>
                <td>{new Date(ticket.creation_date).toLocaleDateString()}</td>
                <td>{ticket.tool.desc}</td>
                <td className="attachments-cell">
                  {ticket.attached && ticket.attached.length > 0 ? (
                    <div className="attachments-indicator">
                      <Paperclip size={16} />
                      <span className="attachment-count">{ticket.attached.length}</span>
                    </div>
                  ) : (
                    <span className="no-attachments">-</span>
                  )}
                </td>
                <td className="url-cell">
                  {ticket.url ? (
                    <button
                      className="url-button"
                      onClick={() => window.open(ticket.url, '_blank')}
                      title={ticket.url}
                    >
                      <ExternalLink size={16} />
                    </button>
                  ) : (
                    <span className="no-url">-</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-button view"
                      onClick={() => handleViewTicket(ticket.id)}
                      title="Veure detalls"
                    >
                      <Eye size={16} />
                    </button>
                    {user && user.permission_level <= 1 && (
                      <div className="multiaction-container">
                        <button
                          className="action-button multiaction"
                          onClick={(e) => handleActionDropdown(ticket.id, e)}
                          title="Més accions"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {actionDropdown === ticket.id && (
                          <div className={`action-dropdown ${dropdownPosition.top ? 'top' : ''} ${dropdownPosition.left ? 'left' : ''}`} style={{ top: dropdownPosition.y, left: dropdownPosition.x }}>
                            <button
                              className="dropdown-item edit"
                              onClick={() => handleEditTicket(ticket.id)}
                            >
                              <Edit size={16} />
                              Editar
                            </button>
                            <button
                              className="dropdown-item delete"
                              onClick={() => handleDeleteTicket(ticket.id)}
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tickets.length === 0 && !loading && (
        <div className="no-tickets">No s'han trobat {contentType === 'incidence' ? 'incidències' : 'suggeriments'}</div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Anterior
          </button>
          <span className="page-info">
            Pàgina {currentPage} de {totalPages}
          </span>
          <button
            className="pagination-button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Següent
          </button>
        </div>
      )}

      <FilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  );
};

export default TicketTable; 