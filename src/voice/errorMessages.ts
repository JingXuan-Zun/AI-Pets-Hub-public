const EXACT_MESSAGE_MAP = new Map<string, string>([
  ['Failed to fetch', '请求语音接口失败，请检查接口地址、网络连接或跨域设置。'],
  ['Local voice returned an invalid payload.', '本地语音返回了无法识别的数据。'],
  ['Local voice did not return playable audio data.', '本地语音没有返回可播放的音频数据。'],
  ['Local speech recognition returned an invalid payload.', '本地语音识别返回了无法识别的数据。'],
  ['local_voice_cancelled', '当前语音播报已取消。'],
  ['local_voice_runner_unavailable', '本地语音执行器不可用，请检查 Python 环境和本地依赖。'],
  ['python_runtime_unavailable', '未找到可用的 Python 运行环境。'],
  ['Input audio file was not found.', '未找到要识别的音频文件。'],
  ['Selected local STT model path was not found.', '选中的本地识别模型路径不存在。'],
  ['Local speech recognition returned an empty transcript.', '本地识别没有返回有效文本。'],
  ['Selected local TTS model path was not found.', '选中的本地播报模型路径不存在。'],
  ['Reference audio file was not found.', '未找到参考音频文件。'],
  ['No text was provided for local voice synthesis.', '没有提供要播报的文本。'],
  ['Local TTS did not generate any audio.', '本地播报没有生成有效音频。'],
  ['Unsupported local voice mode.', '本地语音模式无效。'],
]);

const PARTIAL_MESSAGE_RULES: Array<[RegExp, string]> = [
  [/Missing qwen_asr package/i, '当前本地语音环境缺少 qwen_asr，请先点击“安装本地依赖”。'],
  [/Missing qwen_tts package/i, '当前本地语音环境缺少 qwen_tts，请先点击“安装本地依赖”。'],
  [/Missing reference transcript/i, '缺少参考文本，请填写参考文本、补充参考目录里的 .txt 文件，或选择本地识别模型自动转写。'],
  [/Local voice runtime is present, but required Python packages are missing/i, '本地语音环境已找到，但缺少必需依赖。'],
  [/Local voice runtime and required packages were detected/i, '已检测到本地语音环境和依赖。'],
  [/PyTorch detection failed/i, 'PyTorch 检测失败，请检查本地依赖是否安装完整。'],
  [/c10_cuda\.dll|torch\\lib\\c10_cuda\.dll|Error loading .*c10_cuda\.dll/i, '本地语音的 PyTorch CUDA 运行库加载失败，请在语音设置里重新安装本地依赖；如果电脑显卡或驱动不支持 CUDA 12.4，请改装 CPU 版 PyTorch。'],
  [/moss_tts_delay[\\/]+llama_cpp[\\/]+backbone_bridge\.dll|MOSS GGUF/i, 'MOSS GGUF 本地播报缺少 backbone_bridge.dll，请运行 npm run moss:bridge 自动补齐 MOSS 桥接库。'],
  [/worker unavailable/i, '本地语音常驻进程已中断，请重试一次；若仍失败，请检查 Python 环境和本地依赖。'],
  [/Permission denied/i, '麦克风权限被拒绝，请允许应用访问麦克风。'],
];

function extractRawErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return '';
}

export function normalizeVoiceErrorMessage(message: string, fallback = '语音功能执行失败。') {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return fallback;
  }

  const exactMatch = EXACT_MESSAGE_MAP.get(normalizedMessage);
  if (exactMatch) {
    return exactMatch;
  }

  const missingModuleMatch = normalizedMessage.match(/No module named ['"]([^'"]+)['"]/i);
  if (missingModuleMatch?.[1]) {
    return `当前本地语音环境缺少 ${missingModuleMatch[1]}，请先点击“安装本地依赖”。`;
  }

  for (const [pattern, replacement] of PARTIAL_MESSAGE_RULES) {
    if (pattern.test(normalizedMessage)) {
      return replacement;
    }
  }

  return normalizedMessage;
}

export function getVoiceErrorMessage(error: unknown, fallback = '语音功能执行失败。') {
  return normalizeVoiceErrorMessage(extractRawErrorMessage(error), fallback);
}

export function isVoiceCancellationError(error: unknown) {
  const rawMessage = extractRawErrorMessage(error);
  return rawMessage === 'local_voice_cancelled'
    || rawMessage.includes('local_voice_cancelled')
    || rawMessage === 'AbortError'
    || rawMessage === 'The operation was aborted'
    || rawMessage === 'This operation was aborted';
}

export function getSpeechRecognitionErrorMessage(code: string) {
  switch (code) {
    case 'no-speech':
      return '没有听到清晰语音，请再试一次。';
    case 'audio-capture':
      return '无法访问麦克风，请检查设备是否可用。';
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝，请允许应用访问麦克风。';
    case 'network':
      return '语音识别网络异常，请稍后重试。';
    case 'aborted':
      return '语音识别已取消。';
    case 'bad-grammar':
      return '语音识别语法配置无效。';
    case 'language-not-supported':
      return '当前识别语言暂不受支持。';
    default:
      return `语音识别失败：${code || 'unknown_error'}`;
  }
}
