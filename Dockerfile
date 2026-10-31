# Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build Spring Boot backend and include React static files
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn -q -DskipTests dependency:go-offline
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./src/main/resources/static
RUN mvn -q -DskipTests package

# Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=backend-build /app/backend/target/tomboli-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 10000
ENTRYPOINT ["java", "-jar", "app.jar"]
