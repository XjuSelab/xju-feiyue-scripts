#!/usr/bin/env node
// probe-latency.mjs — 诊断「solver 卡顿是提示词太长还是端点(网关)间歇卡」。
// 对同一端点/模型，分别用【短】【长(≈solver 首版注入)】【超长(≈纠错版累积上下文)】三种提示各跑 N 轮，
// 流式测「首字节(TTFB)」与「总耗时」，把间歇性卡顿暴露出来。Key 走环境变量，绝不写进仓库。
//
// 用法：
//   LLM_BASE=https://aiapis.help/v1 LLM_KEY=sk-xxx LLM_MODEL=gpt-5.5 node probe-latency.mjs [轮次=3]
//
// 判读：
//   · 三档 TTFB 接近          → 提示词长度不是瓶颈（符合预期，几百~几千 token GPT 都很快）
//   · 某些轮次 TTFB 突然几十秒/TIMEOUT、且与长度无关 → 端点(网关 aiapis.help / 上游 gpt-5.5)间歇卡
//   · 只有【超长】明显变慢      → 才是提示词/上下文太长，需要更狠地压缩历史

import process from 'node:process';

const BASE = (process.env.LLM_BASE || '').replace(/\/+$/, '');
const KEY = process.env.LLM_KEY || '';
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const ROUNDS = Math.max(1, +(process.argv[2] || 3));
const PER_CALL_TIMEOUT = 120000;
if (!BASE || !KEY) { console.error('需要环境变量 LLM_BASE 和 LLM_KEY（可选 LLM_MODEL）'); process.exit(1); }

// solver 编程题真实系统提示（与脚本一致）
const SYS = [
  'You are an expert solver for a Chinese university Java online judge (CourseGrading/educg). The judge compares program stdout against hidden test cases and must match byte-for-byte.',
  '',
  'Produce ONE complete, compilable Java program reading stdin and writing stdout, matching the sample output EXACTLY (every space/blank line/trailing whitespace).',
  'Output ONLY one fenced ```java code block, no prose.',
  'Rules: `public class Main` with `public static void main(String[] args)`; helper classes non-public or nested; NO package; ASCII only unless sample requires; read all stdin until EOF; only the Java standard library.',
].join('\n');
const PROB = '【题目标题】多线程共享变量累加（线程不安全问题）\n\n【题目内容】通过 Runnable 接口创建多个子线程对同一共享变量进行累加，演示线程不安全现象并用同步机制修复，最终输出累加结果。\n\n请给出完整 Java 解法。';
// 模拟纠错版：附上一版“错误代码”+失败反馈（≈solver compactMessages 保留两轮的规模）
const FAKE_CODE = '```java\npublic class Main {\n  static int c = 0;\n' + '  // ... 假装这里有一大段上一版代码 ...\n'.repeat(60) + '}\n```';
const FEEDBACK = '上次提交未通过（期望 50000，实际 4xxxx，存在竞态）。请用 synchronized / AtomicInteger 修复后重新输出完整答案。';

const CASES = [
  ['短   ', [{ role: 'user', content: '只回复两个字：你好' }]],
  ['长   ', [{ role: 'system', content: SYS }, { role: 'user', content: PROB }]],
  ['超长 ', [{ role: 'system', content: SYS }, { role: 'user', content: PROB }, { role: 'assistant', content: FAKE_CODE }, { role: 'user', content: FEEDBACK }]],
];
const approxTok = (msgs) => Math.round(msgs.reduce((n, m) => n + m.content.length, 0) / 2.2);

async function probe(messages) {
  const t0 = Date.now();
  let ttfb = null, chars = 0, err = null;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT);
  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY, Accept: 'text/event-stream' },
      body: JSON.stringify({ model: MODEL, messages, stream: true, temperature: 0, max_tokens: 1024 }),
    });
    if (!res.ok) { err = 'HTTP ' + res.status + ' ' + (await res.text()).slice(0, 80); }
    else {
      const reader = res.body.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        const chunk = dec.decode(value, { stream: true });
        if (ttfb == null && /"content"\s*:\s*"[^"]/.test(chunk)) ttfb = Date.now() - t0;
        const m = chunk.match(/"content":"((?:[^"\\]|\\.)*)"/g); if (m) chars += m.reduce((n, s) => n + s.length, 0);
      }
    }
  } catch (e) { err = e.name === 'AbortError' ? `TIMEOUT(>${PER_CALL_TIMEOUT / 1000}s)` : (e.message || ('' + e)); }
  clearTimeout(to);
  return { ttfb, total: Date.now() - t0, chars, err };
}

const fmt = (ms) => ms == null ? '  —  ' : (ms / 1000).toFixed(1) + 's';
console.log(`端点=${BASE}  模型=${MODEL}  每档 ${ROUNDS} 轮  单次超时 ${PER_CALL_TIMEOUT / 1000}s`);
for (const [label, msgs] of CASES) {
  console.log(`\n【${label.trim()}】≈${approxTok(msgs)} tok`);
  const ttfbs = [];
  for (let i = 0; i < ROUNDS; i++) {
    const r = await probe(msgs);
    if (r.ttfb != null) ttfbs.push(r.ttfb);
    console.log(`  #${i + 1}  首字节=${fmt(r.ttfb)}  总=${fmt(r.total)}  输出≈${r.chars}字  ${r.err ? '❌ ' + r.err : '✓'}`);
  }
  if (ttfbs.length) {
    ttfbs.sort((a, b) => a - b);
    console.log(`  └ 首字节 中位=${fmt(ttfbs[ttfbs.length >> 1])}  最大=${fmt(Math.max(...ttfbs))}`);
  }
}
console.log('\n判读：短/长/超长 首字节接近 → 长度不是瓶颈；某轮突然飙到几十秒/超时且与长度无关 → 端点(网关)间歇卡。');
