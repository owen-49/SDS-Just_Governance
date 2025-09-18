#!/usr/bin/env python3
"""
Database initialization script
"""

from db.session import Base, engine
from models.user import User

def init_database():
    """Initialize the database with all tables"""
    print("Creating database tables...")
    
    # Drop all existing tables and recreate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_database()
