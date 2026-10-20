FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY seed ./seed
COPY public ./public
ENV NODE_ENV=production PORT=3100 DATA_FILE=/data/db.json
VOLUME /data
EXPOSE 3100
USER node
CMD ["node", "server.js"]
