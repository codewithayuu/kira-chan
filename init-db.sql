-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create database if it doesn't exist
-- (This is handled by the POSTGRES_DB environment variable)

-- The tables will be created by Prisma migrations
-- This file is for any additional database setup
