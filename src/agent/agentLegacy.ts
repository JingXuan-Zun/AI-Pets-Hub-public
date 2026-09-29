/**
 * Legacy Agent v1 exports.
 *
 * The active desktop chat path uses AgentSessionV2. Keep the old Core/Planner
 * behind this explicit module so new code does not accidentally reattach the
 * fixed planner/run-loop chain through the main agent barrel.
 */
export * from './agentCore';
export * from './agentLegacyChatCommand';
export * from './agentPlanner';
