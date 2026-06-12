// test-exam.mjs — 结课考试(examContent)新逻辑离线验证
//
// 这些断言对应 feiyue-grinder.user.js 里新增的 solveExam 配套函数:
//   examRemainSec / examAnswered / examNextBtn / examCards / examSubmitBtn
// 用户脚本里这些函数在 IIFE 内未导出,这里【忠实重写同款逻辑】(改全局 document→显式 root)
// 在 jsdom 还原的 examContent DOM 上跑,验证正则/选择器与真实页面一致。
// 改脚本对应逻辑时需同步本文件。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractQuestion } from './sxz-core.mjs';

const BLOCK = new Set(['DIV', 'P', 'LI', 'TR', 'BR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE', 'BUTTON', 'SPAN']);
function installInnerText(win) {
  const proto = win.HTMLElement.prototype;
  if (Object.getOwnPropertyDescriptor(proto, 'innerText')) return;
  function compute(node) {
    let out = ''; const NODE = win.Node;
    node.childNodes.forEach((child) => {
      if (child.nodeType === NODE.TEXT_NODE) out += child.textContent;
      else if (child.nodeType === NODE.ELEMENT_NODE) {
        const tag = child.tagName; if (tag === 'BR') { out += '\n'; return; }
        if (tag === 'SCRIPT' || tag === 'STYLE') return;
        const inner = compute(child); out += BLOCK.has(tag) ? '\n' + inner + '\n' : inner;
      }
    });
    return out;
  }
  Object.defineProperty(proto, 'innerText', { configurable: true, get() { return compute(this).replace(/[ \t\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, ''); } });
}
function make(html) { const dom = new JSDOM(html); installInnerText(dom.window); return dom.window.document; }

// ---- 与脚本同款工具(显式 root) ----
const q = (s, r) => { try { return r.querySelector(s); } catch (e) { return null; } };
const qa = (s, r) => { try { return [...r.querySelectorAll(s)]; } catch (e) { return []; } };
const vis = (el) => !!el;
function findByText(root, re, tags) { return qa(tags || 'div,span,button,a,p,li', root).find((el) => vis(el) && el.children.length <= 1 && re.test((el.innerText || el.textContent || '').trim())); }

// ---- 被测逻辑(从脚本忠实重写,root 显式化) ----
function examRemainSec(doc) {
  const body = doc.body.innerText || '';
  const m = body.match(/剩余\s*时间[:：]?\s*(\d{1,2})\s*[:：]\s*(\d{1,2})(?:\s*[:：]\s*(\d{1,2}))?/);
  if (!m) { const m2 = body.match(/(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})/); if (m2) return (+m2[1]) * 3600 + (+m2[2]) * 60 + (+m2[3]); return null; }
  return m[3] != null ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
}
function examAnswered(doc) { const m = (doc.body.innerText || '').match(/已答[:：]?\s*(\d+)\s*\/\s*(\d+)/); return { a: m ? +m[1] : 0, t: m ? +m[2] : 0 }; }
function examSubmitBtn(doc) { return q('.hand-exams-btn', doc) || findByText(doc, /^交卷$/, 'button,div,span,p,a'); }
function examNextBtn(doc) {
  const byText = qa('.subject-btn', doc).filter(vis).find((e) => /^下一题$/.test((e.innerText || '').trim()));
  if (byText) return byText;
  const t = findByText(doc, /^下一题$/, '.subject-btn,button,div,span'); if (t) return t;
  return qa('.subject-btn', doc).filter(vis).find((e) => !/上一题|存疑|收藏|标记|交卷/.test((e.innerText || '').trim())) || null;
}
function examCards(doc) {
  let items = qa('.answer-card-item, .card-item, .answerSheet-item, .question-card-item, [class*="card"] [class*="item"]', doc).filter(vis);
  if (!items.length) items = qa('li,div,span,a,button', doc).filter((e) => vis(e) && e.children.length <= 1 && /^(第?\s*\d{1,3}\s*题?)$/.test((e.innerText || '').trim()));
  const seen = new Set(), out = [];
  items.forEach((el) => {
    const m = (el.innerText || '').trim().match(/(\d{1,3})/); if (!m) return;
    const n = +m[1]; if (n < 1 || n > 200 || seen.has(n)) return; seen.add(n);
    const cls = ' ' + (el.className || '') + ' ' + ((el.parentElement && el.parentElement.className) || '') + ' ';
    const answered = /(answered|done|finished|completed|active-done|is-answered|has-answer|selected)/i.test(cls);
    out.push({ n, el, answered });
  });
  out.sort((a, b) => a.n - b.n);
  return out;
}

