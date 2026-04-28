#!/bin/bash

# MyDeck Console - Multi-Environment Build & Deploy Script
set -e # Exit on any error

# --- Load deployment paths from .env ---
if [ -f .env ]; then
    export PROD_DEPLOY_DIR=$(grep '^PROD_DEPLOY_DIR=' .env | cut -d '=' -f2)
    export DEV_DEPLOY_DIR=$(grep '^DEV_DEPLOY_DIR=' .env | cut -d '=' -f2)
    export BIN_INSTALL_DIR=$(grep '^BIN_INSTALL_DIR=' .env | cut -d '=' -f2)
fi

# --- Configuration ---
PROJECT_ROOT=$(pwd)
BUILD_OUTPUT_DIR="${PROJECT_ROOT}/dist"
BINARY_BUILD_DIR="${PROJECT_ROOT}/build"
BINARY_NAME="${BINARY_NAME:-mydeck-console}"
BINARY_OUTPUT_PATH="${BINARY_BUILD_DIR}/${BINARY_NAME}"
EMBED_WEB_DIR="${PROJECT_ROOT}/cmd/mydeck-console/web"

PROD_DEPLOY_DIR="${PROD_DEPLOY_DIR:-}"
DEV_DEPLOY_DIR="${DEV_DEPLOY_DIR:-}"
BIN_INSTALL_DIR="${BIN_INSTALL_DIR:-}"

# --- Environment Handling ---
ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Error: No environment specified."
    echo "Usage: ./deploy.sh [dev|prod|test|binary-prod]"
    exit 1
fi

IS_BINARY=false

if [ "$ENVIRONMENT" = "test" ]; then
    echo "Building MyDeck Console for test preview..."
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
export BUILD_ID

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
elif [ "$ENVIRONMENT" = "binary-prod" ]; then
    IS_BINARY=true

    echo "PRODUCTION BINARY BUILD REQUESTED"
    echo "You are about to build the Go single-binary with a production SPA build."
    if [ -n "$BIN_INSTALL_DIR" ]; then
        echo "The binary will be copied to: $BIN_INSTALL_DIR"
    fi
    echo ""
    read -p "Are you sure you want to continue? Type 'yes' to proceed: " -r
    echo ""
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Production binary build cancelled."
        exit 1
    fi
    echo "Proceeding..."
    echo ""

    echo "Installing dependencies..."
    npm install

    export BASE_PATH=""
elif [ "$ENVIRONMENT" = "dev" ]; then
    DEPLOY_DIR="$DEV_DEPLOY_DIR"
    export BASE_PATH="/mydeck-console-dev"
elif [ "$ENVIRONMENT" = "test" ]; then
    export BASE_PATH=""
else
    echo "Error: Invalid environment '$ENVIRONMENT'."
    echo "Usage: ./deploy.sh [dev|prod|test|binary-prod]"
    exit 1
fi

# --- Clean previous build ---
echo "Cleaning previous build artifacts..."
rm -rf "$BUILD_OUTPUT_DIR"
if [ "$IS_BINARY" = "true" ]; then
    rm -rf "$BINARY_BUILD_DIR"
    mkdir -p "$BINARY_BUILD_DIR"
fi

# --- Build ---
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Using .env (dev build)"
    npm run build:dev
elif [ "$ENVIRONMENT" = "prod" ]; then
    echo "Using production build"
    npm run build -- --mode production
elif [ "$ENVIRONMENT" = "binary-prod" ]; then
    echo "Using production build for embedded SPA assets"
    npm run build -- --mode production
else
    echo "Using dev build"
    npm run build:dev
fi

if [ $? -eq 0 ]; then
    echo "Build completed successfully"

    if [ "$IS_BINARY" = "true" ]; then
        if ! command -v go >/dev/null 2>&1; then
            echo "Error: go is not installed or not in PATH."
            exit 1
        fi

        if [ ! -d "${PROJECT_ROOT}/cmd/mydeck-console" ]; then
            echo "Error: cmd/mydeck-console not found."
            echo "Go packaging scaffold is not present in this branch yet."
            exit 1
        fi

        if [ ! -d "$BUILD_OUTPUT_DIR" ]; then
            echo "Error: Build output directory '$BUILD_OUTPUT_DIR' not found after build."
            exit 1
        fi

        echo "Syncing embedded web assets to $EMBED_WEB_DIR..."
        mkdir -p "$EMBED_WEB_DIR"
        rm -rf "$EMBED_WEB_DIR"/*
        cp -r "${BUILD_OUTPUT_DIR:?}"/* "$EMBED_WEB_DIR/"

        echo "Building Go binary..."
        go build -o "$BINARY_OUTPUT_PATH" ./cmd/mydeck-console
        chmod +x "$BINARY_OUTPUT_PATH"
        echo "Go binary build completed: $BINARY_OUTPUT_PATH"

        if [ -n "$BIN_INSTALL_DIR" ] && [ -d "$BIN_INSTALL_DIR" ]; then
            echo "Installing binary to $BIN_INSTALL_DIR..."
            cp "$BINARY_OUTPUT_PATH" "$BIN_INSTALL_DIR/$BINARY_NAME"
            chmod +x "$BIN_INSTALL_DIR/$BINARY_NAME"

            echo "Installing management scripts to $BIN_INSTALL_DIR..."
            for script in run-instance.sh start-prod.sh stop-prod.sh status-prod.sh; do
                cp "${PROJECT_ROOT}/scripts/${script}" "$BIN_INSTALL_DIR/"
                chmod +x "$BIN_INSTALL_DIR/${script}"
            done

            if [ ! -f "$BIN_INSTALL_DIR/.env" ]; then
                echo "Note: no .env found in $BIN_INSTALL_DIR."
                echo "      Copy your .env there and set READECK_UPSTREAM, BRAVE_API_KEY, etc."
                echo "      The scripts read config from the directory they live in."
            fi

            echo "Installed: $BIN_INSTALL_DIR/$BINARY_NAME"
            echo "Build ID: $BUILD_ID"
            du -sh "$BIN_INSTALL_DIR/$BINARY_NAME"
            echo ""
            echo "Run with: $BIN_INSTALL_DIR/start-prod.sh"
        else
            echo "Binary build complete. BIN_INSTALL_DIR not set or does not exist."
            echo "Set BIN_INSTALL_DIR in .env to install the binary to a stable location."
            echo "Binary is at: $BINARY_OUTPUT_PATH"
            echo "Build ID: $BUILD_ID"
            echo ""
            echo "Run with: ./scripts/start-prod.sh"
        fi
    elif [ "$ENVIRONMENT" = "test" ]; then
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
