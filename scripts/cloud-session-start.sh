#!/usr/bin/env bash
# SessionStart hook for Claude Code on the web (see docs/00-cloud-setup.md).
#
# Two jobs, both only in a cloud session:
#   1. Make sure Node satisfies Angular 22's >= 22.22.3 floor. The cloud image
#      currently ships 22.22.2 -- one patch short -- and the Angular CLI hard
#      fails below its floor, so without this the session cannot build or test.
#   2. Restore node_modules so the first `npm run build` works.
#
# This script must ALWAYS exit 0: a non-zero exit blocks the session from
# starting, and neither job is worth losing the session over. Every failure
# path degrades to a warning that tells the developer what to do by hand.

set -u

# Angular 22's real minimum. Do not lower this without checking the CLI's
# own `engines.node`, which is what actually rejects older versions.
readonly REQUIRED_NODE="22.22.3"

# $HOME/.local/bin precedes /opt/node22/bin on the cloud image's PATH, so
# symlinks here win over the preinstalled Node without touching system dirs.
readonly BIN_DIR="${HOME}/.local/bin"
readonly CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/bank-fair-node"

log() { echo "[cloud-session-start] $*" >&2; }

# True when $1 is lower than $2. sort -V orders versions correctly, including
# the 22.22.2 vs 22.22.3 case that plain string comparison gets wrong.
version_lt() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -1)" = "$1" ]
}

node_version() {
  command -v node >/dev/null 2>&1 || return 1
  node -v 2>/dev/null | sed 's/^v//'
}

# Download the newest 22.x and expose it via $BIN_DIR. Returns non-zero on any
# failure so the caller can fall back to warning.
install_node() {
  mkdir -p "$CACHE_DIR" "$BIN_DIR" || return 1

  local index target
  index="$(curl -fsS --max-time 60 https://nodejs.org/dist/index.json 2>/dev/null)" || {
    log "Could not reach nodejs.org to look up a Node release."
    return 1
  }
  # Newest 22.x. The index is ordered newest-first, so the first match wins.
  target="$(printf '%s' "$index" | tr ',' '\n' | grep -o '"v22\.[0-9]*\.[0-9]*"' | head -1 | tr -d '"')"
  [ -n "$target" ] || { log "No Node 22.x release found in the index."; return 1; }

  local dir="${CACHE_DIR}/${target}"
  if [ ! -x "${dir}/bin/node" ]; then
    log "Installing Node ${target} (cloud image has ${1:-none}, need >= ${REQUIRED_NODE})..."
    local tarball="${CACHE_DIR}/${target}.tar.xz"
    curl -fsS --max-time 300 -o "$tarball" \
      "https://nodejs.org/dist/${target}/node-${target}-linux-x64.tar.xz" || {
      log "Download failed."
      rm -f "$tarball"
      return 1
    }
    rm -rf "${CACHE_DIR}/extract" && mkdir -p "${CACHE_DIR}/extract"
    tar -xf "$tarball" -C "${CACHE_DIR}/extract" || { log "Extract failed."; return 1; }
    rm -f "$tarball"
    mv "${CACHE_DIR}/extract/node-${target}-linux-x64" "$dir" || return 1
    rm -rf "${CACHE_DIR}/extract"
  fi

  ln -sf "${dir}/bin/node" "${BIN_DIR}/node"
  ln -sf "${dir}/bin/npm" "${BIN_DIR}/npm"
  ln -sf "${dir}/bin/npx" "${BIN_DIR}/npx"
  export PATH="${BIN_DIR}:${PATH}"
  hash -r 2>/dev/null || true

  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *) log "WARNING: ${BIN_DIR} is not on PATH; run 'export PATH=${BIN_DIR}:\$PATH'." ;;
  esac
  return 0
}

# npm 10 cannot resolve this project's dependency graph: it dies with
# "Cannot read properties of null (reading 'edgesOut')" in arborist's peer
# resolution. `npm ci` is unaffected, but `npm install` needs npm >= 11.
ensure_npm() {
  command -v npm >/dev/null 2>&1 || return 0
  local major
  major="$(npm -v 2>/dev/null | cut -d. -f1)"
  case "$major" in
    ''|*[!0-9]*) return 0 ;;
  esac
  [ "$major" -ge 11 ] && return 0
  log "Upgrading npm from $(npm -v) (npm 10 cannot 'npm install' this project)..."
  npm install -g npm@latest --no-audit --no-fund >/dev/null 2>&1 \
    || log "WARNING: npm upgrade failed. 'npm ci' still works; 'npm install' may not."
}

main() {
  # Only run in a Claude Code cloud session; a local machine manages its own
  # toolchain and should not have binaries symlinked into its PATH.
  [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

  local project_dir
  project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  cd "$project_dir" || exit 0

  local current
  current="$(node_version || true)"

  if [ -z "$current" ]; then
    log "WARNING: Node is not installed. Angular 22 needs >= ${REQUIRED_NODE}."
  elif version_lt "$current" "$REQUIRED_NODE"; then
    if install_node "$current"; then
      log "Node is now $(node -v). npm is $(npm -v 2>/dev/null || echo unknown)."
    else
      log "WARNING: Node ${current} is below the ${REQUIRED_NODE} Angular 22 requires,"
      log "         and the automatic install failed. Add this to the cloud"
      log "         environment setup script and start a new session:"
      log "         npm install -g n && n 22 && hash -r && npm install -g npm@latest"
    fi
  fi

  ensure_npm

  # Restore dependencies only when they are actually missing. Prefer `npm ci`:
  # it installs straight from the lockfile and sidesteps the npm 10 bug above.
  if [ -f package.json ] && [ ! -d node_modules ]; then
    log "Installing dependencies..."
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund >&2 || log "WARNING: npm ci failed; run it manually."
    else
      npm install --no-audit --no-fund >&2 || log "WARNING: npm install failed; run it manually."
    fi
  fi

  exit 0
}

main "$@"
exit 0
