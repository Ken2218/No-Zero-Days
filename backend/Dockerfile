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

# Install fontconfig & TrueType fonts so POI font metrics never fail in Alpine
RUN apk add --no-cache fontconfig freetype ttf-dejavu

# Copy the generated jar from the build stage
COPY --from=build /app/target/*.jar app.jar

ENV PORT=10000
EXPOSE 10000

# Bind to Render's dynamic PORT with headless AWT flag enabled
ENTRYPOINT ["sh", "-c", "java -Djava.awt.headless=true -Dserver.port=${PORT} -jar app.jar"]
