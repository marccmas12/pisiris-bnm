import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TicketWithRelations, Status, Crit, Center, Tool } from '../types';
import { ticketsAPI, referenceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
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
  AlertOctagon,
  Search,
  X,
  MessageSquare
} from 'lucide-react';
import FilterDialog, { FilterValues } from './FilterDialog';
import FilterBadge from './FilterBadge';
import './TicketTable.css';

const TicketTable: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper function to initialize state from URL parameters (called synchronously)
  const getInitialStateFromURL = () => {
    const typeParam = searchParams.get('type') as 'incidence' | 'suggestion' | null;
    const contentType = (typeParam === 'incidence' || typeParam === 'suggestion') ? typeParam : 'incidence';

    const pageParam = searchParams.get('page');
    const currentPage = pageParam ? (() => {
      const page = parseInt(pageParam, 10);
      return (!isNaN(page) && page > 0) ? page : 1;
    })() : 1;

    const searchQuery = searchParams.get('search') || '';
    const showHidden = searchParams.get('showHidden') === 'true';

    const sortByParam = searchParams.get('sortBy');
    const sortOrderParam = searchParams.get('sortOrder');
    const sortConfig = (sortByParam && sortOrderParam) ? {
      field: sortByParam,
      order: sortOrderParam as 'asc' | 'desc'
    } : null;

    // Parse filters from URL
    const filters: FilterValues = {};
    const statusIdParam = searchParams.get('status_id');
    if (statusIdParam) {
      const statusId = parseInt(statusIdParam, 10);
      if (!isNaN(statusId)) filters.status_id = statusId;
    }
    const critIdParam = searchParams.get('crit_id');
    if (critIdParam) {
      const critId = parseInt(critIdParam, 10);
      if (!isNaN(critId)) filters.crit_id = critId;
    }
    const toolIdParam = searchParams.get('tool_id');
    if (toolIdParam) {
      const toolId = parseInt(toolIdParam, 10);
      if (!isNaN(toolId)) filters.tool_id = toolId;
    }
    const centerIdParam = searchParams.get('center_id');
    if (centerIdParam) {
      const centerId = parseInt(centerIdParam, 10);
      if (!isNaN(centerId)) filters.center_id = centerId;
    }
    const dateFromParam = searchParams.get('date_from');
    if (dateFromParam) filters.date_from = dateFromParam;
    const dateToParam = searchParams.get('date_to');
    if (dateToParam) filters.date_to = dateToParam;

    return { contentType, currentPage, searchQuery, showHidden, sortConfig, filters };
  };

  // Initialize state from URL parameters synchronously
  const initialState = getInitialStateFromURL();

  const [contentType, setContentType] = useState<'incidence' | 'suggestion'>(initialState.contentType);
  const [filters, setFilters] = useState<FilterValues>(initialState.filters);
  const [sortConfig, setSortConfig] = useState<{
    field: string;
    order: 'asc' | 'desc';
  } | null>(initialState.sortConfig);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [showHidden, setShowHidden] = useState(initialState.showHidden);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [crits, setCrits] = useState<Crit[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasSearchInputFocusedRef = useRef(false);
  const cursorPositionRef = useRef<number | null>(null);
  const [descriptionPopover, setDescriptionPopover] = useState<string | null>(null);
  const [actionDropdown, setActionDropdown] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{top: boolean, left: boolean, right: boolean, x: number, y: number}>({top: false, left: false, right: false, x: 0, y: 0});
  const [dropdownPosition, setDropdownPosition] = useState<{top: boolean, left: boolean, x: number, y: number}>({top: false, left: false, x: 0, y: 0});

  // Sync state from URL when URL changes (for browser back/forward)
  // Use a ref to track if this is the initial mount
  const isInitialMount = useRef(true);
  const prevSearchParamsString = useRef(searchParams.toString());
  
  useEffect(() => {
    // Skip on initial mount since we already initialized from URL synchronously
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevSearchParamsString.current = searchParams.toString();
      return;
    }

    // Only sync if URL actually changed (not from our own updates)
    const currentParamsString = searchParams.toString();
    if (currentParamsString === prevSearchParamsString.current) {
      return;
    }
    prevSearchParamsString.current = currentParamsString;

    const urlState = getInitialStateFromURL();
    
    // Update state from URL (for browser back/forward)
    setContentType(urlState.contentType);
    setCurrentPage(urlState.currentPage);
    setSearchQuery(urlState.searchQuery);
    setShowHidden(urlState.showHidden);
    setSortConfig(urlState.sortConfig);
    setFilters(urlState.filters);
  }, [searchParams]); // Only re-run when searchParams object changes

  // Helper function to update URL with current state
  const updateURL = useCallback((updates: {
    type?: 'incidence' | 'suggestion';
    page?: number;
    search?: string;
    showHidden?: boolean;
    sortBy?: string | null;
    sortOrder?: string | null;
    filters?: FilterValues;
  }) => {
    const newParams = new URLSearchParams(searchParams);

    if (updates.type !== undefined) {
      if (updates.type === 'incidence') {
        newParams.set('type', 'incidence');
      } else {
        newParams.set('type', 'suggestion');
      }
    }

    if (updates.page !== undefined) {
      if (updates.page === 1) {
        newParams.delete('page');
      } else {
        newParams.set('page', updates.page.toString());
      }
    }

    if (updates.search !== undefined) {
      if (updates.search === '') {
        newParams.delete('search');
      } else {
        newParams.set('search', updates.search);
      }
    }

    if (updates.showHidden !== undefined) {
      if (updates.showHidden) {
        newParams.set('showHidden', 'true');
      } else {
        newParams.delete('showHidden');
      }
    }

    if (updates.sortBy !== undefined) {
      if (updates.sortBy === null) {
        newParams.delete('sortBy');
        newParams.delete('sortOrder');
      } else {
        newParams.set('sortBy', updates.sortBy);
        if (updates.sortOrder) {
          newParams.set('sortOrder', updates.sortOrder);
        }
      }
    }

    if (updates.filters !== undefined) {
      // Remove existing filter params
      ['status_id', 'crit_id', 'tool_id', 'center_id', 'date_from', 'date_to'].forEach(key => {
        newParams.delete(key);
      });

      // Add new filter params
      Object.entries(updates.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          newParams.set(key, value.toString());
        }
      });
    }

    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
        sortConfig?.order,
        searchQuery?.trim() || undefined,
        showHidden
      );
      setTickets(response.tickets);
      setTotalPages(Math.ceil(response.total / pageSize));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading tickets');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters, contentType, sortConfig, searchQuery, showHidden]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Maintain focus on search input after re-renders when user is typing
  useEffect(() => {
    if (wasSearchInputFocusedRef.current && searchInputRef.current) {
      // Restore focus and cursor position after re-render
      const position = cursorPositionRef.current ?? searchQuery.length;
      searchInputRef.current.focus();
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (searchInputRef.current) {
          searchInputRef.current.setSelectionRange(position, position);
        }
      });
    }
  }, [tickets, searchQuery]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1);
    updateURL({ filters: newFilters, page: 1 });
  };

  const handleRemoveFilter = (filterKey: keyof FilterValues) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];
      updateURL({ filters: newFilters, page: 1 });
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
    updateURL({ filters: {}, page: 1 });
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
      updateURL({ sortBy: newConfig.field, sortOrder: newConfig.order, page: 1 });
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

  const handleViewTicket = (ticketId: string) => {
    // Preserve current query parameters when navigating to ticket detail
    const currentParams = searchParams.toString();
    const url = currentParams ? `/tickets/${ticketId}?return=${encodeURIComponent(`/tickets?${currentParams}`)}` : `/tickets/${ticketId}`;
    navigate(url);
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

  const getCritColorClass = (critValue: string) => {
    switch (critValue) {
      case 'low': return 'crit-low';
      case 'mid': return 'crit-mid';
      case 'high': return 'crit-high';
      case 'critical': return 'crit-critical';
      default: return 'crit-low';
    }
  };

  const getCritTooltip = (critValue: string) => {
    const crit = crits.find(c => c.value === critValue);
    return crit?.desc || critValue;
  };

  const handleDescriptionHover = (description: string, event: React.MouseEvent) => {
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

  const handleDescriptionLeave = () => {
    setDescriptionPopover(null);
    setPopoverPosition({top: false, left: false, right: false, x: 0, y: 0});
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

  if (loading && tickets.length === 0) {
    return <div className="loading">Loading tickets...</div>;
  }

  return (
    <div className="ticket-table-container">
      {error && <div className="error-message">{error}</div>}

      <div className="filter-controls">
        <button
          className="filter-button"
          onClick={() => setIsFilterDialogOpen(true)}
        >
          <Filter size={16} />
          Filtres
        </button>
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Buscar en títol, descripció, eina, persones, notificador, usuari, ID de ticket i número de ticket..."
              value={searchQuery}
              onFocus={(e) => {
                wasSearchInputFocusedRef.current = true;
                cursorPositionRef.current = e.target.selectionStart;
              }}
              onBlur={() => {
                // Only mark as unfocused if the user actually clicked away (not just re-render)
                setTimeout(() => {
                  if (document.activeElement !== searchInputRef.current) {
                    wasSearchInputFocusedRef.current = false;
                    cursorPositionRef.current = null;
                  }
                }, 100);
              }}
              onKeyUp={(e) => {
                // Update cursor position after any key press
                if (searchInputRef.current) {
                  cursorPositionRef.current = searchInputRef.current.selectionStart;
                }
              }}
              onMouseUp={(e) => {
                // Update cursor position after mouse click
                if (searchInputRef.current) {
                  cursorPositionRef.current = searchInputRef.current.selectionStart;
                }
              }}
              onChange={(e) => {
                wasSearchInputFocusedRef.current = true;
                // Save cursor position from the input element
                const target = e.target as HTMLInputElement;
                // The browser automatically adjusts cursor position, so use the current position
                cursorPositionRef.current = target.selectionStart;
                const value = target.value;
                setSearchQuery(value);
                setCurrentPage(1);
                updateURL({ search: value, page: 1 });
              }}
            />
            {searchQuery && (
              <button
                className="search-clear-button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                  updateURL({ search: '', page: 1 });
                }}
                title="Netejar cerca"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <button
          className={`toggle-hidden-button ${showHidden ? 'active' : ''}`}
          onClick={() => {
            const newValue = !showHidden;
            setShowHidden(newValue);
            setCurrentPage(1);
            updateURL({ showHidden: newValue, page: 1 });
          }}
          title={showHidden ? "Amagar tickets ocults" : "Mostrar tickets ocults"}
        >
          Mostra els ocults
        </button>
        {user && user.permission_level <= 3 && (
          <button 
            className="create-button"
            onClick={() => navigate(`/tickets/create/${contentType}`)}
          >
            <Plus size={16} />
            Crear {contentType === 'incidence' ? 'Incidència' : 'Suggeriment'}
          </button>
        )}
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
              <th> </th>
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
              <th>Comentaris</th>
              <th>Accions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => (
              <tr 
                key={ticket.id}
                className="ticket-row"
                onClick={() => handleViewTicket(ticket.id)}
              >
                <td className="criticity-cell">
                  <div 
                    className={`criticity-icon ${getCritColorClass(ticket.crit.value)}`}
                    title={getCritTooltip(ticket.crit.value)}
                  >
                    {getCritIcon(ticket.crit.value)}
                  </div>
                </td>
                <td className="internal-id">#{ticket.id}</td>
                <td className="title-cell">{ticket.title}</td>
                <td className="description-cell">
                  {ticket.description && (
                    <div
                      className="description-button"
                      onMouseEnter={(e) => handleDescriptionHover(ticket.description!, e)}
                      onMouseLeave={handleDescriptionLeave}
                      onClick={(e) => e.stopPropagation()}
                      title="Veure descripció"
                    >
                      <Info size={16} />
                    </div>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(ticket.url, '_blank');
                      }}
                      title={ticket.url}
                    >
                      <ExternalLink size={16} />
                    </button>
                  ) : (
                    <span className="no-url">-</span>
                  )}
                </td>
                <td className="comments-cell">
                  {ticket.comments_count && ticket.comments_count > 0 ? (
                    <div className="comments-indicator">
                      <MessageSquare size={16} />
                      <span className="comment-count">{ticket.comments_count}</span>
                    </div>
                  ) : (
                    <span className="no-comments">-</span>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="action-buttons">
                    {user && user.permission_level <= 2 && (
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
            onClick={() => {
              const newPage = currentPage - 1;
              setCurrentPage(newPage);
              updateURL({ page: newPage });
            }}
          >
            Anterior
          </button>
          <span className="page-info">
            Pàgina {currentPage} de {totalPages}
          </span>
          <button
            className="pagination-button"
            disabled={currentPage === totalPages}
            onClick={() => {
              const newPage = currentPage + 1;
              setCurrentPage(newPage);
              updateURL({ page: newPage });
            }}
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