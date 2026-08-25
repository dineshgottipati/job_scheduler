FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN npm install
RUN npm run build --workspace=@job-scheduler/shared
RUN npm run build --workspace=@job-scheduler/web

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
