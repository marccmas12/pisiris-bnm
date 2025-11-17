import React from 'react';
import { CommentWithUser } from '../types';
import { User, Clock } from 'lucide-react';
import './CommentList.css';

interface CommentListProps {
  comments: CommentWithUser[];
  loading?: boolean;
}

const CommentList: React.FC<CommentListProps> = ({ comments, loading }) => {
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ca-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="comment-list-loading">
        <p>Carregant comentaris...</p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="comment-list-empty">
        <p>No hi ha comentaris encara. Sigues el primer a comentar!</p>
      </div>
    );
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <div key={comment.id} className="comment-item">
          <div className="comment-header">
            <div className="comment-author">
              <User size={16} className="comment-author-icon" />
              <span className="comment-author-name">{comment.user.username}</span>
            </div>
            <div className="comment-date">
              <Clock size={14} className="comment-date-icon" />
              <span>{formatDateTime(comment.created_at)}</span>
            </div>
          </div>
          <div className="comment-content">
            <p>{comment.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommentList;

