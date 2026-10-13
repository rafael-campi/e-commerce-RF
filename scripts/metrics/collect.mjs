// Gera site/metrics.json e copia a página para site/ (publicado no GitHub Pages).
// Uso: node scripts/metrics/collect.mjs   (precisa de histórico git completo)
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, summarize } from './lib.mjs';

// Primeiro commit da fase TDD: infraestrutura e2e com banco de teste isolado.
const BASELINE_SHA = 'cd0567c';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'site');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const commits = git('log', '--format=%H|%aI|%s')
  .split('\n')
  .map((l) => {
    const [sha, date, ...rest] = l.split('|');
    return { sha, date, subject: rest.join('|') };
  });

const classified = classify(commits, BASELINE_SHA);
const baselineDate = classified.find((c) => c.sha.startsWith(BASELINE_SHA)).date;

async function fetchIssues() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return [];
  const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return (await res.json())
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      createdAt: i.created_at,
      closedAt: i.closed_at,
      labels: i.labels.map((l) => l.name),
    }));
}

const issues = await fetchIssues();

mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, 'metrics.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseline: { sha: BASELINE_SHA, date: baselineDate },
      summary: summarize(classified, issues, baselineDate),
      commits: classified.map(({ sha, date, type, scope, phase, subject }) => ({
        sha: sha.slice(0, 7), date, type, scope, phase, subject,
      })),
      bugIssues: issues.filter((i) => i.labels.includes('bug')),
    },
    null,
    2,
  ),
);
copyFileSync(join(here, 'index.html'), join(out, 'index.html'));
console.log(`site/ gerado: ${commits.length} commits, ${issues.length} issues`);
