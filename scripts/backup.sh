#!/bin/bash
# ========================================
# HBCU Band Hub - Backup Script
# ========================================
# This script backs up the database and uploads.
# Usage: ./scripts/backup.sh [backup_dir]
# ========================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RETENTION_DAYS=30

# Database settings (from environment or defaults)
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

# Create backup directory
create_backup_dir() {
    log_info "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"
}

# Backup database
backup_database() {
    log_info "Backing up PostgreSQL database..."
    
    local db_backup_file="${BACKUP_DIR}/db_${POSTGRES_DB}_${TIMESTAMP}.sql"
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "${POSTGRES_CONTAINER}"; then
        log_error "PostgreSQL container is not running"
        return 1
    fi
    
    # Create database dump
    docker exec "${POSTGRES_CONTAINER}" \
        pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
        --clean --if-exists --no-owner --no-privileges \
        > "${db_backup_file}"
    
    # Compress the backup
    gzip "${db_backup_file}"
    
    local backup_size=$(du -h "${db_backup_file}.gz" | cut -f1)
    log_success "Database backup created: ${db_backup_file}.gz (${backup_size})"
}

# Backup uploads
backup_uploads() {
    log_info "Backing up uploads directory..."
    
    local uploads_backup_file="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
    
    # Get the API container's uploads volume
    if docker compose -f "${COMPOSE_FILE}" ps api 2>/dev/null | grep -q "Up"; then
        docker compose -f "${COMPOSE_FILE}" exec -T api \
            tar czf - /app/apps/api/uploads 2>/dev/null > "${uploads_backup_file}" || true
        
        if [ -s "${uploads_backup_file}" ]; then
            local backup_size=$(du -h "${uploads_backup_file}" | cut -f1)
            log_success "Uploads backup created: ${uploads_backup_file} (${backup_size})"
        else
            rm -f "${uploads_backup_file}"
            log_warning "No uploads to backup"
        fi
    else
        log_warning "API container is not running, skipping uploads backup"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=0
    
    while IFS= read -r file; do
        rm -f "$file"
        deleted_count=$((deleted_count + 1))
    done < <(find "${BACKUP_DIR}" -name "*.gz" -mtime +${RETENTION_DAYS} -type f 2>/dev/null)
    
    while IFS= read -r file; do
        rm -f "$file"
        deleted_count=$((deleted_count + 1))
    done < <(find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +${RETENTION_DAYS} -type f 2>/dev/null)
    
    if [ $deleted_count -gt 0 ]; then
        log_success "Deleted ${deleted_count} old backup(s)"
    else
        log_info "No old backups to clean up"
    fi
}

# Print backup summary
print_summary() {
    echo ""
    echo "========================================="
    log_success "Backup completed successfully!"
    echo "========================================="
    echo "Backup directory: ${BACKUP_DIR}"
    echo "Timestamp: ${TIMESTAMP}"
    echo ""
    echo "Backup files:"
    ls -lh "${BACKUP_DIR}"/*_${TIMESTAMP}* 2>/dev/null || echo "  No backup files found"
    echo ""
    echo "Total backup size:"
    du -sh "${BACKUP_DIR}" 2>/dev/null || echo "  Unable to calculate"
    echo "========================================="
}

# Main function
main() {
    echo "========================================="
    echo "HBCU Band Hub - Backup Script"
    echo "========================================="
    echo "Timestamp: ${TIMESTAMP}"
    echo "Backup directory: ${BACKUP_DIR}"
    echo "========================================="
    echo ""
    
    create_backup_dir
    backup_database
    backup_uploads
    cleanup_old_backups
    print_summary
}

# Run main function
main "$@"
