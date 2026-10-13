// Funções puras do coletor de métricas de defeitos (testadas em lib.test.mjs).

export function parseSubject(subject) {
  const m = /^(\w+)(?:\(([^)]*)\))?!?:\s/.exec(subject);
  return m ? { type: m[1].toLowerCase(), scope: m[2] ?? null } : { type: 'other', scope: null };
}

// commits: do mais novo para o mais antigo (ordem do `git log`).
// Tudo a partir de `baselineSha` (inclusive) pertence à fase "tdd".
export function classify(commits, baselineSha) {
  const idx = commits.findIndex((c) => c.sha.startsWith(baselineSha));
  if (idx === -1) throw new Error(`commit de baseline ${baselineSha} não encontrado`);
  return commits.map((c, i) => ({
    ...c,
    ...parseSubject(c.subject),
    phase: i <= idx ? 'tdd' : 'pre',
  }));
}

function phaseStats(commits) {
  const fix = commits.filter((c) => c.type === 'fix').length;
  const feat = commits.filter((c) => c.type === 'feat').length;
  return {
    commits: commits.length,
    feat,
    fix,
    test: commits.filter((c) => c.type === 'test').length,
    fixRatio: fix + feat === 0 ? 0 : fix / (fix + feat),
  };
}

export function summarize(classified, issues, baselineDate) {
  const bugs = issues.filter((i) => i.labels.includes('bug'));
  const escaped = bugs.filter((i) => i.createdAt >= baselineDate);
  return {
    pre: phaseStats(classified.filter((c) => c.phase === 'pre')),
    tdd: phaseStats(classified.filter((c) => c.phase === 'tdd')),
    bugIssues: {
      total: bugs.length,
      open: bugs.filter((i) => i.state === 'open').length,
      // bugs reportados depois da baseline: defeitos que escaparam dos testes
      escaped: escaped.length,
    },
  };
}
