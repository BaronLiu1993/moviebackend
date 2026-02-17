# Stage 1: Build TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install Python, pip, and build tools for lightgbm
RUN apk add --no-cache python3 py3-pip dumb-init gcc g++ musl-dev

# Create venv and install Python dependencies
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
RUN pip install numpy pandas lightgbm

# Remove build tools to reduce image size
RUN apk del gcc g++ musl-dev

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
