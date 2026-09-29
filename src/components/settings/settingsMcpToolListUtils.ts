export function mergeMcpToolsForServer(
  currentTools: DesktopPetMcpToolLike[],
  serverId: string,
  nextTools: DesktopPetMcpToolLike[],
) {
  return [
    ...currentTools.filter((tool) => tool.serverId !== serverId),
    ...nextTools,
  ];
}
