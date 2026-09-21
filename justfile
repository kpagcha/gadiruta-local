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

# Preview a completed production build locally.
preview:
    npm run preview

# Check for common JavaScript and React mistakes.
lint:
    npm run lint

# Check TypeScript without creating build files.
typecheck:
    npm run typecheck

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
check: lint format-check
    npm run build
