# 华为「实习汁」刷课脚本 — jsdom 离线单测

对 `../huawei-sxz-shuake.user.js` 里的**纯逻辑函数**做离线单元测试：用 jsdom 还原真实官方页面 DOM，断言提取 / 解析 / 判定逻辑正确。

## 如何运行

```bash
cd tests
npm install   # 安装 jsdom
npm test      # = node --test
```

需要 Node ≥ 18（内置 `node:test`）。本机已在 Node v24 上验证通过（40 个测试全部 pass）。

## 文件

| 文件 | 作用 |
|---|---|
| `sxz-core.mjs` | 从用户脚本**忠实抽取**的纯函数（`extractOptions` / `extractQuestion` / `parseLetters` / `buildMessages` / `detectType` / `currentNodeText` / `bankLookup`），改成接收 `document`/`root`/`bank` 参数，不依赖全局。 |
| `fixtures.mjs` | 用 jsdom 构造各页面 DOM（单选 / 多选 / 判断答题页、随堂测验落地页、视频页、课件页、目录、结课测试目录），并注入 `innerText` polyfill。 |
| `test-extract.mjs` | `extractQuestion` / `extractOptions`：题型、index/total、answered、选项字母与文本、stem 剔除。 |
| `test-parse.mjs` | `parseLetters`：单选取一、多选全取去重、判断题文本兜底、超范围字母过滤。 |
| `test-detect.mjs` | `detectType` 六种页面分类 + `currentNodeText` + 结课测试在 `autoFinalTest` 真/假下的差异。 |
| `test-bank.mjs` | `bankLookup`：完整/子串/双向/标点空白差异命中、未命中 null、value 为字符串/数组两种形式。 |
| `test-build.mjs` | `buildMessages`：单选/多选/判断的 system+user 结构与关键文案、选项行格式 `字母. 文本`。 |

## ⚠️ 需与用户脚本同步

`sxz-core.mjs` 是用户脚本（脚本猫 IIFE，函数未导出）里纯函数的**人工拷贝**。
**改动 `../huawei-sxz-shuake.user.js` 中这些函数的逻辑时，必须同步修改 `sxz-core.mjs`**，否则测试会与线上脚本脱节。文件头部已有同步提醒注释。

## 关于 jsdom 的 `innerText`

jsdom 不实现 `Element.innerText`（返回 `undefined`），而脚本大量依赖它。`fixtures.mjs` 注入了一个 `innerText` polyfill（≈ 折叠空白后的可见文本），使被测的提取逻辑**无需改动**即可在离线 DOM 上跑出与真实浏览器一致的结果。

## 发现的脚本逻辑问题（见最终报告）

测试过程中标注了 `bankLookup` 对无分隔字符串值（如 `"ABD"`）不拆分的行为等，详见交付报告。**未改动用户脚本**。
