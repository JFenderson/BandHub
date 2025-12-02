-- ========================================
-- HBCU Band Hub - Database Initialization Script
-- ========================================
-- This script runs when the PostgreSQL container is first created.
-- It sets up the initial database configuration.
-- ========================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Configure text search (for full-text search)
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Grant privileges (if using a different application user)
-- Note: The main user is created automatically by PostgreSQL env vars

-- Create read-only user for reporting/analytics (optional)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'readonly_user') THEN
--     CREATE USER readonly_user WITH PASSWORD 'readonly_password';
--   END IF;
-- END
-- $$;

-- Performance tuning settings (applied at runtime via ALTER SYSTEM)
-- These can be adjusted based on container resources
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET max_connections = 100;

-- Logging configuration for development
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_duration = 'on';
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second

-- Enable connection pooling settings
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
ALTER SYSTEM SET statement_timeout = '30s';

-- Notify user
DO $$
BEGIN
  RAISE NOTICE 'HBCU Band Hub database initialized successfully!';
END
$$;
