# ========================================
# HBCU Band Hub - Makefile
# ========================================
# Development workflow automation
# Usage: make [target]
# ========================================

.PHONY: help start stop restart logs shell build clean test \
        db-migrate db-seed db-studio db-reset \
        prod-start prod-stop prod-deploy \
        backup restore

# Default target
.DEFAULT_GOAL := help

# Variables
COMPOSE_FILE := docker-compose.yml
COMPOSE_PROD_FILE := docker-compose.prod.yml
COMPOSE_TEST_FILE := docker-compose.test.yml

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# ========================================
# Help
# ========================================
help: ## Show this help message
	@echo ""
	@echo "$(BLUE)HBCU Band Hub - Development Commands$(NC)"
	@echo "========================================"
	@echo ""
	@echo "$(GREEN)Usage:$(NC) make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ========================================
# Development Commands
# ========================================
start: ## Start all development services
	@echo "$(BLUE)Starting development services...$(NC)"
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "  API: http://localhost:3001"
	@echo "  Web: http://localhost:3000"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis: localhost:6379"

stop: ## Stop all development services
	@echo "$(BLUE)Stopping development services...$(NC)"
	docker compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)Services stopped!$(NC)"

restart: ## Restart all services
	@echo "$(BLUE)Restarting services...$(NC)"
	docker compose -f $(COMPOSE_FILE) restart
	@echo "$(GREEN)Services restarted!$(NC)"

restart-%: ## Restart a specific service (e.g., make restart-api)
	@echo "$(BLUE)Restarting $*...$(NC)"
	docker compose -f $(COMPOSE_FILE) restart $*
	@echo "$(GREEN)$* restarted!$(NC)"

logs: ## View logs for all services
	docker compose -f $(COMPOSE_FILE) logs -f

logs-%: ## View logs for a specific service (e.g., make logs-api)
	docker compose -f $(COMPOSE_FILE) logs -f $*

shell-%: ## Open shell in a container (e.g., make shell-api)
	docker compose -f $(COMPOSE_FILE) exec $* sh

status: ## Show status of all services
	docker compose -f $(COMPOSE_FILE) ps

# ========================================
# Build Commands
# ========================================
build: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker compose -f $(COMPOSE_FILE) build
	@echo "$(GREEN)Build completed!$(NC)"

build-%: ## Build a specific service (e.g., make build-api)
	@echo "$(BLUE)Building $*...$(NC)"
	docker compose -f $(COMPOSE_FILE) build $*
	@echo "$(GREEN)$* built!$(NC)"

build-prod: ## Build production Docker images
	@echo "$(BLUE)Building production images...$(NC)"
	docker compose -f $(COMPOSE_PROD_FILE) build
	@echo "$(GREEN)Production build completed!$(NC)"

# ========================================
# Database Commands
# ========================================
db-migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	docker compose -f $(COMPOSE_FILE) exec api npx prisma migrate deploy
	@echo "$(GREEN)Migrations completed!$(NC)"

db-migrate-dev: ## Create and run development migrations
	@echo "$(BLUE)Creating development migration...$(NC)"
	docker compose -f $(COMPOSE_FILE) exec api npx prisma migrate dev
	@echo "$(GREEN)Migration created!$(NC)"

db-seed: ## Seed the database
	@echo "$(BLUE)Seeding database...$(NC)"
	docker compose -f $(COMPOSE_FILE) exec api npx prisma db seed
	@echo "$(GREEN)Database seeded!$(NC)"

db-studio: ## Open Prisma Studio
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	docker compose -f $(COMPOSE_FILE) exec api npx prisma studio

db-reset: ## Reset database (WARNING: destroys all data)
	@echo "$(YELLOW)WARNING: This will destroy all database data!$(NC)"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ]
	docker compose -f $(COMPOSE_FILE) exec api npx prisma migrate reset --force
	@echo "$(GREEN)Database reset!$(NC)"

db-shell: ## Open PostgreSQL shell
	docker compose -f $(COMPOSE_FILE) exec postgres psql -U postgres -d hbcu_band_hub

