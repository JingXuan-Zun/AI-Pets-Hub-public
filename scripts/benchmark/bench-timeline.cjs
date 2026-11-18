// node scripts/benchmark/bench-timeline.cjs "<message>" [maxSeconds]   (dev app with --remote-debugging-port, CDP_PORT env)
// Like bench-run.cjs, but samples the chat every 100 ms and prints a timeline: when each tool
// step appeared / finished, approvals (answered at once), first text, typing and speaking.
// The gaps show where a task's time goes: model thinking, tools, approvals or reading aloud.
(async () => {
  const [text, maxArg] = process.argv.slice(2);
  const maxSeconds = Number(maxArg) || 120;
  const pages = (await (await fetch('http://127.0.0.1:' + (process.env.CDP_PORT || 9333) + '/json')).json()).filter((p) => p.type === 'page' && p.url.endsWith('desktop=1'));
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  const expr = `(async () => {
    const { desktopPetChatStore: st } = await import('/src/chatStore.ts');
    const reg = await import('/src/components/chat/runController/agentLoopApprovalRegistry.ts');
    const before = st.getState().messages.length;
    const t0 = Date.now(); const events = []; const at = () => ((Date.now() - t0) / 1000).toFixed(1);
    const seenSteps = new Map(); let typing = null, speaking = null, firstText = false, quietSince = 0;
    window.desktopPetShell.sendSettingsAction({ type: 'send-chat-message', text: ${JSON.stringify(text)} });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    while (Date.now() - t0 < ${maxSeconds * 1000}) {
      const s = st.getState(); const msgs = s.messages.slice(before);
      if (s.isTyping !== typing) { typing = s.isTyping; events.push(at() + ' typing=' + typing); }
      if (s.isSpeaking !== speaking) { speaking = s.isSpeaking; events.push(at() + ' speaking=' + speaking); }
      for (const m of msgs) {
        if (!firstText && m.role !== 'user' && (m.text || '').trim()) { firstText = true; events.push(at() + ' first text'); }
        for (const step of m.agentLoopRun?.steps ?? []) {
          const key = step.index + ':' + step.status;
          if (!seenSteps.has(step.index)) events.push(at() + ' step ' + step.index + ' ' + step.status + ' ' + step.text.slice(0, 60));
          else if (seenSteps.get(step.index) !== key) events.push(at() + ' step ' + step.index + ' -> ' + step.status);
          seenSteps.set(step.index, key);
        }
      }
      const id = reg.latestPendingAgentLoopApprovalId();
      if (id) { events.push(at() + ' approval asked'); reg.resolveAgentLoopApproval(id, 'approve'); events.push(at() + ' approved'); }
      const busy = s.isTyping || s.isSpeaking;
      if (!busy && firstText) { quietSince ||= Date.now(); if (Date.now() - quietSince > 2500) break; } else quietSince = 0;
      await wait(100);
    }
    const msgs = st.getState().messages.slice(before);
    return { events, reply: msgs.filter((m) => m.role !== 'user').map((m) => (m.text || '').slice(0, 300)) };
  })()`;
  const timer = setTimeout(() => { console.log('runner timed out'); process.exit(0); }, (maxSeconds + 30) * 1000);
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 2) { clearTimeout(timer); const v = d.result?.result?.value; console.log(v ? v.events.join('\n') + '\n--- reply:\n' + v.reply.join('\n') : JSON.stringify(d.result).slice(0, 2000)); process.exit(0); } };
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { awaitPromise: true, expression: expr, returnByValue: true } }));
})();
