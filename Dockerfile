FROM node:20-bookworm-slim

# Fonts so Sharp can draw text into the Open Graph share images (/og/*.png).
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
