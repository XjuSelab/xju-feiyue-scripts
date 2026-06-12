// v2.7 类型判定(节点名驱动)+ 内容就绪门槛 测试。
// 关键回归:旧逻辑靠残留 DOM(.submit-btn/video/iframe 常驻)判定,切换瞬间会把
// 课件误判成 video、把残留答题态当 quiz_answering 直接交卷。新逻辑以目录节点名为准。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { detectType, contentReady, currentNodeText } from './sxz-core.mjs';

const docOf = (html) => {
  const { window } = new JSDOM(html);
  // jsdom 不实现 innerText;polyfill 成 textContent(脚本在真实浏览器里用 innerText)
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
  return window.document;
};

test('detectType 按节点名:课件→courseware / 随堂测验→quiz / 视频小节→video', () => {
  assert.equal(detectType({ currentNodeText: '本章课件（可下载）' }), 'courseware');
  assert.equal(detectType({ currentNodeText: '随堂测验' }), 'quiz');
  assert.equal(detectType({ currentNodeText: '1.2 软件开发中的问题' }), 'video');
  assert.equal(detectType({ currentNodeText: '本章导读' }), 'video');
});

test('detectType 结课测试:autoFinalTest=false→final,true→quiz', () => {
  assert.equal(detectType({ currentNodeText: '结课测试', autoFinalTest: false }), 'final');
  assert.equal(detectType({ currentNodeText: '结课测试', autoFinalTest: true }), 'quiz');
});

test('detectType 空节点(切换中)→loading', () => {
  assert.equal(detectType({ currentNodeText: '' }), 'loading');
});

test('回归:课件节点不再被残留 video/submit-btn 误判(节点名优先)', () => {
  assert.equal(detectType({ currentNodeText: '本章课件（可下载）' }), 'courseware');
});

test('contentReady video:有视频才就绪', () => {
  assert.equal(contentReady('video', { hasVideo: true }), true);
  assert.equal(contentReady('video', { hasVideo: false }), false);
});

test('contentReady courseware:有 .content-document 才就绪(切换瞬间未加载→false)', () => {
  assert.equal(contentReady('courseware', { root: docOf('<body><div class="content-document"></div></body>') }), true);
  assert.equal(contentReady('courseware', { root: docOf('<body></body>') }), false);
});

test('contentReady quiz:有"再测一次"或(type-name+选项)才就绪;否则等待', () => {
  assert.equal(contentReady('quiz', { root: docOf('<body><div>再测一次</div></body>') }), true);
  assert.equal(contentReady('quiz', { root: docOf('<body><span class="type-name">单选题</span><div class="option-list-item">A</div></body>') }), true);
  assert.equal(contentReady('quiz', { root: docOf('<body></body>') }), false);
});

test('currentNodeText 取 .tree-node-content.is-current', () => {
  const doc = docOf('<body><div class="catalog-tree"><div class="tree-node-content">本章导读</div><div class="tree-node-content is-current">随堂测验</div></div></body>');
  assert.equal(currentNodeText(doc), '随堂测验');
});
