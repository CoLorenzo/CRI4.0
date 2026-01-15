#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${HOME:-}" ]]; then
  HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
  export HOME
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use --silent default >/dev/null 2>&1 || true
cd /opt/icr
npm run web:dev