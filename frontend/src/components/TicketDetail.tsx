import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { TicketWithRelations, GroupedModification, CommentWithUser } from '../types';
import { ticketsAPI, modificationsAPI, commentsAPI, api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CommentForm from './CommentForm';
import CommentList from './CommentList';
import Badge from './Badge';
import './TicketDetail.css';
import { 
  ArrowLeft, 
  Edit, 
  History, 
  Paperclip, 
  Download, 
  Eye,
  Calendar,
  Clock,
  User,
  Building,
  Wrench,
  Route,
  AlertCircle,
  Lightbulb,
  X
} from 'lucide-react';

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<TicketWithRelations | null>(null);
  const [modifications, setModifications] = useState<GroupedModification[]>([]);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistoricModal, setShowHistoricModal] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [ticketData, modificationsData, commentsData] = await Promise.all([
        ticketsAPI.getTicket(id),
        modificationsAPI.getTicketModifications(id),
        commentsAPI.getTicketComments(id),
      ]);
      setTicket(ticketData);
      setModifications(modificationsData.modifications);
      setComments(commentsData.comments);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id) return;

    try {
      setCommentsLoading(true);
      const commentsData = await commentsAPI.getTicketComments(id);
      setComments(commentsData.comments);
    } catch (err: any) {
      console.error('Error loading comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadTicket();
    }
  }, [id, loadTicket]);


  const getPathwayLabel = (pathway: string) => {
    const pathwayLabels: Record<string, string> = {
      'web': 'Web',
      'mobile': 'Mòbil',
      'email': 'Email',
      'phone': 'Telèfon',
      'in_person': 'En persona'
    };
    return pathwayLabels[pathway] || pathway;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ca-ES');
  };

  const formatFileSize = (bytes: number, decimalPoint = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimalPoint < 0 ? 0 : decimalPoint;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const isViewableFile = (fileType: string) => {
    const viewableTypes = ['pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const normalizedType = fileType.toLowerCase();
    return viewableTypes.some(type => normalizedType.includes(type));
  };

  const handleDownload = async (path: string, filename: string) => {
    if (!id) return;
    try {
      // Use the authenticated download endpoint
      const response = await api.get(`/tickets/${id}/download/${path}`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      setError(error.response?.data?.detail || 'Error downloading file');
    }
  };

  const handleView = async (path: string, contentType?: string) => {
    if (!id) return;
    try {
      // Use the view endpoint which serves files for inline viewing
      const response = await api.get(`/tickets/${id}/view/${path}`, {
        responseType: 'blob',
      });
      
      // Get content type from response headers or use provided one
      const mimeType = response.headers['content-type'] || 
                       response.headers['Content-Type'] || 
                       contentType || 
                       'application/octet-stream';
      
      // Create blob with correct MIME type for inline viewing
      const blob = new Blob([response.data], { type: mimeType });
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Open in new tab - browser will display it inline based on content type
      window.open(blobUrl, '_blank');
      // Note: We don't revoke the URL immediately as the new window needs it
      // It will be cleaned up when the window is closed
    } catch (error: any) {
      console.error('Error viewing file:', error);
      setError(error.response?.data?.detail || 'Error viewing file');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 text-lg">Carregant ticket...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-lg">Ticket no trobat</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {/* Left side - Back button and ticket info */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  // Check if there's a return URL parameter to preserve filters
                  const returnUrl = searchParams.get('return');
                  if (returnUrl) {
                    navigate(decodeURIComponent(returnUrl));
                  } else {
                    navigate('/tickets');
                  }
                }}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Ticket #{ticket.id}
                  </h1>
                  <Badge type="status" value={ticket.status.value}>
                    {ticket.status.desc}
                  </Badge>
                </div>
                <p className="text-lg text-gray-600 mt-1">{ticket.title}</p>
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowHistoricModal(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                title="Historic of changes"
              >
                <History size={16} className="text-gray-700" />
                <span className="text-sm">Traçabilitat</span>
              </button>
              {user && user.permission_level <= 2 && (
                <button
                  onClick={() => navigate(`/tickets/${ticket.id}/edit`)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                  title="Edit ticket"
                >
                  <Edit size={16} className="text-gray-700" />
                  <span className="text-sm">Edita</span>
                </button>
              )}
            </div>
          </div>

          {/* Creation and modification dates */}
          <div className="flex items-center space-x-6 mt-4 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <Calendar size={16} />
              <span>Creat el: {formatDate(ticket.creation_date)}</span>
            </div>
            {ticket.modify_date && (
              <div className="flex items-center space-x-2">
                <Clock size={16} />
                <span>Modificat el: {new Date(ticket.modify_date).toLocaleString('ca-ES')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle size={20} className="text-red-400" />
              <div className="ml-3">
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side - Main content area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Descripció</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </div>
            </div>

            {/* Attachments Section */}
            {ticket.attached && ticket.attached.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Adjunts ({ticket.attached.length})
                </h3>
                <div className="space-y-3">
                  {ticket.attached.map((attachment, index) => {
                    const canView = isViewableFile(attachment.file_type);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Paperclip size={16} className="text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {attachment.original_name || attachment.filename}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(attachment.size)} • {attachment.file_type.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {canView && (
                            <button
                              onClick={() => handleView(attachment.path, attachment.content_type)}
                              className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                              title="View in new tab"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDownload(attachment.path, attachment.original_name || attachment.filename)}
                            className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Comentaris ({comments.length})
              </h3>
              
              {/* Comment Form - Only visible for managers (permission_level <= 2) */}
              {user && user.permission_level <= 2 && (
                <CommentForm ticketId={ticket.id} onCommentPosted={loadComments} />
              )}
              
              {/* Comments List */}
              <div className={user && user.permission_level <= 2 ? "mt-6" : ""}>
                <CommentList comments={comments} loading={commentsLoading} />
              </div>
            </div>
          </div>

          {/* Right side - Stats and attributes */}
          <div className="space-y-6">
            {/* Ticket Stats */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informació del Ticket</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {ticket.type === 'incidence' ? (
                      <AlertCircle size={16} className="text-orange-600" />
                    ) : (
                      <Lightbulb size={16} className="text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tipus</p>
                    <p className="font-medium text-gray-900">
                      {ticket.type === 'incidence' ? 'Incidència' : 'Suggeriment'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <AlertCircle size={16} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Prioritat</p>
                    <Badge type="criticity" value={ticket.crit.value}>
                      {ticket.crit.desc}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Creador</p>
                    <p className="font-medium text-gray-900">{ticket.created_by_user.username}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Building size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Centre</p>
                    <p className="font-medium text-gray-900">{ticket.center?.desc || 'No especificat'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Wrench size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Eina</p>
                    <p className="font-medium text-gray-900">{ticket.tool.desc}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Route size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Creació mitjançant</p>
                    <p className="font-medium text-gray-900">{getPathwayLabel(ticket.pathway)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Suports</p>
                    <p className="font-medium text-gray-900">{ticket.supports}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* URL Section */}
            {ticket.url && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Enllaç</h3>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                  <a 
                    href={ticket.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:text-blue-800 break-all font-mono"
                  >
                    {ticket.url}
                  </a>
                </div>
              </div>
            )}

            {/* Notifier Section */}
            {ticket.notifier_user && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notificador</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                  <p className="text-yellow-800 font-medium">
                    {ticket.notifier_user.username}
                    {ticket.notifier_user.name && (
                      <span className="text-yellow-600"> ({ticket.notifier_user.name} {ticket.notifier_user.surnames || ''})</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* People Section */}
            {ticket.people && ticket.people.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Persones involucrades</h3>
                <ul className="space-y-2">
                  {ticket.people.map((person, index) => (
                    <li 
                      key={index} 
                      className="text-gray-700 border-b border-gray-200 pb-2 last:border-b-0 last:pb-0"
                    >
                      {person}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historic Changes Modal */}
      {showHistoricModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Historial de canvis</h2>
              <button
                onClick={() => setShowHistoricModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {modifications.length === 0 ? (
                <div className="text-center py-8">
                  <History size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hi ha modificacions encara</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {modifications.map((mod) => (
                    <div key={mod.id} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <User size={16} className="text-gray-500" />
                          <span className="font-medium text-gray-900">{mod.user.username}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(mod.date).toLocaleString('ca-ES')}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        {mod.changes.map((change, index) => (
                          <p key={index} className="text-gray-700 mb-1 last:mb-0">
                            • {change}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowHistoricModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Tancar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetail; 