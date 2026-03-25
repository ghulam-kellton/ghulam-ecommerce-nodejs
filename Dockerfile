# Use the latest stable Node.js version
FROM node:24-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app's source code
COPY . .

# Your app runs on port 5000 (adjust if different)
EXPOSE 5000

# Default command (can be overridden by docker-compose for testing)
CMD ["npm", "start"]
