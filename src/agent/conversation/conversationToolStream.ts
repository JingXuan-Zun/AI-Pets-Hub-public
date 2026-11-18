import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  publishAgentRuntimeWorldProgress,
  publishAgentRuntimeWorldResult,
  publishAgentRuntimeWorldTaskStarted,
  type AgentRuntimeWorldResultInput,
} from '../../runtime-world/agentRuntimeWorldBridge';
import {
  listConversationToolDefinitions,
  runConversationToolCalls,
  type ConversationToolResult,
  type ConversationToolRuntime,
} from './conversationTools';
import { createConversationToolSink, type ConversationToolTurn } from './conversationToolTypes';
import { describeGoalCheckOutcome, type GoalVerification } from './conversationGoalCheck';

export const CONVERSATION_LOOP_MAX_ROUNDS = 8;
/** Operating the computer takes a round per action (each one needs to see the last result). */
export const CONVERSATION_LOOP_DESKTOP_MAX_ROUNDS = 40;

export interface ConversationLoopEvent {
  calls: Array<{ arguments: string; name: string }>;
  results: ConversationToolResult[];
  round: number;
}

/** Tool results that tell her to stop and ask the user (see conversationDesktopTools). */
const STOP_AND_ASK = /【注意】|先停下/u;
/** Added after a round that changed something on the computer, while the result is unchecked. */
// "Says done, did nothing" (benchmark 2026-11-11): asked to close Notepad she answered "关掉啦" and
// asked to look something up she gave a version number, both without a single tool call. It
// happens now and then whatever the rules say, and with no tool call there is no check and no task
// card either. So when the user's message reads like a request to do or look up something and the
// reply used no tool, she is asked once more, out of the user's sight: act now, or say 不用.
// The words only decide whether to ask again; what to do stays her decision.
const ACTION_REQUEST = /(?:打开|关掉|关闭|关了|启动|运行|安装|卸载|搜索|搜一下|搜搜|查一下|查查|查询|上网|网上|浏览器|截图|截个图|新建|创建|删除|删掉|重命名|改名|整理|移到|挪到|放到|拖到|移动|保存|输入|写上|写进|写入|发给|发送|下载|提醒我|定个|设成|设为|设置成|改成|改回|调成|调到|切换|换成|播放|暂停|看看我|看一下我|读一下|算一下|帮我(?:把|开|关|查|找|搜|建|写|改|设|记|算|截|发|装|看|弄|整|移|挪|放|订|定))/u;
const SECOND_LOOK = '【系统提示，用户看不到这条】你刚才的回复没有调用任何工具。如果用户这条消息是要你在电脑上做事、查东西、改设置或记东西，那么到现在什么都还没有发生：现在就调用工具真正去做，做完用一两句话如实告诉用户（刚才说早了就直接承认）。如果用户只是在聊天、确实不需要任何工具，只回复两个字：不用。';

/** The message reads like a request to do or look up something (see ACTION_REQUEST). */
export function looksLikeActionRequest(request: string | undefined) {
  return ACTION_REQUEST.test(request ?? '');
}

const VERIFY_REMINDER = '（这一步改动了电脑上的东西。整件事做完后，先调用 verify_goal 核对结果，再告诉用户做完了没有。）';


/**
 * One model reply that may call tools: each round streams its text, then the tool calls run
 * and their results go back to the model, until it answers without calling a tool. Callers
 * consume it like an ordinary reply stream, so voice, expressions and memory capture work
 * unchanged.
 */
