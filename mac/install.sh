#!/bin/bash
# EV内部探検（EV Inside Game） - Mac にダウンロードして展開する（ターミナルに1行貼るだけ）
#   curl -fsSL https://raw.githubusercontent.com/Takuden-Formula/ev-inside-game/main/mac/install.sh | bash
# ブラウザでダウンロードしたものと違い「開発元を検証できません」の警告が出ない（curl は隔離の印を付けないため）
set -e
URL="https://github.com/Takuden-Formula/ev-inside-game/archive/refs/heads/main.zip"   # ブランチの最新
DEST="${1:-$HOME/Desktop}"
[ -d "$DEST" ] || DEST="$HOME"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/evx.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

echo "ダウンロードしています…（1 MB 未満）"
curl -fL --progress-bar -o "$TMP/a.zip" "$URL"
ditto -x -k "$TMP/a.zip" "$TMP/x"
SRC="$(find "$TMP/x" -maxdepth 1 -mindepth 1 -type d -name 'ev-inside-game*' | head -1)"   # ZIP の中身（ev-inside-game-main）
[ -n "$SRC" ] || { echo "ZIP の中に ev-inside-game がありません"; exit 1; }
if [ -e "$DEST/ev-inside-game" ]; then
  OLD="$DEST/ev-inside-game_old_$(date +%Y%m%d_%H%M%S)"
  mv "$DEST/ev-inside-game" "$OLD"
  echo "前の版は $OLD に残しました（記録 records.csv を置いていたら移してください）"
fi
ditto "$SRC" "$DEST/ev-inside-game"
xattr -dr com.apple.quarantine "$DEST/ev-inside-game" 2>/dev/null || true
chmod +x "$DEST/ev-inside-game/"*.command "$DEST/ev-inside-game/mac/"*.sh "$DEST/ev-inside-game/mac/"*.pl 2>/dev/null || true
echo
echo "できました: $DEST/ev-inside-game"
echo "開いたフォルダの「起動_Mac.command」をダブルクリックするとゲームが始まります"
open "$DEST/ev-inside-game"
