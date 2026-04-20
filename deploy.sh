#!/bin/bash

# MyDeck Console - Multi-Environment Build & Deploy Script
set -e # Exit on any error

# --- Load deployment paths from .env ---
if [ -f .env ]; then
    export PROD_DEPLOY_DIR=$(grep '^PROD_DEPLOY_DIR=' .env | cut -d '=' -f2)
    export DEV_DEPLOY_DIR=$(grep '^DEV_DEPLOY_DIR=' .env | cut -d '=' -f2)
fi

# --- Configuration ---
PROJECT_ROOT=$(pwd)
BUILD_OUTPUT_DIR="${PROJECT_ROOT}/dist"

PROD_DEPLOY_DIR="${PROD_DEPLOY_DIR:-}"
DEV_DEPLOY_DIR="${DEV_DEPLOY_DIR:-}"

# --- Environment Handling ---
ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Error: No environment specified."
    echo "Usage: ./deploy.sh [dev|prod|test]"
    exit 1
fi

if [ "$ENVIRONMENT" = "test" ]; then
    echo "Building MyDeck Console for testing with preview server..."
else
    echo "Building MyDeck Console for '$ENVIRONMENT' environment..."
fi

# --- Build ID Generation ---
echo "Generating build ID..."
BUILD_ID=$(node -e "
const { execSync } = require('child_process');
const timestamp = new Date().toISOString().replace(/[-T:.]/g, '').slice(0, 14);
try {
  const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  const isDirty = status.length > 0;
  console.log(\`\${gitHash}\${isDirty ? '-dirty' : ''}-\${timestamp}\`);
} catch (error) {
  console.log(timestamp);
}
")
echo "Build ID: $BUILD_ID"

DEPLOY_DIR=""
export BASE_PATH=""

if [ "$ENVIRONMENT" = "prod" ]; then
    echo "PRODUCTION DEPLOYMENT REQUESTED"
    echo "You are about to deploy to production environment."
    echo "This will overwrite the live application."
    echo ""
    read -p "Are you sure you want to continue? Type 'yes' to proceed: " -r
    echo ""
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Production deployment cancelled."
        exit 1
    fi
    echo "Production deployment confirmed. Proceeding..."
    echo ""

    echo "Installing dependencies..."
    npm install

    DEPLOY_DIR="$PROD_DEPLOY_DIR"
    export BASE_PATH=""
elif [ "$ENVIRONMENT" = "dev" ]; then
    DEPLOY_DIR="$DEV_DEPLOY_DIR"
    export BASE_PATH="/mydeck-console-dev"
elif [ "$ENVIRONMENT" = "test" ]; then
    export BASE_PATH=""
else
    echo "Error: Invalid environment '$ENVIRONMENT'."
    echo "Usage: ./deploy.sh [dev|prod|test]"
    exit 1
fi

# --- Clean previous build ---
echo "Cleaning previous build artifacts..."
rm -rf "$BUILD_OUTPUT_DIR"

# --- Build ---
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Using .env (dev build)"
    npm run build:dev
elif [ "$ENVIRONMENT" = "prod" ]; then
    echo "Using production build"
    npm run build -- --mode production
else
    echo "Using dev build for test preview"
    npm run build:dev
fi

if [ $? -eq 0 ]; then
    echo "Build completed successfully"

    if [ "$ENVIRONMENT" = "test" ]; then
        echo "Starting test preview server..."
        echo "Press Ctrl+C to stop the server"
        echo ""
        npm run preview -- --host
    else
        if [ ! -d "$BUILD_OUTPUT_DIR" ]; then
            echo "Error: Build output directory '$BUILD_OUTPUT_DIR' not found after build."
            exit 1
        fi

        if [ -n "$DEPLOY_DIR" ] && [ -d "$DEPLOY_DIR" ]; then
            echo "Deploying to $DEPLOY_DIR..."

            echo "Removing existing files from $DEPLOY_DIR..."
            rm -rf "${DEPLOY_DIR:?}"/*

            echo "Copying build artifacts..."
            cp -r "${BUILD_OUTPUT_DIR:?}"/* "$DEPLOY_DIR/"

            echo "Deployment to $DEPLOY_DIR completed successfully!"
            echo "Deployed Build ID: $BUILD_ID"
            echo "Build size:"
            du -sh "$DEPLOY_DIR"
        else
            echo "Warning: Deployment directory not configured or does not exist."
            echo "Set PROD_DEPLOY_DIR or DEV_DEPLOY_DIR in your .env file."
            echo "Built files are available in $BUILD_OUTPUT_DIR/"
            echo "Build ID: $BUILD_ID"
        fi
    fi
else
    echo "Build failed."
    exit 1
fi
