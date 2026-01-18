#!/bin/bash
# ========================================
# Secret Rotation Script
# ========================================
# Automates the rotation of secrets in Doppler
# Usage: ./scripts/rotate-secrets.sh [dev|stg|prd] [secret-name]
# ========================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${1:-}"
SECRET_NAME="${2:-}"
PROJECT="bandhub"

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

usage() {
    echo "Secret Rotation Script"
    echo ""
    echo "Usage: $0 [environment] [secret-name]"
    echo ""
    echo "Environments:"
    echo "  dev  - Development"
    echo "  stg  - Staging"
    echo "  prd  - Production"
    echo ""
    echo "Secret names:"
    echo "  JWT_SECRET"
    echo "  JWT_PREVIOUS_SECRET"
    echo "  DATABASE_PASSWORD"
    echo "  REDIS_PASSWORD"
    echo "  YOUTUBE_API_KEY"
    echo ""
    echo "Examples:"
    echo "  $0 stg JWT_SECRET"
    echo "  $0 prd DATABASE_PASSWORD"
    exit 1
}

# Validate arguments
if [ -z "$ENVIRONMENT" ] || [ -z "$SECRET_NAME" ]; then
    usage
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|stg|prd)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# Check if Doppler CLI is installed
if ! command -v doppler &> /dev/null; then
    log_error "Doppler CLI is not installed"
    exit 1
fi

log_info "Starting secret rotation for $SECRET_NAME in $ENVIRONMENT environment"

# Get current secret value (for JWT_PREVIOUS_SECRET update)
if [ "$SECRET_NAME" == "JWT_SECRET" ]; then
    log_info "Rotating JWT secret (zero-downtime)"
    
    CURRENT_SECRET=$(doppler secrets get JWT_SECRET --config "$ENVIRONMENT" --project "$PROJECT" --plain)
    
    # Generate new JWT secret
    NEW_SECRET=$(openssl rand -hex 32)
    
    log_info "Updating JWT_PREVIOUS_SECRET with current value..."
    doppler secrets set JWT_PREVIOUS_SECRET="$CURRENT_SECRET" --config "$ENVIRONMENT" --project "$PROJECT"
    
    log_info "Setting new JWT_SECRET..."
    doppler secrets set JWT_SECRET="$NEW_SECRET" --config "$ENVIRONMENT" --project "$PROJECT"
    
    log_success "JWT secret rotated successfully!"
    log_warning "Deploy the application to pick up new secrets"
    log_warning "After deployment is verified, you can clear JWT_PREVIOUS_SECRET if needed"
    
elif [ "$SECRET_NAME" == "DATABASE_PASSWORD" ]; then
    log_warning "Database password rotation requires manual steps:"
    echo ""
    echo "1. Create new database user with new password"
    echo "2. Update DATABASE_URL in Doppler"
    echo "3. Deploy application with rolling restart"
    echo "4. Verify connections"
    echo "5. Remove old database user"
    echo ""
    log_info "See docs/SECRETS_ROTATION.md for detailed instructions"
    
elif [ "$SECRET_NAME" == "REDIS_PASSWORD" ]; then
    log_info "Generating new Redis password..."
    NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    log_warning "Update Redis configuration with new password manually, then:"
    echo "doppler secrets set REDIS_PASSWORD=\"$NEW_PASSWORD\" --config $ENVIRONMENT --project $PROJECT"
    
elif [ "$SECRET_NAME" == "YOUTUBE_API_KEY" ]; then
    log_warning "YouTube API key rotation requires manual steps:"
    echo ""
    echo "1. Create new API key in Google Cloud Console"
    echo "2. Apply same restrictions as existing key"
    echo "3. Update in Doppler:"
    echo "   doppler secrets set YOUTUBE_API_KEY=<new-key> --config $ENVIRONMENT --project $PROJECT"
    echo "4. Deploy application"
    echo "5. Delete old API key in Google Cloud Console"
    echo ""
    
else
    log_error "Unknown secret: $SECRET_NAME"
    usage
fi

log_success "Rotation process completed"
