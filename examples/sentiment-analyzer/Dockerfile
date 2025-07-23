# Specify the Node base image with your desired version node:<version>
FROM node:18


# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package manifests. This layer is only invalidated if package.json or package-lock.json changes.
COPY package*.json ./

# Install dependencies cleanly. This will download from the npm registry.
RUN npm ci

# Copy the rest of your application source code.
# The .dockerignore file will prevent node_modules from being copied.
COPY . .

# Build the TypeScript code into JavaScript in the /dist folder
RUN npm run build

# Expose the port the app runs on
EXPOSE 8080

# Set the NODE_ENV environment variable to production
ENV NODE_ENV production

# Define the command to run your app using CMD which defines your runtime, here we will use node server.js to start our server
CMD [ "npm", "start" ]