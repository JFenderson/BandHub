#!/bin/bash
# ========================================
# HBCU Band Hub - Restore Script
# ========================================
# This script restores the database and optionally uploads from backups.
# Usage: ./scripts/restore.sh <db_backup_file> [uploads_backup_file]
# ========================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hbcu-band-hub-db-prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-hbcu_band_hub}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check arguments
check_arguments() {
    if [ $# -lt 1 ]; then
        echo "Usage: $0 <db_backup_file> [uploads_backup_file]"
        echo ""
        echo "Arguments:"
        echo "  db_backup_file       Path to database backup file (.sql or .sql.gz)"
        echo "  uploads_backup_file  (Optional) Path to uploads backup file (.tar.gz)"
        echo ""
        echo "Example:"
        echo "  $0 ./backups/db_hbcu_band_hub_20240101_120000.sql.gz"
        echo "  $0 ./backups/db_hbcu_band_hub_20240101_120000.sql.gz ./backups/uploads_20240101_120000.tar.gz"
        exit 1
    fi
}

# Validate backup file
validate_backup_file() {
    local file=$1
    
    if [ ! -f "$file" ]; then
        log_error "Backup file not found: $file"
        exit 1
    fi
    
    log_success "Backup file validated: $file"
}

# Confirm restoration
confirm_restore() {
    echo ""
    log_warning "WARNING: This will overwrite the existing database!"
    echo ""
    read -p "Are you sure you want to restore from backup? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Stop application services
stop_services() {
    log_info "Stopping application services..."
    
    docker compose -f "${COMPOSE_FILE}" stop api worker web 2>/dev/null || true
    
    log_success "Application services stopped"
}

# Restore database
restore_database() {
    local backup_file=$1
    
    log_info "Restoring database from: ${backup_file}"
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "${POSTGRES_CONTAINER}"; then
        log_info "Starting PostgreSQL container..."
        docker compose -f "${COMPOSE_FILE}" up -d postgres
        sleep 10
    fi
    
    # Decompress if needed
    local sql_file="${backup_file}"
    local temp_file=""
    
    if [[ "${backup_file}" == *.gz ]]; then
        log_info "Decompressing backup file..."
        temp_file="/tmp/restore_$(date +%s).sql"
        gunzip -c "${backup_file}" > "${temp_file}"
        sql_file="${temp_file}"
    fi
    
    # Drop existing connections
    # Use POSTGRES_ADMIN_DB for the admin database (defaults to 'postgres')
    local admin_db="${POSTGRES_ADMIN_DB:-postgres}"
    log_info "Dropping existing database connections..."
    docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${admin_db}" -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
        2>/dev/null || true
    
    # Restore the database
    log_info "Restoring database..."
    docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${sql_file}"
    
    # Cleanup temp file
    if [ -n "${temp_file}" ] && [ -f "${temp_file}" ]; then
        rm -f "${temp_file}"
    fi
    
    log_success "Database restored successfully"
}

# Restore uploads
restore_uploads() {
    local backup_file=$1
    
    log_info "Restoring uploads from: ${backup_file}"
    
    # Check if API container is available
    if docker compose -f "${COMPOSE_FILE}" ps api 2>/dev/null | grep -q "Up"; then
        docker compose -f "${COMPOSE_FILE}" exec -T api \
            tar xzf - -C / < "${backup_file}"
        log_success "Uploads restored successfully"
    else
        log_warning "API container is not running, starting it for restore..."
        docker compose -f "${COMPOSE_FILE}" up -d api
        sleep 10
        docker compose -f "${COMPOSE_FILE}" exec -T api \
            tar xzf - -C / < "${backup_file}"
        log_success "Uploads restored successfully"
    fi
}

# Restart services
restart_services() {
    log_info "Restarting application services..."
    
    docker compose -f "${COMPOSE_FILE}" up -d
    
    log_success "Application services restarted"
}

# Print summary
print_summary() {
    echo ""
    echo "========================================="
    log_success "Restore completed successfully!"
    echo "========================================="
    echo "Database: Restored"
    echo "Uploads: ${UPLOADS_RESTORED:-Not restored}"
    echo ""
    echo "Services status:"
    docker compose -f "${COMPOSE_FILE}" ps
    echo "========================================="
}

# Main function
main() {
    local db_backup="${1:-}"
    local uploads_backup="${2:-}"
    
    echo "========================================="
    echo "HBCU Band Hub - Restore Script"
    echo "========================================="
    echo "Database backup: ${db_backup}"
    echo "Uploads backup: ${uploads_backup:-Not specified}"
    echo "========================================="
    echo ""
    
    check_arguments "$@"
    validate_backup_file "$db_backup"
    
    if [ -n "$uploads_backup" ]; then
        validate_backup_file "$uploads_backup"
    fi
    
    confirm_restore
    stop_services
    restore_database "$db_backup"
    
    UPLOADS_RESTORED="Not restored"
    if [ -n "$uploads_backup" ]; then
        restore_uploads "$uploads_backup"
        UPLOADS_RESTORED="Restored"
    fi
    
    restart_services
    print_summary
}

# Run main function
main "$@"
