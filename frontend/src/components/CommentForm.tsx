import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { commentsAPI } from '../services/api';
import './CommentForm.css';

interface CommentFormProps {
  ticketId: string;
  onCommentPosted: () => void;
}

const CommentForm: React.FC<CommentFormProps> = ({ ticketId, onCommentPosted }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('El comentari no pot estar buit');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await commentsAPI.createComment(ticketId, {
        ticket_id: ticketId,
        content: content.trim(),
      });
      
      setContent('');
      onCommentPosted();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al publicar el comentari');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="comment-form-container">
      <form onSubmit={handleSubmit} className="comment-form">
        <div className="comment-form-header">
          <h3 className="comment-form-title">Afegir comentari</h3>
        </div>
        
        {error && (
          <div className="comment-form-error">
            {error}
          </div>
        )}
        
        <div className="comment-form-body">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escriu el teu comentari aquí..."
            rows={4}
            className="comment-form-textarea"
            disabled={loading}
          />
        </div>
        
        <div className="comment-form-footer">
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="comment-form-submit"
          >
            {loading ? (
              <span>Publicant...</span>
            ) : (
              <>
                <Send size={16} />
                <span>Publicar</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommentForm;

