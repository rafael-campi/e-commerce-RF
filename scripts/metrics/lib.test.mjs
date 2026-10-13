import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseSubject, summarize } from './lib.mjs';

const log = [
  { sha: 'ccc3', date: '2026-10-08T20:00:00-03:00', subject: 'feat(cart): items' },
  { sha: 'bbb2', date: '2026-10-08T19:00:00-03:00', subject: 'fix(auth): 401' },
  { sha: 'aaa1', date: '2026-10-08T18:00:00-03:00', subject: 'test: add e2e infra' },
  { sha: '9990', date: '2025-02-12T21:00:00-03:00', subject: 'Update README.md' },
  { sha: '8880', date: '2025-01-31T02:00:00-03:00', subject: 'fix: correct param' },
  { sha: '7770', date: '2025-01-30T22:00:00-03:00', subject: 'feat: routes' },
];

test('parseSubject lê tipo e escopo, e cai em other', () => {
  assert.deepEqual(parseSubject('fix(auth): 401'), { type: 'fix', scope: 'auth' });
  assert.deepEqual(parseSubject('feat: x'), { type: 'feat', scope: null });
  assert.deepEqual(parseSubject('Update README.md'), { type: 'other', scope: null });
});

test('classify separa fases pela baseline (inclusive)', () => {
  const c = classify(log, 'aaa1');
  assert.deepEqual(c.map((x) => x.phase), ['tdd', 'tdd', 'tdd', 'pre', 'pre', 'pre']);
});

test('classify falha se a baseline não existe', () => {
  assert.throws(() => classify(log, 'zzzz'), /baseline/);
});

test('summarize conta fixes por fase e bugs escapados', () => {
  const issues = [
    { labels: ['bug'], state: 'open', createdAt: '2026-10-10T00:00:00Z' },
    { labels: ['bug'], state: 'closed', createdAt: '2025-02-01T00:00:00Z' },
    { labels: ['enhancement'], state: 'open', createdAt: '2026-10-10T00:00:00Z' },
  ];
  const s = summarize(classify(log, 'aaa1'), issues, '2026-10-08T22:49:01Z');
  assert.equal(s.pre.fix, 1);
  assert.equal(s.pre.fixRatio, 0.5);
  assert.equal(s.tdd.fix, 1);
  assert.equal(s.tdd.feat, 1);
  assert.deepEqual(s.bugIssues, { total: 2, open: 1, escaped: 1 });
});
