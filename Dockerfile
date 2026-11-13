FROM node:20-alpine

# Install system FFmpeg and ffprobe
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package definitions and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build React frontend for production
RUN npm run build

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "server.js"]
