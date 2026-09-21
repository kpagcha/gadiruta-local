# Run `just --list` to see the available project commands.
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

default:
    @just --list

# Install the exact JavaScript packages recorded in package-lock.json.
install:
    npm ci

# Start the local development website.
dev:
    npm run dev

# Build the tracked local network snapshot from data/source/ctan-gtfs.zip.
data:
    npm run data

# Download the current CTAN archive, then rebuild the tracked local network snapshot.
data-refresh:
    npm run data:refresh

# Preview a completed production build locally.
preview:
    npm run preview

# Check for common JavaScript and React mistakes.
lint:
    npm run lint

# Check TypeScript without creating build files.
typecheck:
    npm run typecheck

# Run the focused local-data tests without contacting external services.
test:
    npm test

# Check that files follow the shared formatting rules.
format-check:
    npm run format:check

# Rewrite files using the shared formatting rules.
format:
    npm run format

# Create the static files for deployment.
build:
    npm run build

# Run the usual checks before committing.
check: lint format-check test
    npm run build
