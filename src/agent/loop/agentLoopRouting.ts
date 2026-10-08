// Which agent-mode requests go to the new desktop loop. v1 covers operating apps and windows;
// tasks served by the older agent's dedicated tools (files, web lookup, memory, skills, MCP,
// settings) stay on the old path until the loop has those tools.

const DESKTOP_OPERATION = /(?:打开|启动|运行|点击|点一下|点开|双击|右键|登录|登陆|切换到|切到|进入|关闭窗口|最小化|最大化|在.{1,20}(?:里|中|上)(?:点|找|打开|启动|搜索|输入)|输入|搜索框|open|launch|start|click|log\s*in|sign\s*in|switch\s+to)/iu;
const OLD_AGENT_DOMAIN = /(?:文件夹|文件|目录|路径|\.(?:txt|md|docx?|xlsx?|pdf|json)\b|记住|记忆|技能|MCP|网上|联网|上网查|搜一下资料|查一下|天气|新闻|设置里|桌宠设置|整理桌面|桌面图标)/iu;

export function shouldRouteToAgentLoop(options: { enabled: boolean; instruction: string }) {
  const text = options.instruction.trim();
  return options.enabled && Boolean(text) && DESKTOP_OPERATION.test(text) && !OLD_AGENT_DOMAIN.test(text);
}