export async function* streamConversationWithTools(options: {
  maxRounds?: number;
  onToolRound?: (event: ConversationLoopEvent) => void;
  requestRound: (toolTurn: ConversationToolTurn) => Promise<AsyncIterable<unknown>>;
  runtime: ConversationToolRuntime;
}): AsyncGenerator<string> {
  const maxRounds = options.maxRounds ?? (options.runtime.desktop ? CONVERSATION_LOOP_DESKTOP_MAX_ROUNDS : CONVERSATION_LOOP_MAX_ROUNDS);
  const tools = listConversationToolDefinitions(options.runtime);
  const extraMessages: unknown[] = [];
  // Only the newest window reading stays in full; older ones shrink to one line so a long
  // task does not resend every element list.
  const compactable: Array<{ compact: string; message: { content: string } }> = [];
  let lastText = '';
  // The runtime world (the director that moves the pet while it works) hears about rounds that
  // use tools: started, each round, and how it ended. Plain chat sends nothing.
  let worldOutcome: AgentRuntimeWorldResultInput['status'] | null = null;
  let anyToolSucceeded = false;
  const taskState = { phase: 'running', taskId: `conversation-${Date.now().toString(36)}` };
  // True until the loop ends by itself. A new message from the user stops reading this reply
  // mid-task (the generator is closed from outside); the task card then said 已完成 for a
  // task cut off after three steps (benchmark 2026-11-05).
  let stoppedFromOutside = true;
  // The last tool round told her to stop and ask the user (sign-in wall, repeated failures,
  // step limit). If she then answers without tools, the task is not done: she is waiting for
  // the user's decision, and the card should say so instead of 已完成.
  let toldToStop = false;
  // Goal checks (2026-11-06): a tool succeeding is not the task succeeding. After anything that
  // changed the computer she is asked to verify_goal before saying it is done; the card reports
  // the last check, or that there was none.
  const canVerify = tools.some((tool) => tool.function.name === 'verify_goal');
  let uncheckedChange = false;
  let lastVerification: GoalVerification | null = null;
  // The hidden second look (see SECOND_LOOK): asked at most once, its text shown only if she then acts.
  let secondLook: 'no' | 'asking' | 'done' = 'no';
  try {
    for (let round = 1; round <= maxRounds; round += 1) {
      const sink = createConversationToolSink();
      let text = '';
      for await (const chunk of await options.requestRound({ extraMessages: [...extraMessages], sink, tools })) {
        if (typeof chunk !== 'string' || !chunk) continue;
        // The second look's words are held back until it is known whether she acts.
        if (secondLook === 'asking') { text += chunk; continue; }
        // Keep consecutive rounds readable: a round that starts right after earlier text gets a break.
        if (!text && lastText && !/\s$/u.test(lastText)) yield '\n\n';
        text += chunk;
        lastText = text;
        yield chunk;
      }
      if (secondLook === 'asking') {
        secondLook = 'done';
        const acts = sink.toolCalls.length > 0 && !options.runtime.signal?.aborted && !sink.interrupted;
        pushFrontendRuntimeLog('对话循环', acts ? '回复没用工具，再问一次后她动手了' : '回复没用工具，再问一次后确认不需要');
        if (acts && text.trim()) {
          if (lastText && !/\s$/u.test(lastText)) yield '\n\n';
          lastText = text;
          yield text;
        }
      }
      if (options.runtime.signal?.aborted) {
        if (worldOutcome) worldOutcome = 'cancelled';
        stoppedFromOutside = false;
        return;
      }
      // A new message from the user cut this round off: the task stops here, not finished.
      if (sink.interrupted) {
        if (worldOutcome) worldOutcome = 'cancelled';
        return;
      }
      if (!sink.toolCalls.length) {
        if (import.meta.env?.DEV && round === 1) {
          // Dev-only: a reply that used no tool at all, to tell "chose not to" from "was not offered any".
          const trace = ((globalThis as { __conversationLoopTrace?: string[] }).__conversationLoopTrace ??= []);
          trace.push(`${new Date().toLocaleTimeString()} 第1轮没有调用工具（提供了 ${tools.length} 个）：${text.replace(/\s+/gu, ' ').slice(0, 60)}`);
        }
        if (round === 1 && secondLook === 'no' && tools.length > 0 && text.trim() && looksLikeActionRequest(options.runtime.request)) {
          secondLook = 'asking';
          extraMessages.push({ content: text, role: 'assistant' }, { content: SECOND_LOOK, role: 'user' });
          continue;
        }
        const checkFailed = Boolean(lastVerification?.failed) && !uncheckedChange;
        if (worldOutcome) worldOutcome = anyToolSucceeded && !toldToStop && !checkFailed ? 'completed' : 'failed';
        stoppedFromOutside = false;
        return;
      }
      if (!worldOutcome) publishAgentRuntimeWorldTaskStarted();
      worldOutcome = 'failed';
      publishAgentRuntimeWorldProgress({ continuation: { taskState }, stepIndex: round, type: 'tools-running' });

      extraMessages.push({
        content: text || null,
        role: 'assistant',
        tool_calls: sink.toolCalls.map((call) => ({
          function: { arguments: call.arguments || '{}', name: call.name },
          id: call.id,
          ...(call.thoughtSignature ? { thought_signature: call.thoughtSignature } : {}),
          type: 'function',
        })),
      });
      const results = await runConversationToolCalls(options.runtime, sink.toolCalls);
      anyToolSucceeded ||= results.some((result) => result.ok);
      toldToStop = results.some((result) => STOP_AND_ASK.test(result.content));
      // In call order: a check covers the changes made before it, not the ones after it.
      results.forEach((result) => {
        if (result.verification) {
          lastVerification = result.verification;
          uncheckedChange = false;
        } else if (result.changedState && canVerify) {
          uncheckedChange = true;
        }
      });
      const lastChanging = [...results].reverse().find((result) => result.changedState);
      if (canVerify && uncheckedChange && lastChanging && !STOP_AND_ASK.test(lastChanging.content)) {
        lastChanging.content = `${lastChanging.content}\n${VERIFY_REMINDER}`;
      }
      publishAgentRuntimeWorldProgress({ continuation: { taskState }, stepIndex: round, type: 'tool-result' });
      if (results.some((result) => result.compact)) {
        compactable.splice(0).forEach((entry) => { entry.message.content = entry.compact; });
      }
      results.forEach((result) => {
        const message = { content: result.content, role: 'tool', tool_call_id: result.id };
        extraMessages.push(message);
        if (result.compact) compactable.push({ compact: result.compact, message });
      });
      pushFrontendRuntimeLog('对话循环', `第 ${round} 轮调用了 ${results.length} 个工具`, {
        calls: sink.toolCalls.map((call) => `${call.name}${call.arguments && call.arguments !== '{}' ? call.arguments.slice(0, 60) : ''}`).join(' | '),
        failed: results.filter((result) => !result.ok).map((result) => result.name).join(', '),
      });
      if (import.meta.env?.DEV) {
        // Dev-only trace for reviewing whole runs from DevTools; the runtime log rolls over too fast.
        const trace = ((globalThis as { __conversationLoopTrace?: string[] }).__conversationLoopTrace ??= []);
        trace.push(`${new Date().toLocaleTimeString()} 第${round}轮 ${results.map((result) => `${result.name}${result.ok ? '' : '✗'} ${sink.toolCalls.find((call) => call.id === result.id)?.arguments.slice(0, 80) ?? ''} → ${result.content.split('\n').slice(0, 2).join(' ').slice(0, 160)}`).join(' || ')}`);
        if (trace.length > 300) trace.splice(0, trace.length - 300);
      }
      options.onToolRound?.({
        calls: sink.toolCalls.map((call) => ({ arguments: call.arguments, name: call.name })),
        results,
        round,
      });
      // Switching the chat model mid-reply: the next round would go to the new provider with the
      // old one's tool calls, which it rejects (Gemini wants its own thought signatures).
      const ending = results.find((result) => result.endsReply)?.endsReply;
      if (ending) {
        if (lastText && !/\s$/u.test(lastText)) yield '\n\n';
        yield ending;
        worldOutcome = 'completed';
        stoppedFromOutside = false;
        return;
      }
    }
    worldOutcome = 'max-steps';
    stoppedFromOutside = false;
    yield '\n\n（这件事步骤太多，我先停在这里，你看看要不要换个说法再试。）';
  } catch (error) {
    // A failure is not an interruption.
    stoppedFromOutside = false;
    throw error;
  } finally {
    if (worldOutcome && stoppedFromOutside) worldOutcome = 'cancelled';
    if (worldOutcome) publishAgentRuntimeWorldResult({ status: worldOutcome, taskState: { ...taskState, phase: worldOutcome } });
    if (worldOutcome) {
      options.runtime.progress?.finish(
        worldOutcome === 'completed' ? 'done' : worldOutcome === 'cancelled' ? 'cancelled' : worldOutcome === 'max-steps' ? 'budget' : 'failed',
        stoppedFromOutside
          ? '被新的消息打断，还没做完'
          : toldToStop
            ? '卡住了，停下来问你怎么办'
            : worldOutcome === 'completed' || worldOutcome === 'failed' ? describeGoalCheckOutcome(lastVerification, uncheckedChange) : undefined,
      );
    }
  }
}
