/** Conservative recognition of immediate movement requests, not quoted or hypothetical dialogue. */
export function hasExplicitStoryMovementRequest(userInput: string) {
  const text = userInput.trim();
  if (!text || /[“”「」『』]|如果|假如|假设|要是|以后|明天|之后再|能否|能不能|可不可以|是否/u.test(text)) return false;
  return text.split(/[，。！？\n]/u).some((clause) => !/不要|别|不想|不去|不回/u.test(clause) && /(?:带我|陪我|送我|跟我|和我|我们|咱们|我要|我想|我先|我现在|请你|直接|马上|现在|先)(?:一起|先|直接|马上|现在)?(?:回到|回|去|前往|返回|离开|走向)[^，。！？\n]{1,40}/u.test(clause));
}
