FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies lists
COPY package.json package-lock.json* ./

# Install dependencies (ignoring scripts if needed)
RUN npm ci

# Copy the rest of the frontend code
COPY . .

# Build the Next.js application in production mode
RUN npm run build

# --- Runner stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 8116

# Next.js start script is configured to use port 8116
CMD ["npm", "run", "start"]
