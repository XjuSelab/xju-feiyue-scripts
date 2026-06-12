#!/usr/bin/env bash
# 重建 sxz-bank 后端容器(仅在改了 bank_server.py / Dockerfile 时需要)。在 huawei2 上执行。
# ⚠️ 题库数据(/data/bank.db,已积累上百题)持久化在数据卷里。重建前务必确认挂载,勿丢数据。
set -euo pipefail
cat <<'EOF'
== sxz-bank 重建步骤(huawei2 上,谨慎执行)==

0) 先把最新源码同步到 huawei2(本机经二跳):
   scp -P 2222 scripts/huawei-sxz-shuake/sxz-bank/* winbeau@win-wsl2:/tmp/
   ssh -p 2222 winbeau@win-wsl2 'scp /tmp/bank_server.py /tmp/Dockerfile huawei2:~/sxz-bank/'

1) 确认当前容器的数据卷挂载(照抄到下面的 -v):
   sudo docker inspect -f '{{json .Mounts}}' sxz-bank | python3 -m json.tool

2) 重建(把 <DATA_MOUNT> 换成上一步看到的 "源:目标",通常形如 -v /data/sxz-bank:/data):
   cd ~/sxz-bank
   sudo docker build -t sxz-bank .
   sudo docker stop sxz-bank && sudo docker rm sxz-bank
   sudo docker run -d --name sxz-bank --restart unless-stopped \
     -p 127.0.0.1:8799:8799 <DATA_MOUNT> sxz-bank

3) 验证(题库条数应不变):
   curl -s https://feiyue.selab.top/sxz-bank/stats
EOF
