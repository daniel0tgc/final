FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production || yarn install --production
EXPOSE 8000
CMD ["node", "agent.js"]
