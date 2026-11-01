#!/bin/bash
# EV内部探検を起動します（この窓を閉じると終了します）
echo "EV内部探検を起動します（この窓を閉じると終了します）"
exec bash "$(dirname "$0")/mac/start.sh"
