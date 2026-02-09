# Use official Playwright image with all browser dependencies
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

# Set working directory
WORKDIR /app

# Install Node.js dependencies
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Expose the server port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
CMD ["node", "dist/server.js"]
