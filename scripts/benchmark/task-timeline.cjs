// node scripts/benchmark/task-timeline.cjs [howMany]   (dev app with --remote-debugging-port, CDP_PORT env)
// Prints where the time of the user's own recent tasks went: each step's own time, the gap
// before it (the model thinking) and time spent waiting for the user's yes. Needs steps recorded
// with startedAt / finishedAt (2026-11-08 on).
(async () => {
  const howMany = Number(process.argv[2]) || 1;
  const pages = (await (await fetch('http://127.0.0.1:' + (process.env.CDP_PORT || 9333) + '/json')).json()).filter((p) => p.type === 'page' && p.url.endsWith('desktop=1'));
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  const expr = `(async () => {
    const { desktopPetChatStore: st } = await import('/src/chatStore.ts');
    const runs = st.getState().messages.filter((m) => m.agentLoopRun).slice(-${howMany}).map((m) => m.agentLoopRun);
    const s = (ms) => (ms / 1000).toFixed(1) + 's';
    return runs.map((run) => {
      let previous = run.startedAt ?? null;
      const lines = run.steps.map((step) => {
        if (!step.startedAt) return '  ' + step.index + '. ' + step.text + ' [' + step.status + '] (no timing)';
        const gap = previous ? step.startedAt - previous : 0;
        const own = step.finishedAt ? step.finishedAt - step.startedAt - (step.approvalMs ?? 0) : null;
        previous = step.finishedAt ?? step.startedAt;
        return '  ' + step.index + '. ' + step.text + ' [' + step.status + ']  think ' + s(gap) + '  tool ' + (own === null ? '?' : s(own)) + (step.approvalMs ? '  approval ' + s(step.approvalMs) : '') + (step.trace ? '\\n       ' + step.trace : '');
      });
      const tail = run.durationMs && previous && run.startedAt ? '  then reply ' + s(run.startedAt + run.durationMs - previous) : '';
      return run.goal + '  (' + (run.durationMs ? s(run.durationMs) : 'running') + ', ' + run.status + ')\\n' + lines.join('\\n') + (tail ? '\\n' + tail : '');
    }).join('\\n\\n');
  })()`;
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) { console.log(d.result?.result?.value ?? JSON.stringify(d.result)); process.exit(0); } };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { awaitPromise: true, expression: expr, returnByValue: true } }));
})();
