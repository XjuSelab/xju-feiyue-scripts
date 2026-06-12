#!/usr/bin/env bash
# 本机执行:把 scripts/*/*.user.js 推到 huawei2:~/public-scripts/(经 win-wsl2 二跳)。
# 用法: deploy/deploy.sh [--dry-run] [脚本名过滤...]   (过滤省略=全部)
# 例:   deploy/deploy.sh                 # 推全部
#        deploy/deploy.sh huawei          # 只推名字含 huawei 的
#        deploy/deploy.sh --dry-run       # 只打印不执行
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WSL_PORT=2222
WSL='winbeau@win-wsl2'        # 本机 → win-wsl2
HUAWEI2='huawei2'             # win-wsl2 → huawei2 的 ssh 别名(二跳)
REMOTE_DIR='~/public-scripts'

DRY=0; FILTER=()
for a in "$@"; do
  if [ "$a" = "--dry-run" ]; then DRY=1; else FILTER+=("$a"); fi
done

mapfile -t FILES < <(find "$ROOT/scripts" -maxdepth 2 -name '*.user.js' | sort)
[ "${#FILES[@]}" -eq 0 ] && { echo "没找到 .user.js"; exit 1; }

for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  if [ "${#FILTER[@]}" -gt 0 ]; then
    match=0; for x in "${FILTER[@]}"; do [[ "$name" == *"$x"* ]] && match=1; done
    [ "$match" -eq 0 ] && continue
  fi
  ver="$(grep -m1 -oE '@version[[:space:]]+[0-9.]+' "$f" | awk '{print $2}')"
  echo "== $name (v${ver:-?})"
  if [ "$DRY" -eq 1 ]; then
    echo "   [dry-run] $f  ->  $WSL:/tmp/$name  ->  $HUAWEI2:$REMOTE_DIR/$name"
    continue
  fi
  scp -P "$WSL_PORT" -o ConnectTimeout=10 "$f" "$WSL:/tmp/$name"
  ssh -p "$WSL_PORT" "$WSL" "scp -o ConnectTimeout=10 /tmp/$name $HUAWEI2:$REMOTE_DIR/$name"
  echo "   ✓ 已推送 · 验证: curl -A Mozilla 'https://feiyue.selab.top/$name?v=${ver}' | grep -m1 @version"
done

[ "$DRY" -eq 0 ] && echo "完成。新增脚本首次需在 huawei2 跑一次 deploy/ensure-nginx-locations.sh 以加 nginx location。"
