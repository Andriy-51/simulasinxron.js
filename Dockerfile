FROM node:18-alpine

WORKDIR /usr/src/app

# install deps
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund || npm install --no-audit --no-fund

# copy source
COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/web/server.js"]
