# Use official Node.js LTS Alpine image
FROM node:22-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Ensure data directories exist and have correct permissions
RUN mkdir -p data/uploads data/processed && \
    chmod -R 777 data

# Expose the port
EXPOSE 5000

# Set environment variable for production
ENV NODE_ENV=production

# Start the server with the correct file
CMD ["node", "index.js"]
