// v2.8 云题库"按正确选项内容匹配字母"测试(核心:防选项乱序 + 标点容差 + 精准)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lettersFromTexts, normStem } from './sxz-core.mjs';

const Q = (...opts) => ({ options: opts.map((t, i) => ({ letter: 'ABCD'[i], text: t })) });

test('精确命中:正确内容→对应字母', () => {
  const qd = Q('明确项目预算和团队分工', '将模糊的想法转化为清晰、可落地的需求', '设计系统架构', '完成开发与测试');
  assert.deepEqual(lettersFromTexts(qd, ['将模糊的想法转化为清晰、可落地的需求']), ['B']);
});

test('★防选项乱序:同内容换到不同位置 → 仍命中正确字母(不是位置)', () => {
  // 正确内容固定,但选项顺序变了:正确内容现在排在 A 位
  const qd = Q('将模糊的想法转化为清晰、可落地的需求', '明确项目预算和团队分工', '设计系统架构', '完成开发与测试');
  assert.deepEqual(lettersFromTexts(qd, ['将模糊的想法转化为清晰、可落地的需求']), ['A']);
});

test('标点/空格差异容差:存"、"现"," 仍命中', () => {
  const qd = Q('明确预算', '将模糊的想法转化为清晰,可落地的需求', '设计架构');
  // 题库里存的是顿号版本,当前选项是逗号版本
  assert.deepEqual(lettersFromTexts(qd, ['将模糊的想法转化为清晰、可落地的需求']), ['B']);
});

test('多选:多个正确内容 → 多个字母', () => {
  const qd = Q('复杂性', '一致性', '可变性', '不可见性');
  assert.deepEqual(lettersFromTexts(qd, ['复杂性', '可变性']).sort(), ['A', 'C']);
});

test('多选乱序:正确内容散落不同位置 → 命中对应字母', () => {
  const qd = Q('可变性', '一致性', '不可见性', '复杂性');
  assert.deepEqual(lettersFromTexts(qd, ['复杂性', '可变性']).sort(), ['A', 'D']);
});

test('不匹配:正确内容不在当前选项 → 空(交给 AI 兜底,不乱选)', () => {
  const qd = Q('明确预算', '设计架构', '完成测试');
  assert.deepEqual(lettersFromTexts(qd, ['将模糊的想法转化为清晰可落地的需求']), []);
});

test('高重叠子串容差:存的内容比选项多/少几个字仍命中', () => {
  const qd = Q('代码规范和低耦合设计', '需求评审', '单元测试');
  assert.deepEqual(lettersFromTexts(qd, ['代码规范和低耦合设计（流程层面）'.replace('（流程层面）', '')]), ['A']);
  // 选项是题库内容的高重叠子串
  const qd2 = Q('代码规范和低耦合设计方法', '需求评审');
  assert.deepEqual(lettersFromTexts(qd2, ['代码规范和低耦合设计']), ['A']);
});

test('短选项精确才命中:避免短串误配', () => {
  // "对"/"错" 这类极短选项:必须精确相等才命中(长度<4不走子串)
  const qd = Q('正确', '错误');
  assert.deepEqual(lettersFromTexts(qd, ['正确']), ['A']);
  assert.deepEqual(lettersFromTexts(qd, ['错误']), ['B']);
});

test('normStem 去标点+小写一致', () => {
  assert.equal(normStem('清晰、可落地'), normStem('清晰,可落地'));
  assert.equal(normStem('ABC 测试！'), 'abc测试');
});
