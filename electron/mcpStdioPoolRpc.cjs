const { sendRpc } = require('./mcpStdioSession.cjs');
const { clearEntryIdleTimer } = require('./mcpStdioIdleEviction.cjs');

function createMcpPoolRpc({ entries, getEntry, restartPolicy, history, scheduleIdleEviction, discardEntry, recordRestartFailure }) {
  async function runRpc(server, method, params, timeoutMs) {
    const entry = getEntry(server);
    clearEntryIdleTimer(entry);
    const run = entry.inFlight
      .catch(() => undefined)
      .then(async () => {
        await entry.ready;
        const recovering = restartPolicy.getStatus(server.id).consecutiveFailures > 0;
        const result = await sendRpc(entry.session, method, params, timeoutMs);
        restartPolicy.recordSuccess(server.id);
        if (recovering) {
          history?.recordSessionEvent?.({
            ok: true,
            serverId: server.id,
            status: 'restart-recovered',
          });
        }
        return result;
      });
    entry.inFlight = run;

    try {
      const result = await run;
      entry.lastUsedAt = Date.now();
      scheduleIdleEviction(server.id, entry);
      return result;
    } catch (error) {
      if (entries.get(server.id) === entry) {
        const discarded = discardEntry(server.id, `rpc-failed:${method}`);
        recordRestartFailure(server.id, discarded.closeEvent, error);
      }
      throw error;
    }
  }

  return runRpc;
}

module.exports = { createMcpPoolRpc };
