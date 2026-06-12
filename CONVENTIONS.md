# 规范（CONVENTIONS）

本仓库所有用户脚本遵循统一的命名、版本与部署约定。

## 命名

- 文件名：`<scope>-<feature>.user.js`，全小写、连字符分隔、无空格无中文。
  - `scope` = 平台/项目短名（`huawei`、`cg` …），`feature` = 功能简称（`sxz-shuake`、`ai-solver`）。
  - 例：`huawei-sxz-shuake.user.js`、`cg-ai-solver.user.js`。
- 每个脚本一个目录：`scripts/<scope>-<feature>/`，内含脚本本体、可选后端、`tests/`、`README.md`。

## 元数据（UserScript header）

- `@version` 用 [semver](https://semver.org) `MAJOR.MINOR.PATCH`：
  - PATCH = 修 bug / 措辞 / 性能；MINOR = 新功能且向下兼容；MAJOR = 破坏性（GM 存储 key、对外接口变更）。
  - **每次改动脚本都要自增 `@version`**，否则 Tampermonkey 不会更新。
- `@updateURL` 与 `@downloadURL` 统一指向裸链接：
  ```
  // @updateURL    https://feiyue.selab.top/<filename>.user.js
  // @downloadURL  https://feiyue.selab.top/<filename>.user.js
  ```
- 发布 URL：一脚本一 URL，**不在路径里嵌版本号**；历史版本靠 git 提交追溯。
- 验证回源：链接后加 `?v=<版本>` 绕 Cloudflare 缓存（缓存 4h），`cf-cache-status: MISS` 即最新。

### ⚠️ 存量脚本不要改 `@name` / `@namespace`

Tampermonkey 用 `@name`+`@namespace` 作为脚本身份。**改了会被当成新脚本，老用户丢掉本地配置**（API Key、各种 GM 标记）。所以：

- 已发布的脚本：保持原有 `@name`/`@namespace` 不动（即使不符合本规范）。
- 仅**新脚本**按本规范取名。

当前存量（保持原样）：
- huawei-sxz-shuake：`@namespace https://e.huawei.com/talent/sxz-shuake`
- cg-ai-solver：`@namespace https://github.com/winbeau/xiji`

## 版本与 git

- 改 `@version` → `git commit`，commit message 体现脚本与版本，如 `feat(sxz): 强制重答 v2.9.12`。
- 可选打 tag `<scope>-v<版本>`（如 `sxz-v2.9.12`）便于检索；本仓不强制 GitHub Release。

## 部署

- 唯一部署源是本仓的 `deploy/`，从**本机**执行（链路：本机 → `win-wsl2`(ssh -p 2222) → `huawei2`(二跳) → `~/public-scripts/`，nginx `aurash-tunnel` 精确 location 提供）。
- `deploy/deploy.sh [--dry-run] [脚本名…]`：推 `.user.js` 到 huawei2，并调 `ensure-nginx-locations.sh` 幂等校验 nginx location。
- `deploy/deploy-sxz-bank.sh`：仅在改了 huawei 后端时用，重建 `sxz-bank` 容器——**务必保留 `/data` 卷（题库数据）**。

## 测试

- 纯逻辑用 jsdom + `node:test` 离线单测；改脚本内被测函数时同步 `tests/` 里的拷贝（如 huawei 的 `sxz-core.mjs`）。
- 提交前至少 `node -c <脚本>` 语法校验 + 跑该脚本的测试。
