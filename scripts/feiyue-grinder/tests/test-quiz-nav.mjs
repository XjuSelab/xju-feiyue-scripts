// v2.6 测验导航/选择逻辑测试:覆盖"第4题回跳第3题 + 选项被取消"的真实根因。
// 根因(CDP 实测):①.subject-btn 首个是"上一题",点了会回跳 → 必须按文字找"下一题";
//                  ②单选/判断选完平台自动跳题;③多选不自动跳、重复点同一选项会取消选中。
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { isSelected, findByText, selectionPlan } from './sxz-core.mjs';

const dom = (html) => new JSDOM(html).window.document;

test('回跳根因:.subject-btn 首个是「上一题」,必须按文字找「下一题」', () => {
  const doc = dom(`<body><div class="subject-btns">
    <div class="subject-btn">上一题</div><div class="subject-btn">下一题</div></div></body>`);
  assert.equal(doc.querySelector('.subject-btn').textContent.trim(), '上一题', '首个 .subject-btn 是上一题(点了会回跳)');
  const next = findByText(doc, /^下一题$/);
  assert.ok(next && next.textContent.trim() === '下一题', '按文字应命中下一题');
});

test('isSelected:选项内含 kltCourse-radio-checked → true;无 → false', () => {
  const doc = dom(`<body>
    <div class="option-list-item" id="a"><label class="option-list"><em class="exam-icon"><div class="icon-inner"><label class="kltCourse-radio-wrapper kltCourse-radio-checked"></label></div></em></label></div>
    <div class="option-list-item" id="b"><label class="option-list"><em class="exam-icon"><div class="icon-inner"><label class="kltCourse-radio-wrapper"></label></div></em></label></div>
  </body>`);
  assert.equal(isSelected(doc.getElementById('a')), true);
  assert.equal(isSelected(doc.getElementById('b')), false);
});

test('selectionPlan 单选:目标未选→点;已选→不点(避免取消)', () => {
  assert.deepEqual(selectionPlan([{ letter: 'A', sel: false }, { letter: 'B', sel: false }], ['A'], false), { click: ['A'], deselect: [] });
  assert.deepEqual(selectionPlan([{ letter: 'A', sel: true }, { letter: 'B', sel: false }], ['A'], false), { click: [], deselect: [] });
});

test('selectionPlan 多选:只点未选目标,取消非目标已选', () => {
  assert.deepEqual(
    selectionPlan([{ letter: 'A', sel: true }, { letter: 'B', sel: false }, { letter: 'C', sel: true }], ['A', 'B'], true),
    { click: ['B'], deselect: ['C'] }
  );
});

test('selectionPlan 多选:已全部正确选中 → 不做任何点击(防重复点取消)', () => {
  assert.deepEqual(selectionPlan([{ letter: 'A', sel: true }, { letter: 'B', sel: true }], ['A', 'B'], true), { click: [], deselect: [] });
});
