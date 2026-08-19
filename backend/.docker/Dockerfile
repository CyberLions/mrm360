FROM node:22-bookworm-slim

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

# Copy workspace root files needed for pnpm install
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/

# Copy entrypoint script and ensure proper line endings
COPY backend/.docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && \
    sed -i 's/\r$//' /docker-entrypoint.sh

# Install dependencies (only backend workspace)
RUN pnpm install --frozen-lockfile --filter mrm360-backend

# Copy backend source code
COPY backend/ ./backend/

WORKDIR /usr/src/app/backend

EXPOSE 3000

ENV CONTAINER_TYPE=backend

ENTRYPOINT ["/docker-entrypoint.sh"]
# The API container must not use `pnpm run dev`: that script also starts the
# BullMQ worker (and therefore another Discord gateway client).
CMD ["pnpm", "exec", "next", "dev", "-H", "0.0.0.0", "-p", "3011"]
