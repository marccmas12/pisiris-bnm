from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database URL - use absolute path to work from any directory
current_dir = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(current_dir, 'ticket_manager.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)  # User's first name
    surnames = Column(String)  # User's surnames
    permission_level = Column(Integer, default=3)  # 1=full, 2=create/view, 3=view only
    is_active = Column(Boolean, default=True)
    default_center_id = Column(Integer, ForeignKey("center.id"), nullable=True)  # Default center for new tickets
    
    # Relationships
    tickets_created = relationship("Ticket", back_populates="created_by_user")
    modifications = relationship("Modification", back_populates="user")
    comments = relationship("Comment", back_populates="user")
    default_center = relationship("Center")

class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(String, primary_key=True, index=True)  # Hex-based ID (INCXXXXXX/SUGXXXXXX)
    ticket_num = Column(String, nullable=True)  # User-provided external ticket number (optional)
    type = Column(String, nullable=False)  # incidence or suggestion
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    url = Column(String, nullable=True)  # New field
    status_id = Column(Integer, ForeignKey("status.id"), nullable=False)
    crit_id = Column(Integer, ForeignKey("crit.id"), nullable=False)
    creation_date = Column(Date, default=datetime.utcnow().date, nullable=False)
    modify_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    resolution_date = Column(Date, nullable=True)  # Auto-set when status=solved
    delete_date = Column(Date, nullable=True)  # Auto-set when status=deleted
    modify_reason = Column(Text, nullable=True)  # Linked to status change
    notifier = Column(String, nullable=True)  # New field
    people = Column(JSON, nullable=False)  # Array of strings, required
    creator = Column(Integer, ForeignKey("users.id"), nullable=False)
    center_id = Column(Integer, ForeignKey("center.id"), nullable=True)
    tool_id = Column(Integer, ForeignKey("tool.id"), nullable=False)  # Now required
    pathway = Column(String, nullable=False)  # Auto-generated from dict
    supports = Column(Integer, default=0, nullable=False)  # Counter, required
    attached = Column(JSON, nullable=True)  # Array of file paths
    
    # Relationships
    created_by_user = relationship("User", back_populates="tickets_created")
    status = relationship("Status")
    crit = relationship("Crit")
    center = relationship("Center")
    tool = relationship("Tool")
    modifications = relationship("Modification", back_populates="ticket")
    comments = relationship("Comment", back_populates="ticket")

class Status(Base):
    __tablename__ = "status"
    
    id = Column(Integer, primary_key=True)
    value = Column(String, unique=True)
    desc = Column(String)

class Crit(Base):
    __tablename__ = "crit"
    
    id = Column(Integer, primary_key=True)
    value = Column(String, unique=True)
    desc = Column(String)

class Center(Base):
    __tablename__ = "center"
    
    id = Column(Integer, primary_key=True)
    value = Column(String, unique=True)
    desc = Column(String)

class Tool(Base):
    __tablename__ = "tool"
    
    id = Column(Integer, primary_key=True)
    value = Column(String, unique=True)
    desc = Column(String)

class Modification(Base):
    __tablename__ = "modifications"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey("tickets.id"))  # String for hex-based IDs
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)
    
    # New fields for tracking changes
    field_name = Column(String)  # Which field was changed
    old_value = Column(Text)     # Previous value
    new_value = Column(Text)     # New value
    
    # Relationships
    ticket = relationship("Ticket", back_populates="modifications")
    user = relationship("User", back_populates="modifications")

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey("tickets.id"), nullable=False)  # String for hex-based IDs
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)  # Comment text
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)  # When comment was posted
    
    # Relationships
    ticket = relationship("Ticket", back_populates="comments")
    user = relationship("User", back_populates="comments")

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 