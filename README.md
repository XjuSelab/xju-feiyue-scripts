# xju-feiyue-scripts

飞跃实验室（XjuSelab）维护的 Tampermonkey 用户脚本统一仓库。所有脚本通过 [`feiyue.selab.top`](https://feiyue.selab.top) 分发，Tampermonkey 经 `@updateURL` 自动更新。

## 脚本列表

命名采用「工具系 -er」：中文 `飞跃·<动作>` + 英文 `<动作>er`（见 [CONVENTIONS](./CONVENTIONS.md#命名)）。

| 名称 | 目录（技术 ID） | 用途 | 安装 / 更新 | 版本 |
|---|---|---|---|---|
| **飞跃·解题 Solver** | `feiyue-solver` | CourseGrading（Java/OJ）AI 自动解题（DeepSeek） | [安装](https://feiyue.selab.top/feiyue-solver.user.js) | 2.2.2 |
| **飞跃·刷课 Grinder** | `feiyue-grinder` | 华为实习汁（小学期）课程全自动刷课：视频 + 课件 + 随堂测验 + 结课考试（题库优先 + AI 兜底，自带共享云题库 `sxz-bank`） | [安装](https://feiyue.selab.top/feiyue-grinder.user.js) | 2.9.12 |
| _飞跃·导入 import_（不在本仓） | — | 飞跃成绩单一键导入 | 由 [Aurash](https://github.com/winbeau/Aurash) 项目统一维护与部署 | — |

> 安装：点「安装」链接，Tampermonkey 会弹出安装/更新页。装过的会自动检查更新（CF 边缘缓存 4h，手动强制可在链接后加 `?v=<版本>` 回源验证）。

## 目录结构

```
scripts/
  feiyue-grinder/      # 脚本 + sxz-bank 后端(Docker+SQLite) + tests(jsdom)
  feiyue-solver/           # 脚本 + tests + dev 辅助(gen.mjs/e2e.sh)
deploy/                   # 本机一键部署到 feiyue 的脚本(见下)
CONVENTIONS.md            # 命名 / 版本 / @updateURL / 部署 规范
```

## 开发 & 部署

1. 直接在 `scripts/<名>/` 下编辑 `.user.js`，改动后**自增 `@version`**。
2. 跑测试：`cd scripts/feiyue-grinder/tests && npm i && node --test *.mjs`；`cd scripts/feiyue-solver && node --test test-extract.mjs`。
3. 提交：`git commit -am "feat(sxz): ... v2.9.13"`。
4. 部署到 feiyue：`bash deploy/deploy.sh`（本机执行，经 win-wsl2 二跳推到 huawei2 的 `~/public-scripts/`）。

> 部署必须从本机跑：huawei2（华为云）只能经 win-wsl2 内网二跳访问，GitHub 云端 CI 到不了它，故不用 CI 自动部署。

详见 [CONVENTIONS.md](./CONVENTIONS.md)。
