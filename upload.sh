#!/usr/bin/env bash
set -euo pipefail

# PRDuck upload — scans local coding-agent transcripts (Claude Code, Codex,
# opencode, Cursor), redacts credentials and your home path on this machine,
# uploads the redacted sessions, and opens your scored report.
#
# Downloads a standalone binary for this OS/arch (no Node required), verifies
# its sha512, and caches it at ~/.prduck/bin/prduck-<version>. Unrecognized
# platforms and a binary that fails to run fall through to npx.
#
# The command asks whether to upload every session on this machine or only
# the repo you are standing in. Skip the question by passing the scope
# through bash: curl … | bash -s -- --all, or -s -- --dir <path>.
#
# First run: your browser opens once so you can authorize this machine
# against your PRDuck account (email magic link — no password). After that,
# uploads are silent and land in your dashboard. Credentials live in
# ~/.prduck/credentials.json; revoke anytime from Connected devices.
# Headless/CI runs authenticate via the PRDUCK_TOKEN env var instead.

prduck_main() {
  export PRDUCK_SITE_URL='https://prduck.tryproduck.com'
  local version='0.1.15'
  local bin="$HOME/.prduck/bin/prduck-$version"
  local os arch plat url sha tmp got want keep
  os="$(uname -s)"
  arch="$(uname -m)"
  if [ "$os" = Darwin ] && [ "$arch" = x86_64 ]; then
    if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
      arch=arm64
    fi
  fi
  case "${os}-${arch}" in
    Darwin-arm64) plat=darwin-arm64 ;;
    Darwin-x86_64) plat=darwin-x64 ;;
    Linux-x86_64) plat=linux-x64 ;;
    Linux-aarch64|Linux-arm64) plat=linux-arm64 ;;
    *) plat= ;;
  esac
  if [ -z "$plat" ]; then
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  if [ -x "$bin" ]; then
    exec "$bin" upload "$@"
  fi
  case "$plat" in
    darwin-arm64) url='https://registry.npmjs.org/prduck-darwin-arm64/-/prduck-darwin-arm64-0.1.15.tgz'; sha='e581f2bc58f67c6136b04572b7f7cc726ab8dc027c8bacbaebb1ef06ea6eca27963c81314ace561e5755383276ef16e3a56b4fcaebdb15252ae314e86fcf8d49' ;;
    darwin-x64) url='https://registry.npmjs.org/prduck-darwin-x64/-/prduck-darwin-x64-0.1.15.tgz'; sha='b9aaaa0df08c25cd32eafedc4af314244565d555af28f07f514b8798e38d2d1d3d6ac4f5c7ce5740a0b0b6a7eb93faef2ccbbdfc2fc2c54ac948b4e45234de88' ;;
    linux-x64) url='https://registry.npmjs.org/prduck-linux-x64/-/prduck-linux-x64-0.1.15.tgz'; sha='957560d765d7d487a6e8471dc10cca4b0f32733b06c0c1b9acbbbd8db17676daddcea307d83612d7afcb5982755a439a7f116567e9bb45a1856a7e9241af15cc' ;;
    linux-arm64) url='https://registry.npmjs.org/prduck-linux-arm64/-/prduck-linux-arm64-0.1.15.tgz'; sha='264b167ff0528a61bf4c27c3ace9fe5ba3215975dc4a76dfe2e1813c69b60a5a8778a23b44a4361b5358e22d9669d53c69a24755971da1834762df54eed060a2' ;;
  esac
  mkdir -p "$HOME/.prduck/bin"
  tmp="$(mktemp -d "$HOME/.prduck/tmp.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  curl -fL --retry 3 --retry-connrefused --progress-bar -o "$tmp/pkg.tgz" "$url"
  if command -v sha512sum >/dev/null 2>&1; then
    got="$(sha512sum "$tmp/pkg.tgz" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    got="$(shasum -a 512 "$tmp/pkg.tgz" | awk '{print $1}')"
  elif command -v openssl >/dev/null 2>&1; then
    got="$(openssl dgst -sha512 "$tmp/pkg.tgz" | awk '{print $NF}')"
  else
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  got="$(printf '%s' "$got" | tr '[:upper:]' '[:lower:]')"
  want="$(printf '%s' "$sha" | tr '[:upper:]' '[:lower:]')"
  if [ "$got" != "$want" ]; then
    echo "prduck: checksum mismatch" >&2
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  tar -xzf "$tmp/pkg.tgz" -C "$tmp" package/prduck
  chmod +x "$tmp/package/prduck"
  mv "$tmp/package/prduck" "$bin"
  touch "$bin"
  rm -rf "$tmp"
  keep=0
  for f in $(ls -1t "$HOME/.prduck/bin"/prduck-* 2>/dev/null || true); do
    keep=$((keep + 1))
    if [ "$keep" -gt 2 ]; then
      rm -f "$f"
    fi
  done
  if ! "$bin" version >/dev/null 2>&1; then
    echo "prduck: binary failed to run; falling back to npx" >&2
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  exec "$bin" upload "$@"
}

prduck_main "$@"
