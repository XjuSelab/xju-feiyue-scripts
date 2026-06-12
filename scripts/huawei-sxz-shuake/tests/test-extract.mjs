// test-extract.mjs — extractQuestion / extractOptions（单选 / 多选 / 判断）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuestion, extractOptions } from './sxz-core.mjs';
import { singleChoicePage, multiChoicePage, judgePage } from './fixtures.mjs';

test('单选题：题型 / index/total = 1/5 / answered=0', () => {
  const { root } = singleChoicePage();
  const qd = extractQuestion(root);
  assert.equal(qd.type, '单选题');
  assert.equal(qd.index, 1);
  assert.equal(qd.total, 5);
  assert.equal(qd.answered, 0);
});

test('单选题：options 字母与文本', () => {
  const { root } = singleChoicePage();
  const qd = extractQuestion(root);
  assert.deepEqual(
    qd.options.map((o) => o.letter),
    ['A', 'B', 'C', 'D']
  );
  assert.equal(qd.options[0].text, '明确项目预算和团队分工');
  assert.equal(qd.options[1].text, '将模糊的想法转化为清晰、可落地的需求');
  assert.equal(qd.options[2].text, '设计系统架构和数据库结构');
  assert.equal(qd.options[3].text, '完成前后端功能的开发与测试');
  // option-content 文本已去掉开头的 "A." 之类（order-str 与 content 是分开的元素，本身就不含序号）
  qd.options.forEach((o) => assert.ok(!/^[A-D][\.、．]/.test(o.text), `选项文本不应以序号开头: ${o.text}`));
});

test('单选题：extractOptions 与 extractQuestion.options 一致', () => {
  const { root } = singleChoicePage();
  const direct = extractOptions(root).map((o) => ({ letter: o.letter, text: o.text }));
  const viaQ = extractQuestion(root).options.map((o) => ({ letter: o.letter, text: o.text }));
  assert.deepEqual(direct, viaQ);
});

test('单选题：stem 含题干，且不含选项文本与导航关键字', () => {
  const { root } = singleChoicePage();
  const qd = extractQuestion(root);
  // 含题干
  assert.match(qd.stem, /需求分析阶段的核心目标是什么/);
  // 不含任一选项文本
  qd.options.forEach((o) => assert.ok(!qd.stem.includes(o.text), `stem 不应含选项文本: ${o.text}`));
  // 不含导航 / 题型 / 计数关键字
  for (const kw of ['返回', '随堂测验', '单选题', '交卷', '下一题', '已答', '第1/5题']) {
    assert.ok(!qd.stem.includes(kw), `stem 不应含「${kw}」`);
  }
});

test('多选题：题型为多选题，4 选项 A-D', () => {
  const { root } = multiChoicePage();
  const qd = extractQuestion(root);
  assert.equal(qd.type, '多选题');
  assert.deepEqual(
    qd.options.map((o) => o.letter),
    ['A', 'B', 'C', 'D']
  );
  assert.equal(qd.options.length, 4);
  assert.match(qd.stem, /软件需求工程的主要活动/);
});

test('判断题：题型为判断题，选项 A.正确 / B.错误', () => {
  const { root } = judgePage();
  const qd = extractQuestion(root);
  assert.equal(qd.type, '判断题');
  assert.deepEqual(
    qd.options.map((o) => ({ letter: o.letter, text: o.text })),
    [
      { letter: 'A', text: '正确' },
      { letter: 'B', text: '错误' },
    ]
  );
});
