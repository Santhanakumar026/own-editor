FROM node:20-alpine

# Install native FFmpeg and ffprobe
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Expose port
EXPOSE 5000

ENV PORT=5000
CMD ["node", "server.js"]