# ========================================
# Testing Commands
# ========================================
test: ## Run all tests in Docker
	@echo "$(BLUE)Running tests...$(NC)"
	docker compose -f $(COMPOSE_TEST_FILE) up --abort-on-container-exit
	@echo "$(GREEN)Tests completed!$(NC)"

test-api: ## Run API tests only
	@echo "$(BLUE)Running API tests...$(NC)"
	docker compose -f $(COMPOSE_TEST_FILE) up --abort-on-container-exit api-test
	@echo "$(GREEN)API tests completed!$(NC)"

test-web: ## Run frontend tests only
	@echo "$(BLUE)Running frontend tests...$(NC)"
	docker compose -f $(COMPOSE_TEST_FILE) up --abort-on-container-exit web-test
	@echo "$(GREEN)Frontend tests completed!$(NC)"

test-clean: ## Clean up test containers
	docker compose -f $(COMPOSE_TEST_FILE) down -v

# ========================================
# Production Commands
# ========================================
prod-start: ## Start production services
	@echo "$(BLUE)Starting production services...$(NC)"
	docker compose -f $(COMPOSE_PROD_FILE) up -d
	@echo "$(GREEN)Production services started!$(NC)"

prod-stop: ## Stop production services
	@echo "$(BLUE)Stopping production services...$(NC)"
	docker compose -f $(COMPOSE_PROD_FILE) down
	@echo "$(GREEN)Production services stopped!$(NC)"

prod-logs: ## View production logs
	docker compose -f $(COMPOSE_PROD_FILE) logs -f

prod-deploy: ## Deploy to production
	@echo "$(BLUE)Deploying to production...$(NC)"
	./scripts/deploy.sh production

# ========================================
# Backup & Restore Commands
# ========================================
backup: ## Create database backup
	@echo "$(BLUE)Creating backup...$(NC)"
	./scripts/backup.sh
	@echo "$(GREEN)Backup completed!$(NC)"

restore: ## Restore from backup (usage: make restore BACKUP=path/to/backup.sql.gz)
	@if [ -z "$(BACKUP)" ]; then \
		echo "$(YELLOW)Usage: make restore BACKUP=path/to/backup.sql.gz$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Restoring from $(BACKUP)...$(NC)"
	./scripts/restore.sh $(BACKUP)
	@echo "$(GREEN)Restore completed!$(NC)"

# ========================================
# Cleanup Commands
# ========================================
clean: ## Remove all containers, volumes, and images
	@echo "$(YELLOW)WARNING: This will remove all containers, volumes, and images!$(NC)"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ]
	docker compose -f $(COMPOSE_FILE) down -v --rmi all
	docker compose -f $(COMPOSE_PROD_FILE) down -v --rmi all 2>/dev/null || true
	docker compose -f $(COMPOSE_TEST_FILE) down -v --rmi all 2>/dev/null || true
	@echo "$(GREEN)Cleanup completed!$(NC)"

clean-volumes: ## Remove all volumes only
	@echo "$(YELLOW)WARNING: This will remove all data volumes!$(NC)"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ]
	docker compose -f $(COMPOSE_FILE) down -v
	@echo "$(GREEN)Volumes removed!$(NC)"

prune: ## Remove unused Docker resources
	@echo "$(BLUE)Pruning unused Docker resources...$(NC)"
	docker system prune -f
	docker volume prune -f
	@echo "$(GREEN)Prune completed!$(NC)"

# ========================================
# Development Utilities
# ========================================
install: ## Install dependencies locally
	npm install
	cd apps/api && npm install
	cd apps/web && npm install
	cd apps/worker && npm install

setup: ## Complete development setup
	@echo "$(BLUE)Setting up development environment...$(NC)"
	cp .env.development .env 2>/dev/null || true
	$(MAKE) start
	sleep 10
	$(MAKE) db-migrate
	$(MAKE) db-seed
	@echo "$(GREEN)Setup completed!$(NC)"

# ========================================
# Docker Info
# ========================================
info: ## Show Docker environment info
	@echo "$(BLUE)Docker Environment Info$(NC)"
	@echo "========================"
	@echo "Docker version:"
	@docker --version
	@echo ""
	@echo "Docker Compose version:"
	@docker compose version
	@echo ""
	@echo "Running containers:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "Docker disk usage:"
	@docker system df
