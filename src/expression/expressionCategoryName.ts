export function expressionCategoryNameError(name: string): string | null {
  if (!name.trim()) return '分类名称不能为空。';
  if (name.length > 64) return '分类名称最多 64 个字符。';
  if (/[<>:"/\\|?*\u0000-\u001f\u007f]/u.test(name)) return '名称不能包含换行或 < > : " / \\ | ? *。';
  if (name !== name.trim() || /[.]$/u.test(name)) return '名称首尾不能有空格，也不能以句点结尾。';
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name)) return '不能使用 Windows 保留名称。';
  return null;
}
