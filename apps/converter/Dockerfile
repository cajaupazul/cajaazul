# Base stage
FROM node:20-slim AS base
WORKDIR /app

# Install LibreOffice and dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-java-common \
    default-jre \
    fonts-opensymbol \
    fonts-noto \
    fonts-liberation \
    curl \
    xvfb \
    libxinerama1 \
    libfontconfig1 \
    libglu1-mesa \
    libdbus-glib-1-2 \
    libasound2 \
    libnss3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV HOME=/tmp

# Add typical fonts to ensure good rendering (Arial, Times, etc. replacements)
# In production, you might copy actual .ttf files to /usr/share/fonts/
RUN apt-get update && apt-get install -y fonts-liberation

# Dependencies stage
FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Build stage (if using TypeScript)
FROM dependencies AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Create temp directory for uploads
RUN mkdir -p /tmp/uploads && chown -R node:node /tmp/uploads

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
