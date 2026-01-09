#!/bin/bash
# ========================================
# HBCU Band Hub - Deployment Script
# ========================================
# This script performs zero-downtime deployment.
# Usage: ./scripts/deploy.sh [environment]
# Environment: development | staging | production (default: production)
# ========================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-production}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_BEFORE_DEPLOY=true
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=5

# Timestamp for logs and backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Check if required tools are installed
check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_success "All requirements met"
}

# Load environment file
load_environment() {
    log_info "Loading environment: ${ENVIRONMENT}"
    
    if [ -f ".env.${ENVIRONMENT}" ]; then
        set -a
        source ".env.${ENVIRONMENT}"
        set +a
        log_success "Environment file loaded"
    else
        log_warning "Environment file .env.${ENVIRONMENT} not found, using defaults"
    fi
}

# Pull latest code (optional - disabled by default for CI/CD pipelines)
pull_latest_code() {
    if [ "${PULL_LATEST_CODE:-false}" = "true" ]; then
        log_info "Pulling latest code from repository..."
        
        git fetch origin
        git pull origin main
        
        log_success "Code updated to latest version"
    else
        log_info "Skipping code pull (set PULL_LATEST_CODE=true to enable)"
    fi
}

# Create database backup
create_backup() {
    if [ "$BACKUP_BEFORE_DEPLOY" = true ]; then
        log_info "Creating pre-deployment backup..."
        ./scripts/backup.sh || log_warning "Backup failed, continuing with deployment"
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    docker compose -f "${COMPOSE_FILE}" build --no-cache api web worker
    
    log_success "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    docker compose -f "${COMPOSE_FILE}" run --rm api \
        sh -c "npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma"
    
    log_success "Database migrations completed"
}

# Health check for a service
health_check() {
    local service=$1
    local url=$2
    local retries=$HEALTH_CHECK_RETRIES
    
    log_info "Waiting for ${service} to be healthy..."
    
    while [ $retries -gt 0 ]; do
        if curl -sf "${url}" > /dev/null 2>&1; then
            log_success "${service} is healthy"
            return 0
        fi
        
        retries=$((retries - 1))
        log_info "Waiting for ${service}... (${retries} retries left)"
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "${service} health check failed"
    return 1
}

# Deploy services with zero-downtime (rolling update)
deploy_services() {
    log_info "Deploying services..."
    
    # Start/update infrastructure services first
    docker compose -f "${COMPOSE_FILE}" up -d postgres redis
    sleep 10
    
    # Run migrations before deploying application services
    run_migrations
    
    # Deploy application services one by one for zero-downtime
    for service in api web worker; do
        log_info "Deploying ${service}..."
        
        # Scale down the old container
        docker compose -f "${COMPOSE_FILE}" up -d --no-deps --scale "${service}=2" "${service}"
        sleep 5
        
        # Scale back to 1 (removes old container)
        docker compose -f "${COMPOSE_FILE}" up -d --no-deps "${service}"
        
        log_success "${service} deployed"
    done
    
    # Deploy/restart nginx
    docker compose -f "${COMPOSE_FILE}" up -d nginx
    
    log_success "All services deployed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check API health
    health_check "API" "http://localhost:3001/api/health" || return 1
    
    # Check frontend
    health_check "Web" "http://localhost:3000" || return 1
    
    log_success "Deployment verified successfully"
}

# Rollback deployment
rollback() {
    log_error "Deployment failed! Rolling back..."
    
    # Restore from backup if available
    LATEST_BACKUP=$(ls -t backups/*.sql.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Restoring from backup: ${LATEST_BACKUP}"
        ./scripts/restore.sh "${LATEST_BACKUP}" || true
    fi
    
    # Restart previous containers
    docker compose -f "${COMPOSE_FILE}" down
    docker compose -f "${COMPOSE_FILE}" up -d
    
    log_warning "Rollback completed"
    exit 1
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old Docker images..."
    
    docker image prune -f --filter "until=24h"
    
    log_success "Cleanup completed"
}

# Print deployment summary
print_summary() {
    echo ""
    echo "========================================="
    log_success "Deployment completed successfully!"
    echo "========================================="
    echo "Environment: ${ENVIRONMENT}"
    echo "Timestamp: ${TIMESTAMP}"
    echo ""
    echo "Services:"
    docker compose -f "${COMPOSE_FILE}" ps
    echo ""
    echo "API URL: http://localhost:3001"
    echo "Web URL: http://localhost:3000"
    echo "========================================="
}

# Main deployment flow
main() {
    echo "========================================="
    echo "HBCU Band Hub - Deployment Script"
    echo "========================================="
    echo "Environment: ${ENVIRONMENT}"
    echo "Timestamp: ${TIMESTAMP}"
    echo "========================================="
    echo ""
    
    check_requirements
    load_environment
    
    # Optionally pull latest code (comment out if using CI/CD)
    # pull_latest_code
    
    create_backup
    build_images
    
    # Deploy with rollback on failure
    if deploy_services; then
        if verify_deployment; then
            cleanup
            print_summary
        else
            rollback
        fi
    else
        rollback
    fi
}

# Run main function
main "$@"
