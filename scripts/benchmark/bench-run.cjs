// node scripts/benchmark/bench-run.cjs "<message>" [maxSeconds] [approve|deny|ask]   (dev app with --remote-debugging-port, CDP_PORT env)
// Sends a message, answers approval cards (default approve), and prints timing + what happened.
(async () => {
  const [text, maxArg, policyArg] = process.argv.slice(2);
  const maxSeconds = Number(maxArg) || 120; const policy = policyArg || 'approve';
  const pages = (await (await fetch('http://127.0.0.1:' + (process.env.CDP_PORT || 9339) + '/json')).json()).filter((p) => p.type === 'page' && p.url.endsWith('desktop=1'));
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  const expr = `(async () => {
    const { desktopPetChatStore: st } = await import('/src/chatStore.ts');
    const reg = await import('/src/components/chat/runController/agentLoopApprovalRegistry.ts');
    const before = st.getState().messages.length;
    const t0 = Date.now(); let firstReplyMs = null; const approvals = [];
    window.desktopPetShell.sendSettingsAction({ type: 'send-chat-message', text: ${JSON.stringify(text)} });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 40 && !st.getState().isTyping && st.getState().messages.length <= before + 1; i += 1) await wait(250);
    let quietSince = 0;
    while (Date.now() - t0 < ${maxSeconds * 1000}) {
      const s = st.getState();
      const msgs = s.messages.slice(before);
      if (firstReplyMs === null && msgs.some((m) => m.role !== 'user' && ((m.text || '').trim() || m.agentLoopRun))) firstReplyMs = Date.now() - t0;
      const card = msgs.map((m) => m.agentLoopRun?.pendingApproval).find(Boolean);
      const regId = reg.latestPendingAgentLoopApprovalId();
      if (card || regId) {
        approvals.push({ title: card?.title, irreversible: card?.irreversible, at: Date.now() - t0 });
        if (${JSON.stringify(policy)} === 'ask') break;
        await wait(800);
        const id = reg.latestPendingAgentLoopApprovalId();
        if (id) reg.resolveAgentLoopApproval(id, ${JSON.stringify(policy)} === 'deny' ? 'deny' : 'approve');
        await wait(800); quietSince = 0; continue;
      }
      if (!s.isTyping) { quietSince ||= Date.now(); if (Date.now() - quietSince > 3000) break; } else quietSince = 0;
      await wait(400);
    }
    const s = st.getState();
    const msgs = s.messages.slice(before);
    return {
      totalMs: Date.now() - t0 - (quietSince ? Date.now() - quietSince : 0), firstReplyMs, timedOut: Date.now() - t0 >= ${maxSeconds * 1000}, approvals,
      messages: msgs.map((m) => ({
        role: m.role, text: (m.text || '').slice(0, 400), images: (m.attachments || []).length || undefined,
        steps: m.agentLoopRun ? m.agentLoopRun.steps.map((x) => x.text + ' [' + x.status + ']') : undefined,
      })),
    };
  })()`;
  const timer = setTimeout(() => { console.log('runner timed out'); process.exit(0); }, (maxSeconds + 30) * 1000);
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 2) { clearTimeout(timer); console.log(JSON.stringify(d.result?.result?.value ?? d.result, null, 1).slice(0, 8000)); process.exit(0); } };
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { awaitPromise: true, expression: expr, returnByValue: true } }));
})();
