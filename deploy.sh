#!/usr/bin/env bash
# Usage: ./deploy.sh your-app-name
APP=${1:?"Usage: $0 <heroku-app-name>"}

set -e

echo "🐳 Building & pushing Docker image..."
heroku container:push web -a "$APP" --context-path backend

echo "🚀 Releasing..."
heroku container:release web -a "$APP"

echo "✅ Done! Tailing logs (Ctrl+C to exit)..."
heroku logs --tail -a "$APP"
