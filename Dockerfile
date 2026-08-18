FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY api ./api
COPY migrations ./migrations

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "api/index.js"]
