ARG NODE_VERSION=23-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /usr/src/app

# Install Bun + system dependencies for headless GL
RUN apk update && apk add --no-cache \
  bash curl unzip \
  mesa-gl mesa-egl mesa-dri-gallium mesa-dev \
  libxi-dev python3 make g++ \
  xvfb

RUN curl https://bun.sh/install | bash -s
ENV PATH="${PATH}:/root/.bun/bin"

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
WORKDIR /temp/dev
RUN bun install

# Build stage
FROM base AS prerelease
WORKDIR /usr/src/app

COPY . .
COPY --from=install /temp/dev/node_modules node_modules

# Build the app using Node (Bun has memory issues with large builds)
RUN npx nuxt build

# Production stage
FROM base AS release
WORKDIR /usr/src/app

COPY --from=prerelease /usr/src/app/.output .output

# Copy pre-compiled node_modules from install stage for native runtime deps
# (gl, @napi-rs/canvas, three are externalized by Nitro and need to be available at runtime)
COPY --from=install /temp/dev/node_modules .output/server/node_modules

# Copy server assets (logo SVG for OG image generation)
COPY --from=prerelease /usr/src/app/server/assets server/assets

EXPOSE 3000

# Start Xvfb for headless GL, then run the server
ENV DISPLAY=:99
CMD Xvfb :99 -screen 0 1024x768x24 -nolisten tcp & sleep 1 && node .output/server/index.mjs
