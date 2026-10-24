# The gym platform: website, sign-ups, billing and every gym's app.
# For one gym on its own server, run with PLATFORM=0 (data in /data/db.json).
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY seed ./seed
COPY public ./public
COPY site ./site
RUN mkdir -p /data && chown node /data
ENV NODE_ENV=production PORT=3100 PLATFORM=1 DATA_DIR=/data DATA_FILE=/data/db.json TRUST_PROXY=1
VOLUME /data
EXPOSE 3100
USER node
CMD ["node", "server.js"]
