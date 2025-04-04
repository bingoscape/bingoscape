# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Add this line to skip validation during build
ENV SKIP_ENV_VALIDATION=1

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and build-time env
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/next-env.d.ts ./

# Expose the port the app runs on
EXPOSE 3333

# Start the application
CMD ["npm", "run", "start:prod"]
