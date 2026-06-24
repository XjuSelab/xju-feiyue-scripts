// ce-stream.pw.mjs —— _ce 在线编辑器「流式写入 + 点原生提交 + 等判题」端到端验证（Playwright over CDP）
// 在 win-wsl2 上跑：cd 临时目录 && npm i playwright-core && node ce-stream.pw.mjs
// 连接已运行的 GUI Chrome(CDP 9333) 接管实验九 _ce 页；注入 v2.7.4 的 makeCeLiveFiller，
// 模拟流式把题解逐字写入 CodeMirror，断言编辑器随时间增长，再点 #cgSubmitBtn、轮询判题结果。
import { chromium } from 'playwright-core';

const CDP = 'http://127.0.0.1:9333';
const URL = 'http://10.109.120.139/assignment/programList_ce.jsp?assignID=69&proNum=1&libCenter=false';
const SOL = `public class Main {
  static class W implements Runnable {
    String n; W(String n){ this.n = n; }
    public void run(){ for (int i=1;i<=5;i++){ System.out.println(n + " 输出：" + i); try { Thread.sleep(100); } catch (InterruptedException e) {} } }
  }
  public static void main(String[] a){
    new Thread(new W("线程1")).start();
    new Thread(new W("线程2")).start();
  }
}`;

let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function poll(fn, pred, { timeout = 90000, interval = 2000, msg = '' } = {}) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < timeout) { try { last = await fn(); if (pred(last)) return last; } catch (_) {} await sleep(interval); }
  throw new Error('poll 超时: ' + msg + ' | last=' + JSON.stringify(last || '').slice(0, 160));
}

// 与 solver v2.7.4 makeCeLiveFiller 等价的填充器（注入页面）
const INSTALL = () => {
  window.__mk = function () {
    const host = document.querySelector('.CodeMirror'); const cm = host && host.CodeMirror;
    if (!cm) return null;
    cm.setValue(''); try { cm.clearHistory(); } catch (_) {} try { cm.focus(); } catch (_) {}
    let lastWritten = 0, buf = '', timer = null;
    const flush = () => {
      timer = null; if (!buf) return; const chunk = buf; buf = '';
      cm.operation(() => { const end = { line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length }; cm.replaceRange(chunk, end, undefined, '*stream'); });
      const e2 = { line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length }; try { cm.setCursor(e2); cm.scrollIntoView(e2, 20); } catch (_) {}
    };
    return {
      push(content) { if (!content || content.length <= lastWritten) return; buf += content.slice(lastWritten); lastWritten = content.length; if (!timer) timer = setTimeout(flush, 16); },
      finalize(finalCode) { if (timer) { clearTimeout(timer); timer = null; } flush(); if (typeof finalCode === 'string') cm.setValue(finalCode); try { cm.focus(); } catch (_) {} },
    };
  };
  return true;
};
const cmLen = () => document.querySelector('.CodeMirror')?.CodeMirror?.getValue().length ?? -1;

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('programList_ce.jsp'));
if (!page) { page = ctx.pages()[0] || await ctx.newPage(); await page.goto(URL); await sleep(2000); }
console.log('接管页面:', page.url());

await page.evaluate(INSTALL);
ok(await page.evaluate(() => !!window.__mk()), 'makeCeLiveFiller 取到 CodeMirror 实例并返回填充器');
await page.evaluate(() => { window.__f = window.__mk(); }); // 这次清空 + 留实例
ok(await page.evaluate(cmLen) === 0, '清空后编辑器为空');

// 模拟流式：累积 push，记录长度序列
const N = 18, step = Math.ceil(SOL.length / N), lens = [];
for (let i = 1; i <= N; i++) {
  const cum = SOL.slice(0, Math.min(SOL.length, i * step));
  await page.evaluate(c => window.__f.push(c), cum);
  await sleep(130);
  lens.push(await page.evaluate(cmLen));
}
console.log('流式长度序列:', lens.join(','));
ok(lens[lens.length - 1] > lens[0] && lens.filter((v, i) => i > 0 && v > lens[i - 1]).length >= 3, '编辑器内容随流式多次增量增长（肉眼可见逐字写入）');

await page.evaluate(c => window.__f.finalize(c), SOL);
const finalLen = await page.evaluate(cmLen);
ok(finalLen >= SOL.length - 5, 'finalize 后编辑器为完整题解 (len=' + finalLen + ')');

ok(await page.evaluate(() => !!document.getElementById('cgSubmitBtn')), '#cgSubmitBtn 提交按钮存在');
// 用原生 DOM click（与 solver submitCE 一致）：solver 浮窗会盖住按钮，Playwright 可操作性点击会被拦，
// 但原生 el.click() 不受遮挡影响——正是 solver 的做法，这里同样走原生点击验证。
await page.evaluate(() => document.getElementById('cgSubmitBtn').click());
console.log('已原生点击 #cgSubmitBtn（提交）');

await sleep(2000); // 等 cgsrcSubmit() 把 showmessageFRAME 指向 longtimerun
const pid = await page.evaluate(() => { const f = document.getElementById('showmessageFRAME'); const s = (f && f.src) || ''; let m = s.match(/problemID=(\d+)/); if (m) return m[1]; m = document.documentElement.innerHTML.match(/problemID["'=: ]+?(\d{3,})/); return m ? m[1] : ''; });
console.log('判题 problemID:', pid);
// 判题信号用 solver 同款 HTTP 轮询(longtimerunJSON，GBK)，比读 iframe DOM 可靠
const judge = () => page.evaluate(async pid => { try { const r = await fetch('/assignment/longtimerunJSON.jsp?assignID=69&problemID=' + pid + '&_=' + Date.now(), { credentials: 'include' }); return new TextDecoder('gbk').decode(new Uint8Array(await r.arrayBuffer())); } catch (e) { return ''; } }, pid);
const verdict = await poll(judge, t => /得分\s*[\d.]|完全正确/.test(t) && !/正在评判|排队|评判中|judging/i.test(t), { msg: '判题完成(longtimerunJSON)' });
const sm = verdict.match(/得分\s*([\d.]+)/);
console.log('判题结果:', '得分=' + (sm ? sm[1] : '?'), '|', verdict.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120));
ok(/得分\s*[\d.]|完全正确/.test(verdict), '原生点击提交后判题流程跑通（longtimerunJSON 返回判题结果' + (sm ? ' 得分 ' + sm[1] : '') + '）');

await browser.close(); // CDP 模式只断连，不 kill Chrome
console.log(failed ? `\n=== ${failed} 项失败 ===` : '\n=== ALL PASS ===');
process.exit(failed ? 1 : 0);
