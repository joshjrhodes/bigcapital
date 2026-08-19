# Stage 1: Build
FROM node:18.16.0-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.0.5

# Install build dependencies
RUN apk add --no-cache python3 build-base chromium

# Set Python environment
ENV PYTHON=/usr/bin/python3

# Copy package files for dependency installation
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml lerna.json ./
COPY --chown=node:node packages/server/package.json ./packages/server/

# RPW: only the workspace manifests, not the sources. pnpm needs these to link
# the workspace, and keeping the sources out means editing a shared package does
# not invalidate the install layer — which turned a one-line template change into
# a ten-minute reinstall.
COPY --chown=node:node shared/bigcapital-utils/package.json ./shared/bigcapital-utils/
COPY --chown=node:node shared/pdf-templates/package.json ./shared/pdf-templates/
COPY --chown=node:node shared/email-components/package.json ./shared/email-components/
COPY --chown=node:node shared/sdk-ts/package.json ./shared/sdk-ts/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Now the shared sources, after the expensive install layer.
COPY --chown=node:node shared ./shared

# Copy source code
COPY --chown=node:node ./packages/server ./packages/server

# Build NestJS application
RUN pnpm run build:server --skip-nx-cache

# Stage 2: Production
FROM node:18.16.0-alpine AS production

WORKDIR /app

# Install pnpm for production
RUN npm install -g pnpm@9.0.5

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 build-base

# Set Python environment
ENV PYTHON=/usr/bin/python3

# Copy package files for production dependency installation
COPY --chown=nodejs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nodejs:nodejs packages/server/package.json ./packages/server/

# RPW: manifests only — see the builder stage. The built shared packages are
# copied in from the builder further down, so the sources are not needed here.
COPY --chown=nodejs:nodejs shared/bigcapital-utils/package.json ./shared/bigcapital-utils/
COPY --chown=nodejs:nodejs shared/pdf-templates/package.json ./shared/pdf-templates/
COPY --chown=nodejs:nodejs shared/email-components/package.json ./shared/email-components/
COPY --chown=nodejs:nodejs shared/sdk-ts/package.json ./shared/sdk-ts/

# Copy .husky directory (needed for husky install command)
COPY --chown=nodejs:nodejs .husky ./.husky

# Install only production dependencies
# Install husky temporarily so prepare script can run, then remove it
RUN pnpm add -D -w husky && \
    pnpm install --prod --frozen-lockfile && \
    pnpm remove -w husky && \
    # Remove build dependencies to reduce image size
    apk del python3 build-base

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/dist ./packages/server/dist

# Copy static assets (i18n, public, static directories)
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/src/i18n ./packages/server/dist/i18n
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/public ./packages/server/public
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/static ./packages/server/static

# Copy database migration files (needed for running migrations)
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/src/database ./packages/server/src/database

# Copy all shared packages from builder so newly added shared packages are included automatically
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

# Set runtime environment variables (these should be provided at runtime via docker-compose or k8s)
ENV NODE_ENV=production
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check - uses /api/system_db ping endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/system_db', (r) => {process.exit(r.statusCode >= 200 && r.statusCode < 300 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the application
CMD [ "node", "packages/server/dist/main.js" ]
