FROM node:20-alpine

# Install system FFmpeg and ffprobe
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy root and subpackage definitions
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm run install:all

# Copy all source files
COPY . .

# Build React frontend for production
RUN npm run build:frontend

WORKDIR /app/backend
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "server.js"]

