import random
import string
from sqlalchemy.orm import Session
from database import Ticket

def generate_hex_digits(length: int = 6) -> str:
    """Generate random hexadecimal digits"""
    hex_chars = string.hexdigits.upper()[:-6]  # A-F, 0-9 (exclude lowercase)
    return ''.join(random.choice(hex_chars) for _ in range(length))

def generate_ticket_id(ticket_type: str, db: Session) -> str:
    """
    Generate a unique ticket ID based on type
    
    Args:
        ticket_type: 'incidence' or 'suggestion'
        db: Database session
    
    Returns:
        Unique ticket ID in format INCXXXXXX or SUGXXXXXX
    """
    if ticket_type == 'incidence':
        prefix = 'INC'
    elif ticket_type == 'suggestion':
        prefix = 'SUG'
    else:
        raise ValueError(f"Invalid ticket type: {ticket_type}")
    
    max_attempts = 100  # Prevent infinite loops
    attempts = 0
    
    while attempts < max_attempts:
        # Generate hex part
        hex_part = generate_hex_digits(6)
        ticket_id = f"{prefix}{hex_part}"
        
        # Check if ID already exists
        existing_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not existing_ticket:
            return ticket_id
        
        attempts += 1
    
    # If we've tried too many times, add a timestamp to ensure uniqueness
    import time
    timestamp = int(time.time() % 1000000)  # Last 6 digits of timestamp
    hex_timestamp = f"{timestamp:06X}"  # Convert to 6-digit hex
    return f"{prefix}{hex_timestamp}"

def is_valid_ticket_id(ticket_id: str) -> bool:
    """
    Validate if a ticket ID follows the correct format
    
    Args:
        ticket_id: Ticket ID to validate
    
    Returns:
        True if valid, False otherwise
    """
    if not ticket_id or len(ticket_id) != 9:
        return False
    
    prefix = ticket_id[:3]
    hex_part = ticket_id[3:]
    
    if prefix not in ['INC', 'SUG']:
        return False
    
    # Check if hex part contains only valid hex characters
    try:
        int(hex_part, 16)
        return True
    except ValueError:
        return False

def get_ticket_type_from_id(ticket_id: str) -> str:
    """
    Extract ticket type from ticket ID
    
    Args:
        ticket_id: Ticket ID (e.g., INC1A2B3C)
    
    Returns:
        'incidence' or 'suggestion'
    """
    if not is_valid_ticket_id(ticket_id):
        raise ValueError(f"Invalid ticket ID format: {ticket_id}")
    
    prefix = ticket_id[:3]
    if prefix == 'INC':
        return 'incidence'
    elif prefix == 'SUG':
        return 'suggestion'
    else:
        raise ValueError(f"Unknown ticket type prefix: {prefix}") 