# Stage 1: Build the JAR with Maven
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the JAR (skipping tests for faster deployment)
RUN mvn clean package -DskipTests

# Stage 2: Run the built application
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy the generated jar from the build stage
COPY --from=build /app/target/*.jar app.jar

ENV PORT=10000
EXPOSE 10000

# Bind to Render's dynamic PORT
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT} -jar app.jar"]