// ---- examContent DOM(基于 CDP 实测:水印 + 题型 + 已答 X/50 + 剩余时间 + 交卷 + 下一题/存疑 + 答题卡) ----
function examPage({ remain = '00:59:42', answered = 3, total = 50, index = 4, type = '单选题', nextText = '下一题', cardCount = 50, answeredUpto = 3 } = {}) {
  const cards = [];
  for (let i = 1; i <= cardCount; i++) cards.push(`<div class="answer-card-item ${i <= answeredUpto ? 'answered' : ''}">${i}</div>`);
  return make(`<!DOCTYPE html><html><body>
  <div class="exam-watermark">张三 工号123</div>
  <div class="exam-header"><span>已答：${answered}/${total}</span><span>剩余时间：${remain}</span><button class="hand-exams-btn">交卷</button></div>
  <div class="contentArea"><div class="test-content">
    <div class="ks-title"><span class="type-name">${type}</span> 第${index}/${total}题</div>
    <div class="subject"><div class="subject-title">下列说法正确的是?</div>
      <div class="option-list">
        <div class="option-list-item"><label class="option-list"><span class="option-content-wrapper"><div class="option-order-str">A.</div><div class="option-content">选项甲</div></span></label></div>
        <div class="option-list-item"><label class="option-list"><span class="option-content-wrapper"><div class="option-order-str">B.</div><div class="option-content">选项乙</div></span></label></div>
      </div></div>
    <div class="subject-btns"><div class="subject-btn">上一题</div><div class="subject-btn">${nextText}</div><div class="subject-btn">存疑</div></div>
  </div></div>
  <div class="answer-card">${cards.join('')}</div>
  </body></html>`);
}

test('examRemainSec 解析 HH:MM:SS', () => {
  assert.equal(examRemainSec(examPage({ remain: '00:59:42' })), 59 * 60 + 42);
  assert.equal(examRemainSec(examPage({ remain: '01:00:00' })), 3600);
  assert.equal(examRemainSec(examPage({ remain: '剩余时间：00:01:29'.replace('剩余时间：', '') })), 89);
});

test('examRemainSec 临界:剩余 < 90s 触发(89s)', () => {
  const s = examRemainSec(examPage({ remain: '00:01:29' }));
  assert.ok(s <= 90, '应判定为临界');
  assert.equal(s, 89);
});

test('examRemainSec 充裕:59:42 不触发', () => {
  const s = examRemainSec(examPage({ remain: '00:59:42' }));
  assert.ok(s > 90);
});

test('examAnswered 解析 已答 X/50', () => {
  assert.deepEqual(examAnswered(examPage({ answered: 12, total: 50 })), { a: 12, t: 50 });
  assert.deepEqual(examAnswered(examPage({ answered: 50, total: 50 })), { a: 50, t: 50 });
});

test('examSubmitBtn 命中 .hand-exams-btn(非 .submit-btn)', () => {
  const doc = examPage();
  const btn = examSubmitBtn(doc);
  assert.ok(btn);
  assert.ok(/hand-exams-btn/.test(btn.className));
  assert.equal((btn.innerText || '').trim(), '交卷');
});

test('examNextBtn 取"下一题"而非"上一题"/"存疑"', () => {
  const btn = examNextBtn(examPage({ nextText: '下一题' }));
  assert.ok(btn);
  assert.equal((btn.innerText || '').trim(), '下一题');
});

test('examNextBtn 末题无"下一题"→ 兜底排除上一题/存疑(返回 null,因只剩这俩)', () => {
  // 末题:把"下一题"也命名为"存疑"模拟无下一题
  const doc = examPage({ nextText: '存疑' });
  const btn = examNextBtn(doc); // 只剩 上一题/存疑/存疑 → 全被排除
  assert.equal(btn, null);
});

