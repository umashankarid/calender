# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Accept build arg early so changing it busts the cache
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve@14.2.4

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]
