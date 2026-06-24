// 章习题/云题库 纯函数单测：qNorm 归一化 / lettersFromTexts 内容→字母(防选项乱序) /
// parseQuizAnswers JSON 容错 / answerContent 答案→正确内容(入库用)。vm 沙箱，无依赖。
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('./feiyue-solver.user.js', import.meta.url), 'utf8');
const noop = () => {};
const ctx = { document: { readyState: 'loading', addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, body: { innerHTML: '' }, title: '' }, location: { origin: 'http://x', pathname: '/x', search: '', href: 'http://x/' }, navigator: { userAgent: 'node' }, GM_addStyle: noop, GM_getValue: (k, d) => d, GM_setValue: noop, GM_deleteValue: noop, GM_registerMenuCommand: noop, GM_xmlhttpRequest: noop, GM_setClipboard: noop, GM_info: { script: { version: 'x' } }, TextDecoder, setTimeout, clearTimeout, setInterval, clearInterval, console, Date, JSON, Math, RegExp, String, Object, Array, Number, Set };
ctx.window = ctx; ctx.globalThis = ctx; ctx.window.__CGAI_EXPOSE__ = true;
vm.createContext(ctx); vm.runInContext(src, ctx);
const { qNorm, lettersFromTexts, parseQuizAnswers, answerContent, gapPairsFrom, quizFullFrom } = ctx.window.__CGAI_API__;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x != null ? '— ' + JSON.stringify(x) : ''); } };

// qNorm：小写 + 去空白/标点（中英标点都去）
ok('qNorm 去空白标点+小写', qNorm('Hello, 世界！ ') === 'hello世界', qNorm('Hello, 世界！ '));

// lettersFromTexts：按「正确选项内容」在当前题匹配字母（关键：防选项乱序）
const opts = [{ letter: 'A', text: 'JDBC 默认手动提交事务' }, { letter: 'B', text: '通过 connection.setAutoCommit(false) 开启手动事务管理' }, { letter: 'C', text: '事务回滚使用 commit() 方法' }, { letter: 'D', text: '事务提交使用 rollback() 方法' }];
ok('内容→字母 B', JSON.stringify(lettersFromTexts(opts, ['通过 connection.setAutoCommit(false) 开启手动事务管理'])) === JSON.stringify(['B']));
const shuf = [{ letter: 'A', text: '事务回滚使用 commit() 方法' }, { letter: 'B', text: 'JDBC 默认手动提交事务' }, { letter: 'C', text: '通过 connection.setAutoCommit(false) 开启手动事务管理' }, { letter: 'D', text: '事务提交使用 rollback() 方法' }];
ok('选项乱序→字母随内容变 C', JSON.stringify(lettersFromTexts(shuf, ['通过 connection.setAutoCommit(false) 开启手动事务管理'])) === JSON.stringify(['C']));
ok('多选两内容→AB', JSON.stringify(lettersFromTexts(opts, ['JDBC 默认手动提交事务', '通过 connection.setAutoCommit(false) 开启手动事务管理']).sort()) === JSON.stringify(['A', 'B']));
ok('无匹配→空', lettersFromTexts(opts, ['不存在的内容xyz']).length === 0);

// parseQuizAnswers：从模型输出里抠 JSON（裸/围栏/前后噪声/坏值）
ok('裸 JSON', JSON.stringify(parseQuizAnswers('{"17011":"B","17012":"正确"}')) === JSON.stringify({ '17011': 'B', '17012': '正确' }));
ok('markdown 围栏', parseQuizAnswers('```json\n{"1":"A"}\n```')['1'] === 'A');
ok('前后噪声', parseQuizAnswers('好的：{"1":"D"} 完毕')['1'] === 'D');
ok('坏 JSON→{}', JSON.stringify(parseQuizAnswers('不是 json')) === '{}');

// answerContent：答案→「正确内容」(满分入库用)
ok('choice→选项内容', JSON.stringify(answerContent({ type: 'choice', options: opts }, 'B')) === JSON.stringify(['通过 connection.setAutoCommit(false) 开启手动事务管理']));
ok('choice 多选→多内容', answerContent({ type: 'choice', options: opts }, 'AB').length === 2);
ok('judge 对→正确', JSON.stringify(answerContent({ type: 'judge' }, '对')) === JSON.stringify(['正确']));
ok('judge 错→错误', JSON.stringify(answerContent({ type: 'judge' }, '错误')) === JSON.stringify(['错误']));
ok('fill→原文', JSON.stringify(answerContent({ type: 'fill' }, 'a==b')) === JSON.stringify(['a==b']));

// gapPairsFrom：填空题流式「半截 JSON」抽已闭合的空答案对（边生成边填空用）
ok('完整对全取', JSON.stringify(gapPairsFrom('{"1":"abc","2":"def"}')) === JSON.stringify({ '1': 'abc', '2': 'def' }));
ok('半截只取已闭合', JSON.stringify(gapPairsFrom('{"1":"abc","2":"de')) === JSON.stringify({ '1': 'abc' }));
ok('转义引号还原', gapPairsFrom('{"1":"a\\"b"}')['1'] === 'a"b');
ok('转义换行还原', gapPairsFrom('{"3":"x\\ny"}')['3'] === 'x\ny');
ok('非数字键忽略', JSON.stringify(gapPairsFrom('{"x":"y"}')) === '{}');

// quizFullFrom：解析页面「作业满分：X」真实满分（修复 5题×20=100 的 80分误判）
ok('作业满分 100(10题)', quizFullFrom('作业满分：100.00，共 10道 题') === 100);
ok('作业满分 100(5题×20)', quizFullFrom('作业满分: 100.00，共 5道 题') === 100);
ok('作业满分 半角冒号', quizFullFrom('作业满分:80.00') === 80);
// 真页实测 DOM 串（CDP assignID=71）：全角冒号「：」+全角空格「　」+全角逗号——\s 须能吃全角空格 U+3000
ok('作业满分 真页全角空格', quizFullFrom('重新抽取题目 作业满分： 100.00 ，共 10道 题 重新抽取') === 100);
ok('无满分→null', quizFullFrom('总分: 80.00') === null);

console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
