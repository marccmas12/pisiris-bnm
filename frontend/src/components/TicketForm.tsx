import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TicketCreate, TicketUpdate, Status, Crit, Center, Tool, FileAttachment } from '../types';
import { ticketsAPI, referenceAPI, modificationsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Paperclip, X, Download, Trash2 } from 'lucide-react';
import './TicketForm.css';

const TicketForm: React.FC = () => {
  const { id, type } = useParams<{ id: string; type: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [formData, setFormData] = useState<TicketCreate>({
    ticket_num: '',
    type: (type as 'incidence' | 'suggestion') || 'incidence',
    title: '',
    description: '',
    url: '',
    status_id: 1,
    crit_id: 1,
    center_id: undefined,
    tool_id: 1, // Now required, default to first tool
    notifier: '',
    people: [''],
    pathway: 'web', // Default pathway
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [crits, setCrits] = useState<Crit[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<FileAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [modificationReason, setModificationReason] = useState('');
  const [pendingSubmitData, setPendingSubmitData] = useState<TicketUpdate | null>(null);

  const loadReferenceData = useCallback(async () => {
    console.log('🔄 Loading reference data...');
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
      
      // Set default tool_id to first available tool
      if (toolsData.length > 0 && !isEditing) {
        setFormData(prev => ({ ...prev, tool_id: toolsData[0].id }));
      }
      console.log('✅ Reference data loaded successfully');
    } catch (err) {
      console.error('❌ Error loading reference data:', err);
    }
  }, []); // Remove isEditing dependency

  const loadTicket = useCallback(async () => {
    if (!id) return;
    
    console.log('🔄 Loading ticket data...', { id });
    try {
      setLoading(true);
      const ticket = await ticketsAPI.getTicket(id);  // id is now string
      setFormData({
        ticket_num: ticket.ticket_num || '',
        type: ticket.type,
        title: ticket.title,
        description: ticket.description,
        url: ticket.url || '',
        status_id: ticket.status_id,
        crit_id: ticket.crit_id,
        center_id: ticket.center_id,
        tool_id: ticket.tool_id,
        notifier: ticket.notifier || '',
        people: ticket.people,
        pathway: ticket.pathway,
      });
      setExistingAttachments(ticket.attached || []);
      console.log('✅ Ticket data loaded successfully');
    } catch (err: any) {
      console.error('❌ Error loading ticket:', err);
      setError(err.response?.data?.detail || 'Error loading ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Refresh user data and load reference data on mount
  useEffect(() => {
    console.log('🚀 Initializing form...');
    const initializeForm = async () => {
      await refreshUser(); // Refresh user data to get latest default center
      await loadReferenceData();
    };
    
    initializeForm();
  }, []); // Only run once on mount

  // Load ticket data when editing
  useEffect(() => {
    console.log('🔄 useEffect: Loading ticket data', { isEditing, id });
    if (isEditing && id) {
      loadTicket();
    }
  }, [isEditing, id]); // Only depend on isEditing and id

  // Set initial form data for new tickets
  useEffect(() => {
    console.log('🔄 useEffect: Setting initial form data', { type, isEditing, userDefaultCenter: user?.default_center_id });
    if (type && !isEditing) {
      // Set the type from URL parameter for new tickets
      setFormData(prev => ({ 
        ...prev, 
        type: type as 'incidence' | 'suggestion',
        center_id: user?.default_center_id || undefined
      }));
    }
  }, [type, isEditing, user?.default_center_id]);

  // Update center_id when user's default center changes (only for new tickets)
  useEffect(() => {
    console.log('🔄 useEffect: Updating center_id', { isEditing, userDefaultCenter: user?.default_center_id });
    if (!isEditing && user?.default_center_id !== undefined) {
      setFormData(prev => ({ ...prev, center_id: user.default_center_id }));
    }
  }, [user?.default_center_id, isEditing]);

  const handleInputChange = (field: keyof TicketCreate, value: string | number | string[]) => {
    if (field === 'center_id' && value === 0) {
      setFormData(prev => ({ ...prev, [field]: undefined }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePeopleChange = (index: number, value: string) => {
    const newPeople = [...formData.people];
    newPeople[index] = value;
    setFormData(prev => ({ ...prev, people: newPeople }));
  };

  const addPerson = () => {
    setFormData(prev => ({ ...prev, people: [...prev.people, ''] }));
  };

  const removePerson = (index: number) => {
    if (formData.people.length > 1) {
      const newPeople = formData.people.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, people: newPeople }));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = async (filePath: string) => {
    if (!id) return;
    
    console.log('🔄 Attempting to delete attachment:', { id, filePath });
    console.log('🔐 Current user:', user);
    console.log('🔑 User permission level:', user?.permission_level);
    
    // Log the original attachment data for debugging
    const attachment = existingAttachments.find(att => att.path === decodeURIComponent(filePath));
    console.log('📎 Original attachment data:', attachment);
    console.log('📁 Original path:', attachment?.path);
    console.log('📄 Original name:', attachment?.original_name);
    
    try {
      const result = await ticketsAPI.deleteAttachment(id, filePath);
      console.log('Delete attachment result:', result);
      setExistingAttachments(prev => prev.filter(att => att.path !== filePath));
      setError(''); // Clear any previous errors
      
      // Show success message
      console.log('Attachment deleted successfully');
      
      // Optionally reload the ticket to ensure consistency
      try {
        const updatedTicket = await ticketsAPI.getTicket(id);
        setExistingAttachments(updatedTicket.attached || []);
      } catch (reloadErr) {
        console.warn('Failed to reload ticket after deletion:', reloadErr);
      }
    } catch (err: any) {
      console.error('Error deleting attachment:', err);
      console.error('Error response:', err.response);
      setError('Error removing attachment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const uploadFiles = async () => {
    if (!id || selectedFiles.length === 0) return;
    
    setUploadingFiles(true);
    try {
      // Use the new multiple file upload endpoint
      const result = await ticketsAPI.uploadFiles(id, selectedFiles);
      
      if (result.total_failed > 0) {
        // Show warnings for failed uploads
        const failedNames = result.failed_uploads.map((f: any) => f.filename).join(', ');
        setError(`Some files failed to upload: ${failedNames}`);
      } else {
        setError(''); // Clear any previous errors
      }
      
      setSelectedFiles([]);
      
      // Reload ticket to get updated attachments
      const updatedTicket = await ticketsAPI.getTicket(id);
      setExistingAttachments(updatedTicket.attached || []);
      
      // Show success message
      if (result.total_uploaded > 0) {
        // You could add a success notification here
        console.log(`Successfully uploaded ${result.total_uploaded} files`);
      }
      
    } catch (err: any) {
      setError('Error uploading files: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploadingFiles(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Filter out empty people entries
    const filteredPeople = formData.people.filter(p => p.trim() !== '');
    if (filteredPeople.length === 0) {
      setError('Almenys una persona ha d\'estar implicada');
      setLoading(false);
      return;
    }

    const submitData = {
      ...formData,
      people: filteredPeople
    };

    try {
      if (isEditing) {
        // For editing, show modification reason modal first
        setPendingSubmitData(submitData as TicketUpdate);
        setShowModificationModal(true);
        setLoading(false);
        return;
      } else {
        // For new tickets, create the ticket first
        const newTicket = await ticketsAPI.createTicket(submitData);
        
        // If there are selected files, upload them to the new ticket
        if (selectedFiles.length > 0 && user && user.permission_level <= 2) {
          try {
            setUploadingFiles(true);
            const result = await ticketsAPI.uploadFiles(newTicket.id, selectedFiles);
            
            if (result.total_failed > 0) {
              // Show warnings for failed uploads but don't block navigation
              const failedNames = result.failed_uploads.map((f: any) => f.filename).join(', ');
              console.warn(`Some files failed to upload: ${failedNames}`);
            }
            
            if (result.total_uploaded > 0) {
              console.log(`Successfully uploaded ${result.total_uploaded} files`);
            }
          } catch (uploadErr: any) {
            // Log upload errors but don't block navigation
            console.error('Error uploading files:', uploadErr);
          } finally {
            setUploadingFiles(false);
          }
        }
        
        navigate('/tickets');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error saving ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/tickets');
  };

  const handleModificationSubmit = async () => {
    if (!pendingSubmitData || !modificationReason.trim()) return;
    
    setLoading(true);
    try {
      // Create the modification first
      await modificationsAPI.createModification(id!, modificationReason);
      
      // Then update the ticket
      await ticketsAPI.updateTicket(id!, pendingSubmitData);
      
      navigate('/tickets');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error saving ticket');
    } finally {
      setLoading(false);
      setShowModificationModal(false);
      setModificationReason('');
      setPendingSubmitData(null);
    }
  };

  const handleModificationCancel = () => {
    setShowModificationModal(false);
    setModificationReason('');
    setPendingSubmitData(null);
    setLoading(false);
  };

  if (loading && isEditing) {
    return <div className="loading">Loading ticket...</div>;
  }

  const getTypeLabel = (type: string) => {
    return type === 'incidence' ? 'Incidència' : 'Suggeriment';
  };

  return (
    <div className="ticket-form-container">
      <div className="form-header">
        <h2>{isEditing ? 'Editar Ticket' : `Crear Nova ${getTypeLabel(formData.type)}`}</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {uploadingFiles && !isEditing && (
        <div className="info-message">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Pujant fitxers al ticket nou...</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="ticket-form">
        {/* Type Selection - Content Split Component */}
        {!isEditing && (
          <div className="type-selection">
            <h3>Selecciona el tipus de ticket</h3>
            <div className="type-buttons">
              <button
                type="button"
                className={`type-button ${formData.type === 'incidence' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, type: 'incidence' }))}
                disabled={loading || uploadingFiles}
              >
                Incidències
              </button>
              <button
                type="button"
                className={`type-button ${formData.type === 'suggestion' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, type: 'suggestion' }))}
                disabled={loading || uploadingFiles}
              >
                Suggeriments
              </button>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ticket_num">Número de Ticket Extern (Opcional)</label>
            <input
              type="text"
              id="ticket_num"
              value={formData.ticket_num}
              onChange={(e) => handleInputChange('ticket_num', e.target.value)}
              placeholder="Ex: JIRA-123, SN-456, etc."
              disabled={loading || uploadingFiles}
            />
            <small className="field-help">
              Número de ticket d'una plataforma externa (JIRA, ServiceNow, etc.)
            </small>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="title">Títol *</label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            required
            disabled={loading || uploadingFiles}
            placeholder="Introdueix el títol del ticket"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Descripció *</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            required
            disabled={loading || uploadingFiles}
            placeholder="Introdueix la descripció detallada"
            rows={5}
          />
        </div>

        <div className="form-group">
          <label htmlFor="url">URL (Opcional)</label>
          <input
            type="url"
            id="url"
            value={formData.url}
            onChange={(e) => handleInputChange('url', e.target.value)}
            disabled={loading || uploadingFiles}
            placeholder="https://example.com"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="status_id">Estat *</label>
            <select
              id="status_id"
              value={formData.status_id}
              onChange={(e) => handleInputChange('status_id', parseInt(e.target.value))}
              required
              disabled={loading || uploadingFiles}
            >
              {statuses.map(status => (
                <option key={status.id} value={status.id}>
                  {status.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="crit_id">Prioritat *</label>
            <select
              id="crit_id"
              value={formData.crit_id}
              onChange={(e) => handleInputChange('crit_id', parseInt(e.target.value))}
              required
              disabled={loading || uploadingFiles}
            >
              {crits.map(crit => (
                <option key={crit.id} value={crit.id}>
                  {crit.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="center_id">Centre (Opcional)</label>
            <select
              id="center_id"
              value={formData.center_id || ''}
              onChange={(e) => handleInputChange('center_id', e.target.value ? parseInt(e.target.value) : 0)}
              disabled={loading || uploadingFiles}
            >
              <option value="">Selecciona un centre</option>
              {centers.map(center => (
                <option key={center.id} value={center.id}>
                  {center.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tool_id">Eina *</label>
            <select
              id="tool_id"
              value={formData.tool_id}
              onChange={(e) => handleInputChange('tool_id', parseInt(e.target.value))}
              required
              disabled={loading || uploadingFiles}
            >
              {tools.map(tool => (
                <option key={tool.id} value={tool.id}>
                  {tool.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notifier">Notificador (Opcional)</label>
          <input
            type="text"
            id="notifier"
            value={formData.notifier}
            onChange={(e) => handleInputChange('notifier', e.target.value)}
            disabled={loading || uploadingFiles}
            placeholder="Nom del notificador"
          />
        </div>

        <div className="form-group">
          <label>Persones Implicades *</label>
          {formData.people.map((person, index) => (
            <div key={index} className="people-input-row">
              <input
                type="text"
                value={person}
                onChange={(e) => handlePeopleChange(index, e.target.value)}
                placeholder={`Persona ${index + 1}`}
                disabled={loading || uploadingFiles}
                required={index === 0}
              />
              {formData.people.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePerson(index)}
                  className="remove-person-btn"
                  disabled={loading || uploadingFiles}
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addPerson}
            className="add-person-btn"
            disabled={loading || uploadingFiles}
          >
            Afegir Persona
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="pathway">Via de Creació *</label>
          <select
            id="pathway"
            value={formData.pathway}
            onChange={(e) => handleInputChange('pathway', e.target.value)}
            required
            disabled={loading || uploadingFiles}
          >
            <option value="web">Web</option>
            <option value="mobile">Mòbil</option>
            <option value="email">Email</option>
            <option value="phone">Telèfon</option>
            <option value="in_person">En persona</option>
          </select>
        </div>

        {/* File Attachments Section */}
        {/* Show for both new and existing tickets */}
        <>
          {/* Existing Attachments - Only show when editing */}
          {isEditing && (
            <div className="form-group">
              <label>Adjunts Existents</label>
              {existingAttachments.length > 0 ? (
                <div className="existing-attachments">
                  {existingAttachments.map((attachment, index) => (
                    <div key={index} className="attachment-item">
                      <div className="attachment-info">
                        <Paperclip size={16} />
                        <div className="attachment-details">
                          <span className="attachment-name">{attachment.original_name || attachment.filename}</span>
                          <div className="attachment-meta">
                            <span className="attachment-size">({formatFileSize(attachment.size)})</span>
                            <span className="attachment-type">• {attachment.file_type.toUpperCase()}</span>
                            <span className="attachment-uploader">• per {attachment.uploaded_by}</span>
                            <span className="attachment-date">• {new Date(attachment.uploaded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="attachment-actions">
                        <a
                          href={ticketsAPI.getFileDownloadUrl(attachment.path)}
                          download={attachment.original_name || attachment.filename}
                          className="download-button"
                          title="Descarregar"
                        >
                          <Download size={16} />
                        </a>
                        {user && user.permission_level <= 1 ? (
                          <button
                            type="button"
                            onClick={() => removeExistingAttachment(encodeURIComponent(attachment.path))}
                            className="remove-attachment-button"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="no-permission-message" title="No tens permisos per eliminar fitxers">
                            🔒
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-attachments">No hi ha adjunts</p>
              )}
            </div>
          )}

          {/* File Upload Section - Show for both new and existing tickets */}
          {user && user.permission_level <= 2 ? (
            <div className="form-group">
              <label>Afegir Adjunts</label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={loading || uploadingFiles}
                className="file-input"
                accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.bmp,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz"
              />
              <small className="field-help">
                Pots seleccionar múltiples fitxers (màxim 50MB per fitxer)
              </small>
              <small className="field-help">
                Formats acceptats: PDF, DOC, TXT, imatges, Excel, PowerPoint, arxius comprimits
              </small>
              {!isEditing && (
                <small className="field-help">
                  💡 Els fitxers seleccionats es pujaran automàticament després de crear el ticket
                </small>
              )}
            </div>
          ) : (
            <div className="permission-info">
              <small>🔒 Només els usuaris amb permisos de creació (nivell 1-2) poden pujar fitxers</small>
            </div>
          )}

          {/* Selected Files Section - Show for both new and existing tickets */}
          {selectedFiles.length > 0 && user && user.permission_level <= 2 && (
            <div className="form-group">
              <label>Fitxers Seleccionats ({selectedFiles.length})</label>
              <div className="selected-files">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="selected-file-item">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({formatFileSize(file.size)})</span>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(index)}
                      className="remove-file-button"
                      disabled={loading || uploadingFiles}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={uploadFiles}
                  disabled={loading || uploadingFiles || selectedFiles.length === 0}
                  className="upload-files-button"
                >
                  {uploadingFiles ? 'Pujant...' : 'Pujar Fitxers'}
                </button>
              ) : (
                <small className="field-help">
                  Els fitxers es pujaran automàticament després de crear el ticket
                </small>
              )}
            </div>
          )}
        </>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancel}
            className="cancel-button"
            disabled={loading || uploadingFiles}
          >
            Cancel·lar
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={loading || uploadingFiles}
          >
            {loading ? 'Desant...' : uploadingFiles ? 'Pujant fitxers...' : (isEditing ? 'Actualitzar Ticket' : 'Crear Ticket')}
          </button>
        </div>
      </form>

      {/* Modification Reason Modal */}
      {showModificationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Raó de la Modificació</h3>
            </div>
            <div className="modal-body">
              <p>Si us plau, indica la raó per la qual estàs modificant aquest ticket:</p>
              <textarea
                value={modificationReason}
                onChange={(e) => setModificationReason(e.target.value)}
                placeholder="Introdueix la raó de la modificació..."
                rows={4}
                className="modification-textarea"
              />
            </div>
            <div className="modal-footer">
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleModificationCancel}
                  className="cancel-button"
                  disabled={loading}
                >
                  Cancel·lar
                </button>
                <button
                  type="button"
                  onClick={handleModificationSubmit}
                  className="submit-button"
                  disabled={loading || !modificationReason.trim()}
                >
                  {loading ? 'Desant...' : 'Guardar Modificació'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketForm; 