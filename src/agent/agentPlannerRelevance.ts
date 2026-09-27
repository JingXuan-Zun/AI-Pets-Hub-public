import { type AgentToolCallName } from './agentChatCommand';

export const AGENT_LEGACY_PLANNER_RELEVANCE_KEYWORDS: Partial<Record<AgentToolCallName, string[]>> = {
  launch_local_app: ['应用', '软件', '程序', '打开', '启动', '运行', '唤出', '任务栏', '快捷方式', '浏览器'],
  browser_search: [
      '\u6d4f\u89c8\u5668',
      '\u641c\u7d22',
      '\u67e5\u8be2',
      '\u7f51\u7ad9',
      '\u7f51\u9875',
      '\u7f51\u5740',
      'browser',
      'search',
      'website',
      'url',
      'web',
    ],
  observe_windows_and_apps: ['installed apps', 'taskbar pinned', 'running windows', 'window path', 'window display', 'apps observation', '应用观察', '窗口观察', '任务栏固定'],
  execute_desktop_action: ['desktop action', 'window action', 'browser action', 'open app', 'close app', 'open and move', 'move window', 'move to display', 'focus window', 'open url', 'list windows', 'invoke ui', 'interact ui', 'ui automation'],
  execute_desktop_input: ['click', 'type text', 'hotkey', 'drag', 'mouse', 'keyboard', '桌面输入', '点击', '输入', '快捷键', '拖拽'],
  execute_desktop_sequence: ['desktop sequence', 'multi step desktop', 'compound desktop action', 'one approval', 'open then move', 'focus then type', 'batch desktop actions'],
  get_default_app_for_uri: ['默认应用', '默认浏览器', '系统默认', 'default app', 'default browser', 'uri', 'url', 'https', 'http'],
  list_running_apps: ['正在运行', '当前窗口', '已有窗口', '窗口列表', '进程', 'running apps', 'windows', 'processes'],
  get_active_window_info: ['当前窗口', '活动窗口', '前台窗口', '正在看的窗口', 'active window', 'foreground window'],
  execute_desktop_observation: ['desktop observation', 'desktop items', 'desktop icons', 'screen observation', 'window observation', 'window ui', 'ui automation', 'controls', 'buttons', 'visual snapshot', 'display info', 'system info', 'cursor position', 'capture source'],
  list_capture_sources: ['屏幕源', '窗口源', '捕获源', '截图源', '能看到什么', 'capture sources', 'screen sources', 'window sources'],
  summarize_visual_snapshot: ['看到', '画面', '屏幕上', '窗口里', '截图', '视觉', 'screenshot', 'screen content', 'visual', 'what is on screen'],
  locate_screen_elements: ['ocr', 'screen element', 'locate text', 'button location', 'visible text', '元素定位', '文字识别', '按钮在哪'],
  get_cursor_position: ['鼠标', '光标', '指针', '当前位置', 'cursor', 'mouse pointer', 'screen point'],
  analyze_game_screen: ['game screen', 'gameplay', 'hud', 'player state', 'what game', 'playing', '游戏画面', '游戏内容', '玩什么游戏', '陪玩', '吐槽'],
  manage_game_companion_loop: ['陪我玩', '游戏陪伴', '持续看', '边玩边聊', '吐槽游戏', 'game companion', 'keep watching', 'continuous gameplay', 'comment while playing'],
  focus_window: ['唤出', '切回', '聚焦', '置前', 'focus', 'bring forward', 'window'],
  close_window: ['关闭', '关掉', '退出', '关窗口', '结束窗口', 'close window', 'close app', 'quit app'],
  open_resource: ['打开', '访问', '网址', '链接', '文件', '文件夹', 'open', 'visit', 'url', 'file', 'folder'],
  search_web: ['搜索', '查询', '查一下', 'search', 'web search'],
  control_browser: ['browser control', 'open url', 'read page', 'focus tab', 'list tabs', '浏览器控制', '打开网址', '读取网页', '聚焦标签页'],
  run_controlled_command: ['run command', 'shell command', 'powershell', 'cmd', 'stdout', 'stderr', '受控命令', '执行命令'],
  remember_local_app: ['记住', '记录', '绑定', '应用位置', '路径', 'exe', 'lnk'],
  execute_memory_action: ['memory action', 'agent memory', 'remember preference', 'recall memory', 'forget memory', '记忆', '偏好', '记住', '忘记', '查记忆'],
  get_path_info: ['路径', '文件', '文件夹', '目录', '存在', '属性', 'path', 'file', 'folder', 'directory', 'exists'],
  list_directory: ['列目录', '看看文件夹', '目录里', '文件列表', 'list dir', 'directory entries', 'folder contents'],
  execute_local_file_action: ['local file action', 'filesystem action', 'path info', 'list folder', 'search files', 'read text file', 'file observation'],
  execute_file_management_action: ['file management action', 'move file', 'copy file', 'rename file', 'create folder', 'trash file', 'recycle file', '文件管理', '移动文件', '复制文件', '重命名', '新建文件夹', '回收站'],
  search_files: ['找文件', '搜索文件', '查找文件', '文件名', 'search files', 'find file', 'filename'],
  read_text_file: ['读文件', '打开文本', '查看内容', 'read file', 'text file', 'file contents'],
  organize_desktop_icons: ['桌面', '图标', '文件', '副屏', '主屏', '显示器', '整理', '排列', '摆放', '移动'],
  place_desktop_icon: ['图标', '上面', '下面', '左边', '右边', '放整齐', '移动'],
  get_system_info: ['电脑', '本机', '系统', '硬件', '配置', 'cpu', 'gpu', 'ram', '内存', '处理器', '显卡'],
  get_display_info: ['屏幕', '显示器', '分辨率', '缩放', '主屏', '副屏', '第二屏', '工作区'],
  get_pet_settings: ['桌宠设置', '宠物设置', '配置', '记忆深度', '自动移动', '跟随鼠标', '物理', '模型', '动作', '活动区域', '聊天外观', '设置参数', 'pet settings', 'config setting'],
  update_pet_settings: ['设置', '改为', '调整', '修改', '开启', '关闭', '启用', '禁用', '记忆深度', '自动移动', '跟随鼠标', '物理', '模型', '活动区域', '聊天外观', '参数', 'change setting', 'enable setting', 'disable setting'],
  get_voice_status: ['语音', '朗读', '播报', '说话', '麦克风', '听写', '识别', 'tts', 'stt', 'voice', '本地语音', '音色'],
  switch_tts_provider: ['切换语音', '更换语音', '浏览器语音', 'api语音', 'API语音', '本地语音', '本地模型', 'tts', '播报来源', '朗读来源'],
  warmup_local_voice: ['预热语音', '加载语音', '预加载', '本地语音', '本地模型', 'warmup', 'warm up', '加速语音'],
  set_voice_input: ['语音输入', '麦克风', '听我说', '听写', '语音识别', '打开麦克风', '关闭麦克风', '开启语音输入', '关闭语音输入'],
  start_voice_input_session: ['开始听', '听我说', '开始语音输入', '启动语音输入', '打开麦克风听', '开始录音', '语音对话', 'start listening'],
  stop_voice_input_session: ['停止听', '别听了', '停止语音输入', '关闭监听', '停止录音', '结束录音', 'stop listening'],
  inspect_local_project: ['文件夹', '目录', '项目', '工程', '源码', '入口', '怎么运行', '如何运行', '启动方式', '运行方式', '分析一下'],
  run_local_project_action: ['运行第', '启动第', '执行第', '跑第', '运行刚才', '启动刚才', '候选动作'],
};

export function getAgentLegacyPlannerRelevanceKeywords(toolName: AgentToolCallName) {
  return AGENT_LEGACY_PLANNER_RELEVANCE_KEYWORDS[toolName] ?? [];
}

export function matchesAgentLegacyPlannerToolRelevance(text: string) {
  const compactText = text.trim().toLowerCase();
  if (!compactText) {
    return false;
  }

  if (/\bagent\b/iu.test(compactText)) {
    return true;
  }

  return Object.values(AGENT_LEGACY_PLANNER_RELEVANCE_KEYWORDS).some((keywords) => (
    keywords?.some((keyword) => compactText.includes(keyword.toLowerCase()))
  ));
}
