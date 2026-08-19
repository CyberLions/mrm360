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

# Compile Next.js during the image build. Running `next dev` in production
# enables verbose request and Prisma query logging and performs runtime builds.
RUN pnpm run db:generate && NEXT_IGNORE_TYPE_ERRORS=true pnpm run build

EXPOSE 3011

ENV CONTAINER_TYPE=backend
ENV NODE_ENV=production

ENTRYPOINT ["/docker-entrypoint.sh"]
# The API container runs only the compiled API. BullMQ workers run in the
# dedicated worker container.
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3011"]