// ---- v2.9.3:入口/重考按钮托管 + 复盘页防护(从脚本忠实复刻) ----
const EXAM_ARM_RE = /^(开始考试|再考一次|再考一次！?|重新考试|再次考试|重新开始考试|继续考试|重新作答)$/;
// 注意:结果汇总页"答题详情/考试报告"是按钮文字、"您的得分"非"我的得分",不能用来判复盘;只认每题级"正确答案：X"/"我的得分："
function isExamReviewPage(doc) { try { return /正确答案[：:]\s*[A-Z]|我的得分[：:]/.test((doc.body && doc.body.innerText) || ''); } catch (e) { return false; } }
// 复盘页:examContent 路由 + .type-name + 但每题含"正确答案：X" → 应判为只读复盘
function reviewPage() {
  const doc = examPage();
  const fb = doc.createElement('div');
  fb.innerHTML = '<div class="result-feedback">太遗憾，答错了！ 我的得分：0 分 正确答案：D 错题反馈</div>';
  doc.body.appendChild(fb);
  return doc;
}
// 结果汇总页:得分/通过 + 「再考一次」「答题详情」「考试报告」按钮(用"您的得分",无每题"正确答案")→ 不是复盘,需可点再考一次
function resultSummaryPage() {
  return make('<!DOCTYPE html><html><body><div class="exam-result"><div>考试结果</div><div>您的得分 ： 0 分</div><div>是否通过 ： 未通过</div><div>客观题正确题数 : 0/50</div><div class="btns"><span>再考一次</span><span>答题详情</span><span>考试报告</span></div></div></body></html>');
}

test('EXAM_ARM_RE 匹配"开始考试"与各种"再考一次"重考措辞', () => {
  ['开始考试', '再考一次', '再考一次！', '重新考试', '再次考试', '重新作答'].forEach((t) => assert.ok(EXAM_ARM_RE.test(t), `应匹配 ${t}`));
});
test('EXAM_ARM_RE 不误匹配无关文案', () => {
  ['考试', '交卷', '提交', '开始测验', '查看详情', '我已阅读'].forEach((t) => assert.ok(!EXAM_ARM_RE.test(t), `不应匹配 ${t}`));
});
test('isExamReviewPage:含每题"正确答案：X/我的得分："的复盘页 → true;纯作答页 → false', () => {
  assert.equal(isExamReviewPage(reviewPage()), true);
  assert.equal(isExamReviewPage(examPage()), false);
});
test('★结果汇总页不被误判为复盘(避免卡"加载中"):有"答题详情/考试报告"按钮+"您的得分"但无每题"正确答案" → false', () => {
  assert.equal(isExamReviewPage(resultSummaryPage()), false);
  // 且「再考一次」可被入口按钮正则识别(arm)
  assert.ok(EXAM_ARM_RE.test('再考一次'));
});
test('复盘页防护:onExamPage 在复盘页应被否决(绝不自动作答只读复盘)', () => {
  // onExamPage = (examContent 路由 || iexam+水印+题型) && !isExamReviewPage
  const onExamPage = (doc) => (!!q('.exam-watermark', doc) && !!q('.type-name', doc)) && !isExamReviewPage(doc);
  assert.equal(onExamPage(examPage()), true);    // 真实作答页:托管
  assert.equal(onExamPage(reviewPage()), false); // 复盘页:不托管
});

// ---- v2.9.5:交卷确认按钮选择(从脚本忠实复刻 examConfirmBtn,root 显式化) ----
function examConfirmBtn(doc) {
  const norm = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, '');
  const NO = /取消|继续作答|继续答题|返回|放弃|再想想|再检查|关闭|稍后|我再想/;
  const pool = qa('.ant-modal-confirm-btns button, .ant-modal-footer button, .ant-modal button, [class*=dialog] button, [class*=modal] button, [class*=popup] button, button, [class*=btn], span, div', doc)
    .filter((e) => vis(e) && e.children.length <= 2 && !/hand-exams-btn/.test('' + (e.className || '')) && !NO.test(norm(e)));
  let ok = pool.find((e) => /^(确定|确认)(交卷|提交)?[!！]?$|^(交卷|提交|是的?|好的)$/.test(norm(e)));
  if (ok) return ok;
  ok = pool.find((e) => /(确认|确定)[\s\S]{0,8}(交卷|提交)|(交卷|提交)[\s\S]{0,8}(确认|确定)/.test(norm(e)));
  if (ok) return ok;
  return qa('.ant-modal-confirm-btns .ant-btn-primary, .ant-modal-footer .ant-btn-primary, .ant-modal .ant-btn-primary, [class*=modal] [class*=primary]', doc)
    .filter((e) => vis(e) && !NO.test(norm(e)))[0] || null;
}
function submitModal(html) { return make('<!DOCTYPE html><html><body><div class="hand-exams-btn">交卷</div>' + html + '</body></html>'); }

