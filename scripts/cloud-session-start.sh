#!/usr/bin/env bash
# SessionStart hook for Claude Code on the web (see docs/00-cloud-setup.md).
#
# Restores node_modules in a fresh cloud VM so the first `npm run build` works
# without a manual install. Does nothing on a local machine.
#
# This script must ALWAYS exit 0: a non-zero exit blocks the session from
# starting, and a missing dependency is not worth losing the session over.

set -u

# Only run in a Claude Code cloud session.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

# Angular 22 requires Node >= 22.22.3. Warn loudly rather than failing, so the
# session still starts and Claude can report the problem.
REQUIRED_NODE="22.22.3"
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE="$(node -v 2>/dev/null | sed 's/^v//')"
  LOWEST="$(printf '%s\n%s\n' "$REQUIRED_NODE" "$CURRENT_NODE" | sort -V | head -1)"
  if [ "$CURRENT_NODE" != "$REQUIRED_NODE" ] && [ "$LOWEST" = "$CURRENT_NODE" ]; then
    echo "WARNING: Node $CURRENT_NODE is below the $REQUIRED_NODE required by Angular 22." >&2
    echo "         Add this to the cloud environment setup script and start a new session:" >&2
    echo "         npm install -g n && n 22 && hash -r && npm install -g npm@latest" >&2
  fi
fi

# Restore dependencies only when they are actually missing.
if [ -f package.json ] && [ ! -d node_modules ]; then
  echo "Installing dependencies (npm ci)..." >&2
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund >&2 || echo "WARNING: npm ci failed; run it manually." >&2
  else
    npm install --no-audit --no-fund >&2 || echo "WARNING: npm install failed; run it manually." >&2
  fi
fi

exit 0
