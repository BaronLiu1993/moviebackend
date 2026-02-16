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
