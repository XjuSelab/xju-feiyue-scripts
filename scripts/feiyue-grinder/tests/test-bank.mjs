// test-bank.mjs — bankLookup（归一化子串双向匹配）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankLookup } from './sxz-core.mjs';

test('完整命中：value 为字符串 "B" → ["B"]', () => {
  const bank = { '在软件开发流程中，需求分析阶段的核心目标是什么？': 'B' };
  assert.deepEqual(bankLookup(bank, '在软件开发流程中，需求分析阶段的核心目标是什么？'), ['B']);
});

test('子串命中：题库 key 是题干的子串', () => {
  const bank = { 需求分析阶段的核心目标: 'B' };
  assert.deepEqual(bankLookup(bank, '在软件开发流程中，需求分析阶段的核心目标是什么？'), ['B']);
});

test('反向子串命中：题干是题库 key 的子串（双向）', () => {
  const bank = { '在软件开发流程中需求分析阶段的核心目标是什么': 'B' };
  assert.deepEqual(bankLookup(bank, '需求分析阶段的核心目标'), ['B']);
});

test('标点 / 空白差异被归一化后仍命中', () => {
  const bank = { '需求 分析、阶段的核心目标？': 'B' };
  // 题干无空白、用不同标点
  assert.deepEqual(bankLookup(bank, '需求分析阶段的核心目标。'), ['B']);
});

test('value 为数组 ["A","C"] → 原样返回', () => {
  const bank = { 需求工程的主要活动: ['A', 'C'] };
  assert.deepEqual(bankLookup(bank, '软件需求工程的主要活动有哪些'), ['A', 'C']);
});

test('value 为无分隔字符串 "ABD" → 逐字母拆分 ["A","B","D"]（v2.5 修复）', () => {
  // 修复后 bankLookup 用 String(v).toUpperCase().match(/[A-Z]/g) 逐字母提取,
  // 多选答案写成 "ABD" 也能正确拆成 A/B/D。
  const bank = { 多选题干: 'ABD' };
  assert.deepEqual(bankLookup(bank, '这是一道多选题干示例'), ['A', 'B', 'D']);
});

test('value 为分隔字符串 "A,B,D" → ["A","B","D"]（多选正确写法）', () => {
  const bank = { 多选题干: 'A,B,D' };
  assert.deepEqual(bankLookup(bank, '这是一道多选题干示例'), ['A', 'B', 'D']);
});

test('value 为带分隔符字符串 "A C" → ["A","C"]', () => {
  const bank = { 某题干: 'A C' };
  assert.deepEqual(bankLookup(bank, '某题干内容'), ['A', 'C']);
});

test('未命中 → null', () => {
  const bank = { 完全不相关的题目: 'C' };
  assert.equal(bankLookup(bank, '在软件开发流程中，需求分析阶段的核心目标是什么？'), null);
});

test('空 stem → null', () => {
  assert.equal(bankLookup({ x: 'A' }, ''), null);
  assert.equal(bankLookup({ x: 'A' }, null), null);
});

test('空题库 → null', () => {
  assert.equal(bankLookup({}, '任意题干'), null);
});
