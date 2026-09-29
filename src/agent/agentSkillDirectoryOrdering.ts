export function orderAgentSkillDirectoryEntries<TImported, TBundled>(
  imported: readonly TImported[],
  bundled: readonly TBundled[],
): Array<TImported | TBundled> {
  return [...imported, ...bundled];
}
