#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

# Run database migrations
npm run typeorm:migration:run

# Start the NestJS application
npm run start:prod