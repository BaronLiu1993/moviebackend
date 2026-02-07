# Docker Setup & Deployment Guide

This guide explains how to build, run, and deploy your Movie Backend API using Docker and Docker Hub.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [Manual Docker Build & Run](#manual-docker-build--run)
- [Push to Docker Hub](#push-to-docker-hub)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed (v20.10+)
- [Docker Hub account](https://hub.docker.com/) (for pushing images)
- Environment variables configured (see [Configuration](#configuration))

## Quick Start with Docker Compose

The easiest way to run the entire application stack (app + Redis) locally.

### Step 1: Configure Environment

```bash
# Copy the example environment file
cp .env.docker .env

# Edit .env with your Supabase and OpenAI credentials
nano .env
```

### Step 2: Build and Start Services

```bash
# Build and start all services in the background
docker-compose up -d

# View logs
docker-compose logs -f app

# View only app logs
docker-compose logs -f app

# View only Redis logs
docker-compose logs -f redis
```

### Step 3: Verify Everything is Running

```bash
# Check service health
docker-compose ps

# Test the API
curl http://localhost:8000/health

# Expected response:
# {"status":"ok"}
```

### Step 4: Stop Services

```bash
# Stop all services but keep them
docker-compose stop

# Stop and remove all containers
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

## Manual Docker Build & Run

Use this approach if you want more control over the build and run process.

### Step 1: Build the Docker Image

```bash
# Build with your Docker Hub username
docker build -t yourusername/moviebackend:latest .

# Build with a specific tag
docker build -t yourusername/moviebackend:v1.0.0 .

# Build and tag as latest
docker build -t yourusername/moviebackend:latest -t yourusername/moviebackend:v1.0.0 .
```

### Step 2: Run the Container Locally

```bash
# Run with environment variables from file
docker run -d \
  --name moviebackend \
  --env-file .env \
  -p 8000:8000 \
  --network host \
  yourusername/moviebackend:latest

# Or run with Redis (recommended)
# First, start Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine

# Then start the app
docker run -d \
  --name moviebackend \
  --env-file .env \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -p 8000:8000 \
  yourusername/moviebackend:latest
```

### Step 3: Verify the Container

```bash
# Check running containers
docker ps

# View logs
docker logs -f moviebackend

# Test the API
curl http://localhost:8000/health

# Stop the container
docker stop moviebackend

# Remove the container
docker rm moviebackend
```

## Push to Docker Hub

### Step 1: Create Docker Hub Account & Repository

1. Sign up at [Docker Hub](https://hub.docker.com/)
2. Create a new repository:
   - Name: `moviebackend`
   - Visibility: Private (or Public)

### Step 2: Login to Docker Hub

```bash
# Login to Docker Hub (interactive)
docker login

# You'll be prompted for username and password
# Or use a personal access token for better security
```

### Step 3: Build and Tag Image

```bash
# Build the image with proper naming
docker build -t yourusername/moviebackend:latest .

# Tag additional versions
docker tag yourusername/moviebackend:latest yourusername/moviebackend:v1.0.0
```

### Step 4: Push to Docker Hub

```bash
# Push latest tag
docker push yourusername/moviebackend:latest

# Push specific version tag
docker push yourusername/moviebackend:v1.0.0

# Push all tags for this image
docker push yourusername/moviebackend
```

### Step 5: Verify on Docker Hub

Visit your Docker Hub repository:
```
https://hub.docker.com/r/yourusername/moviebackend
```

You should see your pushed images listed.

## Production Deployment

### Using Docker Hub Image

Once your image is on Docker Hub, you can run it from anywhere:

```bash
# Pull the latest image
docker pull yourusername/moviebackend:latest

# Run the container
docker run -d \
  --name moviebackend \
  --env-file .env.production \
  -p 8000:8000 \
  yourusername/moviebackend:latest
```

### Docker Compose for Production

Use `docker-compose.yml` for full stack deployment:

```bash
# Production setup
COMPOSE_PROJECT_NAME=moviebackend docker-compose -f docker-compose.yml up -d
```

### Environment Configuration for Production

Create `.env.production`:

```env
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=production_anon_key
SUPABASE_JWT_SECRET=production_jwt_secret
SUPABASE_JWT_ALGORITHM=HS256
OPENAI_API_KEY=production_openai_key
REDIS_URL=redis://redis:6379
CORS_ORIGIN=https://your-frontend-domain.com
NODE_ENV=production
```

### Deploy to Cloud Platforms

#### AWS ECS

```bash
# Push to Amazon ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag yourusername/moviebackend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/moviebackend:latest

docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/moviebackend:latest
```

#### Google Cloud Run

```bash
# Configure gcloud
gcloud auth configure-docker gcr.io

# Tag image
docker tag yourusername/moviebackend:latest gcr.io/your-project/moviebackend:latest

# Push to Google Container Registry
docker push gcr.io/your-project/moviebackend:latest

# Deploy to Cloud Run
gcloud run deploy moviebackend \
  --image gcr.io/your-project/moviebackend:latest \
  --platform managed \
  --region us-central1
```

#### Azure Container Registry

```bash
# Login to ACR
az acr login --name yourregistry

# Tag image
docker tag yourusername/moviebackend:latest yourregistry.azurecr.io/moviebackend:latest

# Push to ACR
docker push yourregistry.azurecr.io/moviebackend:latest
```

## Image Details

### Base Image
- **Alpine Linux Node.js** (`node:18-alpine`)
- Lightweight (~170MB), optimized for production

### Key Features
- ✅ Multi-stage build (optimized image size)
- ✅ Non-root user (security best practice)
- ✅ Health checks configured
- ✅ Graceful shutdown with dumb-init
- ✅ Production-ready dependencies only

### Image Size
- Development: ~800MB (with dev dependencies)
- Production: ~200-300MB (production only)

### Port
- Default: **3000**
- Configurable via environment or port mapping

## Configuration

### Environment Variables

All environment variables from `.env` are supported:

```env
# Required
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...
OPENAI_API_KEY=...

# Optional
REDIS_URL=redis://redis:6379
CORS_ORIGIN=http://localhost:3000
NODE_ENV=production
```

### Docker Compose Override

Override settings in `docker-compose.override.yml` (not committed):

```yaml
version: '3.8'
services:
  app:
    environment:
      - DEBUG=true
    ports:
      - "8001:8000"
```

## Troubleshooting

### Container exits immediately

```bash
# Check logs for errors
docker logs moviebackend

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Redis connection failed
```

### Port already in use

```bash
# Use different port
docker run -p 8001:8000 yourusername/moviebackend:latest

# Or find and kill process using port 8000
lsof -i :8000
kill -9 <PID>
```

### Permission denied errors

```bash
# Ensure Docker daemon is running
docker ps

# On Mac/Linux, may need to use sudo
sudo docker ps
```

### Build fails with module errors

```bash
# Clean rebuild
docker build --no-cache -t yourusername/moviebackend:latest .

# Check Node modules size
docker run --rm yourusername/moviebackend:latest du -sh /app/node_modules
```

### Redis connection refused

```bash
# Ensure Redis is running (if using Docker Compose)
docker-compose ps

# Check Redis logs
docker-compose logs redis

# Or use docker-compose to auto-manage
docker-compose up -d
```

### Health check failing

```bash
# Check container logs
docker logs moviebackend

# Test manually
curl http://localhost:8000/health

# May need to wait for startup
sleep 5
curl http://localhost:8000/health
```

## Best Practices

✅ **Do:**
- Use specific version tags (`v1.0.0`) for production
- Use environment files for secrets
- Run with non-root user
- Use docker-compose for local development
- Set resource limits in production

❌ **Don't:**
- Commit `.env` files
- Use `latest` tag alone in production
- Run as root user
- Store secrets in Dockerfile
- Use default Redis without authentication in production

## Advanced Usage

### Building for Multiple Architectures

```bash
# Enable Docker buildx
docker buildx create --name multiarch

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourusername/moviebackend:latest \
  --push .
```

### Using Docker Secrets (Swarm)

```bash
# Create secrets
echo "your_jwt_secret" | docker secret create supabase_jwt_secret -

# Use in docker-compose
# services:
#   app:
#     secrets:
#       - supabase_jwt_secret
```

### Health Check Customization

Edit the Dockerfile `HEALTHCHECK` command to match your needs:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
```

## Support

For Docker issues, check:
- Docker logs: `docker logs <container_name>`
- Docker events: `docker events --filter type=container`
- Docker inspect: `docker inspect <container_name>`
