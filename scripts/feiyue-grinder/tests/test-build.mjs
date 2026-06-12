// test-build.mjs — buildMessages（单选 / 多选 / 判断 的 system+user 结构与文案）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages } from './sxz-core.mjs';

const SYSTEM = '你是严谨的中文选择题答题助手。只输出选项字母,不要解释、不要标点、不要多余文字。';

const single = {
  type: '单选题',
  stem: '需求分析阶段的核心目标是什么',
  options: [
    { letter: 'A', text: '明确预算' },
    { letter: 'B', text: '转化为需求' },
  ],
};
const multi = {
  type: '多选题',
  stem: '主要活动有哪些',
  options: [
    { letter: 'A', text: '获取' },
    { letter: 'B', text: '分析' },
    { letter: 'D', text: '验证' },
  ],
};
const judge = {
  type: '判断题',
  stem: '该说法是否正确',
  options: [
    { letter: 'A', text: '正确' },
    { letter: 'B', text: '错误' },
  ],
};

test('结构：恒为 [system, user] 两条', () => {
  for (const qd of [single, multi, judge]) {
    const m = buildMessages(qd);
    assert.equal(m.length, 2);
    assert.equal(m[0].role, 'system');
    assert.equal(m[1].role, 'user');
    assert.equal(m[0].content, SYSTEM);
  }
});

test('单选：user 含单选规则文案、题干、选项行', () => {
  const [, user] = buildMessages(single);
  assert.match(user.content, /这是单选题/);
  assert.match(user.content, /只输出唯一正确选项的字母/);
  assert.match(user.content, /需求分析阶段的核心目标是什么/);
  assert.match(user.content, /只回答字母:/);
  // 选项行格式 "字母. 文本"
  assert.ok(user.content.includes('A. 明确预算'));
  assert.ok(user.content.includes('B. 转化为需求'));
});

test('多选：user 含多选规则文案（如 ABD 不加分隔）与三行选项', () => {
  const [, user] = buildMessages(multi);
  assert.match(user.content, /这是多选题/);
  assert.match(user.content, /输出所有正确选项字母/);
  assert.match(user.content, /字母间不加任何分隔或空格/);
  assert.ok(user.content.includes('A. 获取'));
  assert.ok(user.content.includes('B. 分析'));
  assert.ok(user.content.includes('D. 验证'));
});

test('判断：user 含判断规则文案（对应 正确/错误 的字母）', () => {
  const [, user] = buildMessages(judge);
  assert.match(user.content, /这是判断题/);
  assert.match(user.content, /对应"正确\/错误"的字母/);
  assert.ok(user.content.includes('A. 正确'));
  assert.ok(user.content.includes('B. 错误'));
  // 判断题不应使用单选 / 多选的规则文案
  assert.ok(!/这是单选题|这是多选题/.test(user.content));
});

test('选项行格式严格为 "字母. 文本"（点 + 空格）', () => {
  const [, user] = buildMessages(single);
  const lines = user.content.split('\n');
  assert.ok(lines.some((l) => l === 'A. 明确预算'));
  assert.ok(lines.some((l) => l === 'B. 转化为需求'));
});
