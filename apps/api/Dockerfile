FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npm install
RUN npm run db:generate --workspace=@job-scheduler/database
RUN npm run build --workspace=@job-scheduler/shared
RUN npm run build --workspace=@job-scheduler/database
RUN npm run build --workspace=@job-scheduler/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@job-scheduler/api"]
