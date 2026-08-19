#!/bin/bash
set -e

# Check if CONTAINER_TYPE is set
if [ -z "$CONTAINER_TYPE" ]; then
  echo "CONTAINER_TYPE is not set"
  exit 1
fi

# Run Prisma setup for backend containers
if [ "$CONTAINER_TYPE" = "backend" ]; then
  echo "Running Prisma setup for backend container..."

  # Run database migrations (use deploy for non-interactive environments)
  echo "Running database migrations..."
  pnpm exec prisma migrate deploy

  echo "Prisma setup completed."
fi

# Wait for backend service and run Prisma setup for worker containers
if [ "$CONTAINER_TYPE" = "worker" ]; then
  echo "Waiting for backend service to be available..."

  # Default backend host and port
  BACKEND_HOST=${BACKEND_HOST:-"backend"}
  BACKEND_PORT=${BACKEND_PORT:-"3011"}
  WAIT_TIMEOUT=${WAIT_TIMEOUT:-"15"}

  echo "Waiting for $BACKEND_HOST:$BACKEND_PORT with timeout ${WAIT_TIMEOUT}s..."

  # Use wait-for-it script to wait for backend
  /usr/src/app/backend/.docker/wait-for-it.sh "$BACKEND_HOST:$BACKEND_PORT" -t "$WAIT_TIMEOUT" -- echo "Backend service is available!"

  echo "Backend service is ready, starting worker..."
fi

# Start the application
echo "Starting $CONTAINER_TYPE..."
exec "$@"
