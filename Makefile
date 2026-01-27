.PHONY: dev build run migrate-up migrate-down

# Development with auto-reload
dev:
	@AIR_PATH="$$(go env GOPATH)/bin/air"; \
	if [ -f "$$AIR_PATH" ]; then \
		$$AIR_PATH; \
	else \
		echo "Air not found. Installing..."; \
		go install github.com/air-verse/air@latest; \
		$$AIR_PATH; \
	fi

# Build the application
build:
	go build -o bin/gameheros main.go

# Run the application (manual)
run:
	go run main.go

# Run database migrations
migrate-up:
	docker exec -i gameheros_postgres psql -U postgres -d gameheros < "db schema/schema.sql"

# Seed database with test data
seed:
	docker exec -i gameheros_postgres psql -U postgres -d gameheros < "db schema/seed-get.sql"

# Setup: migrate + seed
setup: migrate-up seed
	@echo "Database setup complete!"

# Start database
db-up:
	docker compose up -d

# Stop database
db-down:
	docker compose down

# Reset database (drop and recreate)
db-reset:
	docker exec -i gameheros_postgres psql -U postgres -c "DROP DATABASE IF EXISTS gameheros; CREATE DATABASE gameheros;"
	$(MAKE) migrate-up
	$(MAKE) seed