test('交卷确认:并排「继续作答 / 确认交卷」→ 点「确认交卷」(不点继续作答)', () => {
  const doc = submitModal('<div class="ant-modal"><div class="ant-modal-footer"><button class="ant-btn">继续作答</button><button class="ant-btn ant-btn-primary">确认交卷</button></div></div>');
  const b = examConfirmBtn(doc);
  assert.ok(b); assert.equal((b.innerText || '').replace(/\s+/g, ''), '确认交卷');
});
test('交卷确认:「取消 / 确定」→ 点「确定」', () => {
  const doc = submitModal('<div class="ant-modal"><div class="ant-modal-footer"><button>取消</button><button class="ant-btn-primary">确定</button></div></div>');
  assert.equal((examConfirmBtn(doc).innerText || '').replace(/\s+/g, ''), '确定');
});
test('交卷确认:带空格「确 认 交 卷」+ 计数后缀也能命中', () => {
  const doc = submitModal('<div class="ant-modal"><div class="ant-modal-footer"><button>继续作答</button><button class="ant-btn-primary">确 认 交 卷（已答50/50）</button></div></div>');
  const b = examConfirmBtn(doc);
  assert.ok(b); assert.ok(/确认交卷/.test((b.innerText || '').replace(/\s+/g, '')));
});
test('交卷确认:绝不返回 .hand-exams-btn 自身 / 不返回取消类', () => {
  const doc = submitModal('<div class="ant-modal"><div class="ant-modal-footer"><button>继续作答</button><button>取消</button></div></div>');
  const b = examConfirmBtn(doc); // 无任何确认按钮 → null(宁可不点也不误点取消/交卷本身)
  assert.equal(b, null);
});

// ---- v2.9.8:答案来源三选一(复刻 getAnswer 门控:'bank'仅题库 / 'ai'仅AI跳过题库 / 'ai_bank'题库优先+AI兜底) ----
function answerPolicy(src) { return { tryBank: src !== 'ai', fallAI: src !== 'bank' }; }
test('答案来源策略:仅题库 / 仅AI / 题库优先+AI兜底 三态正确', () => {
  assert.deepEqual(answerPolicy('bank'), { tryBank: true, fallAI: false });   // 仅题库:查库,命中才答,不调 AI
  assert.deepEqual(answerPolicy('ai'), { tryBank: false, fallAI: true });     // 仅AI:跳过题库,直接 AI
  assert.deepEqual(answerPolicy('ai_bank'), { tryBank: true, fallAI: true }); // 默认:题库优先,未命中才 AI 兜底
});

// ---- v2.9.10:防全A废卷 + 10分钟用时门槛(复刻 solveExam 守卫) ----
test('防全A废卷:真实命中(题库/AI)<40% → 不自动交卷', () => {
  const enough = (okN, total) => okN >= Math.ceil(total * 0.4);
  assert.equal(enough(0, 50), false);   // 全选A(0 命中)→ 拦截不交
  assert.equal(enough(15, 50), false);  // 15/50=30% → 拦截
  assert.equal(enough(20, 50), true);   // 20/50=40% → 放行
  assert.equal(enough(47, 50), true);
});
test('答题用时<10min 等够再交;时间临界立即交', () => {
  const ready = (elapsedSec, timeCritical) => timeCritical || elapsedSec >= 600;
  assert.equal(ready(120, false), false); // 用时 2 分 → 继续等
  assert.equal(ready(599, false), false);
  assert.equal(ready(600, false), true);  // 满 10 分 → 交
  assert.equal(ready(120, true), true);   // 剩余时间临界 → 立即交(优先级最高)
});
test('考试自检:按 answerSource 判可用来源(题库可达/有Key 任一即可)', () => {
  const ok = (src, bankUp, haveKey) => ((src !== 'ai') && bankUp) || ((src !== 'bank') && haveKey);
  assert.equal(ok('ai_bank', false, false), false); // 题库不可达+无Key → 暂停
  assert.equal(ok('ai_bank', true, false), true);   // 题库可达 → 可答
  assert.equal(ok('ai_bank', false, true), true);   // 有Key → 可答
  assert.equal(ok('bank', false, true), false);     // 仅题库但题库不可达 → 暂停(Key 不算)
  assert.equal(ok('ai', true, false), false);       // 仅AI但无Key → 暂停(题库不算)
});

