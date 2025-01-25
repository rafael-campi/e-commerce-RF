# Dockerfile
FROM node:22

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the port NestJS will run on
EXPOSE 3000

# Run the application
CMD ["npm", "run", "start:dev"]
