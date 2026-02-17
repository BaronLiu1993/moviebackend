# Stage 1: Build TypeScript
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Install Python and pip
RUN apk add --no-cache python3 py3-pip dumb-init

# Create venv and install Python dependencies
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
RUN pip install numpy pandas lightgbm

# Install Node.js production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built Node.js app
COPY --from=builder /app/dist ./dist

# Copy Python ranking code
COPY ranking ./ranking

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
