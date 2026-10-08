import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

export function createAgentRunPresentationFixture(baselineSource?: string, baselineNames: string[] = [], overrides: Record<string, unknown> = {}) {
  const messages: any[] = [{ id: 'task', role: 'model', text: 'initial', petId: 'pet', chatMode: 'single' }];
  const effects: any[] = [];
  let ids = 0;
  const store = {
    getState: () => ({ messages }),
    addMessage: (message: any) => { messages.push(message); effects.push(['add', message]); },
    updateMessage: (id: string, updater: (message: any) => any) => {
      const index = messages.findIndex(message => message.id === id);
      if (index >= 0) messages[index] = updater(messages[index]);
      effects.push(['update', id, messages[index]]);
    },
    removeMessage: (id: string) => {
      const index = messages.findIndex(message => message.id === id);
      if (index >= 0) messages.splice(index, 1);
      effects.push(['remove', id]);
    },
  };
  const external: Record<string, any> = {
    agent: {
      resolveAgentResultFollowUpActions: (result: any) => result.followUpActions ?? [],
      createAgentDecisionSummary: (result: any) => result.assessment?.summary ?? 'fixture decision',
    },
    chatStore: { desktopPetChatStore: store },
    frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => effects.push(['log', ...args]) },
    multiPetChat: { createChatMessageId: (prefix: string) => `${prefix}-${++ids}` },
    agentRuntimeUiStatusProjection: { isAgentTaskRuntimeWaitingApproval: (result: any) => result.status === 'needs-approval' },
    agentProgressMessageProjection: { updateAgentProgressMessage: (options: unknown) => effects.push(['progress', options]) },
    groupTaskApprovalLifecycle: { runGroupTaskExplanationLifecycle: async (options: any) => {
      effects.push(['explain', options.roleId]); await options.execute();
    } },
  };
  Object.assign(external, overrides);
  const cache = new Map<string, { exports: any }>();
  const directory = path.resolve('src/components/chat/runController');
  function evaluate(file: string, source: string) {
    const module = { exports: {} as any };
    cache.set(file, module);
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(compiled, {
      module, exports: module.exports, Error, console,
      Date: class extends Date { static now() { return 1000; } },
      require: (specifier: string) => {
        const name = path.basename(specifier).replace(/\.ts$/u, '');
        if (Object.hasOwn(external, name)) return external[name];
        const target = path.resolve(path.dirname(file), specifier) + '.ts';
        if (target.startsWith(directory + path.sep)) return load(target);
        // The baseline also imports execution-only dependencies; none should be
        // called by presentation tests. A missing fixture fails when accessed.
        return {};
      },
    }, { filename: file });
    return module.exports;
  }
  function load(file: string): any {
    return cache.get(file)?.exports ?? evaluate(file, readFileSync(file, 'utf8'));
  }
  const baseline = baselineSource ? evaluate(path.resolve('src/components/chat/agentRunController.ts'),
    baselineSource + '\nexport { ' + baselineNames.join(', ') + ' };') : null;
  return { messages, effects, store, module: (name: string) => baseline ?? load(path.join(directory, name + '.ts')) };
}
