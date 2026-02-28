#!/usr/bin/env bash
# Usage: ./deploy.sh your-app-name
# Can be run from any directory — it always operates relative to the backend folder.
APP=${1:?"Usage: $0 <heroku-app-name>"}

set -e

# Always resolve relative to this script's location (backend/)
cd "$(dirname "$0")"

echo "🐳 Building & pushing Docker image from $(pwd)..."
heroku container:push web -a "$APP"

echo "🚀 Releasing..."
heroku container:release web -a "$APP"

echo "✅ Done! Tailing logs (Ctrl+C to exit)..."
heroku logs --tail -a "$APP"
