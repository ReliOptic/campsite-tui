#!/usr/bin/env bash
# Campsite TUI 한 줄 설치 스크립트 (macOS / Ubuntu)
# 사용: curl -fsSL https://raw.githubusercontent.com/ReliOptic/campsite-tui/main/scripts/install.sh | bash
# 저장소 오버라이드: CSTUI_REPO_URL=https://github.com/me/fork.git bash install.sh
set -euo pipefail

REPO_URL="${CSTUI_REPO_URL:-https://github.com/ReliOptic/campsite-tui.git}"
PKG="campsite-tui"

log() { printf '\033[36m[cstui 설치]\033[0m %s\n' "$1"; }
fail() { printf '\033[31m[cstui 설치 실패]\033[0m %s\n' "$1" >&2; exit 1; }

# 1. Node.js 20+ 확인, 없으면 설치
need_node=true
if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -ge 20 ]; then need_node=false; fi
fi

if [ "$need_node" = true ]; then
  os="$(uname -s)"
  if [ "$os" = "Linux" ] && command -v apt-get >/dev/null 2>&1; then
    log "Node.js 22 LTS를 설치합니다 (sudo 권한 필요)"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif [ "$os" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      log "Homebrew로 Node.js를 설치합니다"
      brew install node
    else
      fail "Node.js 20+가 필요합니다. https://nodejs.org 에서 설치한 뒤 다시 실행하세요."
    fi
  else
    fail "지원하지 않는 OS입니다 (macOS / Ubuntu 지원)."
  fi
fi
log "Node $(node --version) 확인됨"

# 2. 설치 — npm 레지스트리에 공개돼 있으면 그걸로, 아니면 저장소에서 직접
install_global() {
  # 전역 prefix에 쓰기 권한이 없으면 sudo로 재시도
  if "$@" >/dev/null 2>&1; then return 0; fi
  log "전역 설치에 sudo가 필요합니다"
  sudo "$@"
}

if npm view "$PKG" version >/dev/null 2>&1; then
  log "npm 레지스트리에서 설치합니다"
  install_global npm install -g "$PKG"
else
  log "npm 미공개 — 저장소에서 직접 설치합니다: $REPO_URL"
  command -v git >/dev/null 2>&1 || fail "git이 필요합니다. (Ubuntu: sudo apt-get install -y git)"
  tmp="$(mktemp -d)"
  git clone --depth 1 "$REPO_URL" "$tmp/$PKG" \
    || fail "저장소를 받을 수 없습니다. CSTUI_REPO_URL 환경변수로 주소를 지정하세요."
  cd "$tmp/$PKG"
  npm install
  npm run build
  install_global npm link
fi

# 3. 검증
if ! command -v cstui >/dev/null 2>&1; then
  fail "cstui가 PATH에 없습니다. 터미널을 새로 열거나, npm 전역 bin 경로(npm prefix -g)/bin 를 PATH에 추가하세요."
fi
log "설치 완료: cstui v$(cstui --version)"
log '시작해보세요:  cstui run "ls -la"  →  cstui block copy-last'
