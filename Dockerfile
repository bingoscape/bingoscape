# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

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
# Required variables for build
ENV NODE_ENV=production
ENV DATABASE_URL=postgres://postgres:build_password@db:5432/bingoscape-next
ENV NEXT_PUBLIC_API_URL=http://localhost:3344

ENV NEXTAUTH_SECRET=build_secret_key_123
ENV NEXTAUTH_URL=http://localhost:3344
ENV DISCORD_CLIENT_ID=build_discord_client_id
ENV DISCORD_CLIENT_SECRET=build_discord_client_secret

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/next-env.d.ts ./
#COPY --from=builder /app/.env ./.env

# Expose the port the app runs on
EXPOSE 3333

# Start the application
CMD ["npm", "run", "start:prod"]