// ---- v2.9.11:结课考试 live 页题干提取(根因:无 .test-content → 旧逻辑 fallback body 吞答题卡/头部 → 题库 0 命中) ----
// 复刻真实 DOM:头部(姓名/考号/剩余时间) + 答题卡(第1题…) + 右侧题目块 .right-subjects-inner(题型+题干+选项+导航)
function liveExamQuestionPage() {
  let cards = '';
  for (let i = 1; i <= 50; i++) cards += `<div class="card-cell">第${i}题 （2 分）</div>`;
  return make(`<!DOCTYPE html><html><body>
    <div class="exam-watermark">赵文彪</div>
    <div class="exam-header">姓名：赵文彪 考号： 满分：100 分 及格：70 分 剩余时间：00:32:55</div>
    <div class="exam-content"><div class="answer-card">单选题 32 题 ${cards} 多选题 18 题</div></div>
    <div class="right-subjects"><div class="right-subjects-inner">
      <div class="ks-title"><span class="type-name">多选题</span> 第50/50题 尝试键盘方向键，切换上下题吧</div>
      <div class="topic">50、 在需求收集过程中，访谈的核心提问阶段通常包括哪些层面的问题？</div>
      <div class="option-list">
        <div class="option-list-item"><span class="option-order-str">A.</span><span class="option-content">业务目标层</span></div>
        <div class="option-list-item"><span class="option-order-str">B.</span><span class="option-content">工作流程层</span></div>
        <div class="option-list-item"><span class="option-order-str">C.</span><span class="option-content">需求期望层</span></div>
        <div class="option-list-item"><span class="option-order-str">D.</span><span class="option-content">技术实现层</span></div>
      </div>
      <div class="subject-btns"><span>上一题</span><span>存疑</span><span>交卷</span></div>
    </div></div>
  </body></html>`);
}
test('★live考试题干:取题目块而非整页(不含 姓名/考号/答题卡),且去题号前缀', () => {
  const doc = liveExamQuestionPage();
  const qd = extractQuestion(doc.body);
  assert.equal(qd.type, '多选题');
  assert.equal(qd.stem, '在需求收集过程中，访谈的核心提问阶段通常包括哪些层面的问题？');
  // 绝不能混入头部/答题卡垃圾
  assert.ok(!/姓名|考号|剩余时间|第1题|满分|答题/.test(qd.stem), '题干混入了页面垃圾: ' + qd.stem);
  assert.deepEqual(qd.options.map((o) => o.letter), ['A', 'B', 'C', 'D']);
  assert.equal(qd.options[0].text, '业务目标层');
});

test('force 强制重答:已答/已满分也重新作答不跳过', () => {
  const shouldAnswer = (force, answered) => force || !answered;        // solveExam / examFillUnanswered 门控
  const skipPerfect = (force, perfect) => !force && perfect;           // solveQuiz 满分跳过门控
  assert.equal(shouldAnswer(false, true), false);  // 默认:已答 → 跳过
  assert.equal(shouldAnswer(false, false), true);  // 默认:未答 → 作答
  assert.equal(shouldAnswer(true, true), true);    // force:已答也重答
  assert.equal(skipPerfect(false, true), true);    // 默认:满分 → 跳过
  assert.equal(skipPerfect(true, true), false);    // force:满分也重做
});

test('examCards 提取 50 题、题号有序、已答标记正确', () => {
  const cards = examCards(examPage({ cardCount: 50, answeredUpto: 3 }));
  assert.equal(cards.length, 50);
  assert.equal(cards[0].n, 1);
  assert.equal(cards[49].n, 50);
  assert.equal(cards[0].answered, true);   // 第1题已答
  assert.equal(cards[2].answered, true);   // 第3题已答
  assert.equal(cards[3].answered, false);  // 第4题未答
  const unanswered = cards.filter((c) => !c.answered).map((c) => c.n);
  assert.deepEqual(unanswered.slice(0, 3), [4, 5, 6]);
});
