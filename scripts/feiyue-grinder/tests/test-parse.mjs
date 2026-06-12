// test-parse.mjs — parseLetters
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLetters } from './sxz-core.mjs';

// 单选 qd：A-D 四选项
const single = {
  type: '单选题',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
    { letter: 'C', text: '丙' },
    { letter: 'D', text: '丁' },
  ],
};
// 多选 qd：A-D 四选项
const multi = { type: '多选题', options: single.options };
// 判断 qd：A.正确 B.错误
const judge = {
  type: '判断题',
  options: [
    { letter: 'A', text: '正确' },
    { letter: 'B', text: '错误' },
  ],
};

test("单选 'B' → ['B']", () => {
  assert.deepEqual(parseLetters('B', single), ['B']);
});

test("单选 '答案是B' → ['B']", () => {
  assert.deepEqual(parseLetters('答案是B', single), ['B']);
});

test("多选 'ABD' → ['A','B','D']", () => {
  assert.deepEqual(parseLetters('ABD', multi), ['A', 'B', 'D']);
});

test("判断 '正确' → 对应字母 A", () => {
  // 'A' 不在 content 里时走文本兜底：'正确/对' → 命中含「正确」的选项 = A
  assert.deepEqual(parseLetters('正确', judge), ['A']);
});

test("判断 '错误' → 对应字母 B", () => {
  assert.deepEqual(parseLetters('这个说法是错误的', judge), ['B']);
});

test("单选噪声 'A 或 C 都行(单选)' → 只取第一个合法字母 A", () => {
  // 大写后含 A C（C 来自「都行」无关，实际是字母 A、C），单选 slice(0,1) → ['A']
  assert.deepEqual(parseLetters('A 或 C 都行', single), ['A']);
});

test('超出范围字母被过滤（valid 只有 A/B 时 D 被丢弃）', () => {
  assert.deepEqual(parseLetters('D', judge), []); // judge 只有 A/B，D 不合法且无文本兜底
  assert.deepEqual(parseLetters('选 E 或 B', single), ['B']); // E 不合法被过滤，留 B
});

test('多选去重：重复字母只保留一次', () => {
  assert.deepEqual(parseLetters('AABBA', multi), ['A', 'B']);
});

test('单选只取第一个：多字母输入也 slice(0,1)', () => {
  assert.deepEqual(parseLetters('BCD', single), ['B']);
});
