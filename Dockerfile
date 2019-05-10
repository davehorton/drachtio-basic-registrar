FROM node:10-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY package.json /usr/src/app/

RUN npm install --production

COPY . /usr/src/app

CMD [ "npm", "start" ]