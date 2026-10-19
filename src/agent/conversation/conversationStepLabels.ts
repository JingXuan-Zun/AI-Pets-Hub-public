import { listPlatformCapabilities } from '../../platform-capabilities/platformCapabilityRegistry';
import { capabilityToolName } from './conversationTools';

// One plain-language line per tool call for the task card in the chat: what the step does,
// never its raw arguments, element lists or results (those stay internal).

function text(args: Record<string, unknown>, key: string, max = 40) {
  const value = args[key];
  const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

function quoted(value: string) {
  return value ? `「${value}」` : '';
}

const FILE_ACTIONS: Record<string, string> = {
  copy: '复制文件', create_folder: '新建文件夹', list: '查看文件夹', move: '移动文件', open: '打开文件夹',
  places: '查看常用位置', read: '读取文件', rename: '重命名文件', search: '查找文件', trash: '把文件移到回收站',
};

export function describeConversationStep(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'list_windows': return '查看打开的窗口';
    case 'read_window': return `查看窗口${quoted(text(args, 'window'))}`;
    case 'look': return '看一眼画面';
    case 'launch_app': return `启动${quoted(text(args, 'name'))}`;
    case 'open_url': return '打开网页';
    case 'focus_window': return `切换到${quoted(text(args, 'window'))}`;
    case 'click': {
      const target = text(args, 'target');
      return /^[\d\s,]+$/u.test(target) ? '点击界面上的按钮' : `点击${quoted(target)}`;
    }
    case 'type_text': return '输入文字';
    case 'press_keys': return '按键盘';
    case 'scroll': return '滚动页面';
    case 'drag': return '拖动';
    case 'wait': return '等待界面加载';
    case 'files': return FILE_ACTIONS[text(args, 'action')] ?? '处理文件';
    case 'move_desktop_icon': return `把桌面图标${quoted(text(args, 'name'))}挪到${text(args, 'screen') || '副屏'}`;
    case 'memory': return text(args, 'action') === 'forget' ? '删除记忆' : '查看记忆';
    case 'update_todos': return '整理任务清单';
    case 'web_search': return `搜索${quoted(text(args, 'query'))}`;
    case 'browser': return text(args, 'action') === 'read_page' ? '读取网页内容' : '使用浏览器';
    case 'run_command': return '运行命令';
    case 'system_info': return '查看电脑配置';
    case 'desktop_icons': return '整理桌面图标';
    case 'skills': return text(args, 'action') === 'run' ? '使用技能' : '查看技能';
    case 'mcp': return text(args, 'action') === 'call' ? `使用扩展工具${quoted(text(args, 'tool_name'))}` : '查看扩展工具';
    case 'game_companion': return '陪玩';
    case 'local_project': return '查看本机项目';
    case 'play_animation': return '做动作';
    default: {
      const capability = listPlatformCapabilities().find((item) => capabilityToolName(item.id) === name);
      return capability?.title ?? '处理中';
    }
  }
}
