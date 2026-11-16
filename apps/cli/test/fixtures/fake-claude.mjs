#!/usr/bin/env node
// Stand-in for the `claude` CLI, used by the smoke test (CLAUDE_CODE_BIN). `--version` prints a
// version; anything else drains stdin and answers with canned stream-json (see llm/claudeCode.ts).
const VIEW = {
  title: 'Fake Claude view',
  description: 'Canned answer of test/fixtures/fake-claude.mjs',
  queries: { rows: { query: 'query Fake {\n  characters {\n    name\n  }\n}', variables: {} } },
  widgets: [
    {
      id: 'list',
      type: 'table',
      title: 'Characters',
      span: 24,
      data: { query: 'rows', path: 'characters' },
      columns: [{ key: 'name', title: 'Name' }],
      pageSize: 10,
    },
  ],
};

if (process.argv.includes('--version')) {
  console.log('0.0.0-fake (Claude Code)');
  process.exit(0);
}

const answer = `<reasoning>\n- canned answer\n</reasoning>\n<view>\n${JSON.stringify(VIEW)}\n</view>`;
process.stdin.resume();
process.stdin.on('end', () => {
  const delta = { type: 'stream_event', event: { delta: { type: 'text_delta', text: 'canned' } } };
  console.log(JSON.stringify(delta));
  console.log(JSON.stringify({ type: 'result', is_error: false, result: answer }));
});
