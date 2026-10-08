import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentExecutionPlan, createPlanStep, getToolCallTargetDescription } from './agentPlanShared';

export function buildAppLaunchPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const appName = command.appLaunch?.appName?.trim();
  if (!appName) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal: command.appLaunch?.forceNew
      ? `新打开应用：${appName}`
      : `打开或唤出应用：${appName}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'search-local-app',
        'search-local-app',
        `查找本机应用、快捷方式、任务栏固定项和用户应用记忆：${appName}`,
        {
          requiresDesktopMode: true,
          targetDescription: appName,
        },
      ),
      createPlanStep(
        'launch-local-app',
        'launch-local-app',
        command.appLaunch?.forceNew
          ? `新启动应用：${appName}`
          : `优先唤出现有窗口，找不到再启动应用：${appName}`,
        {
          requiresDesktopMode: true,
          targetDescription: appName,
        },
      ),
    ],
  };
}

export function buildAppAliasSavePlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const alias = command.appAliasSave?.alias?.trim();
  const appPath = command.appAliasSave?.appPath?.trim();
  if (!alias || !appPath) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal: `记住应用别名：${alias}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'remember-local-app',
        'remember-local-app',
        `把「${alias}」绑定到本机应用路径`,
        {
          requiresDesktopMode: true,
          targetDescription: appPath,
        },
      ),
    ],
  };
}

function getLocalProjectRunPlanDetails(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const localPath = [
    input.path,
    input.projectPath,
    input.folderPath,
    input.filePath,
    input.query,
  ].find((value) => typeof value === 'string' && value.trim());
  const actionIndex = Number(input.actionIndex ?? input.index);
  const actionCommand = typeof input.command === 'string' ? input.command.trim() : '';
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const details = [
    typeof localPath === 'string' && localPath.trim()
      ? `路径：${localPath.trim()}`
      : '路径：使用上一轮项目分析结果',
    Number.isFinite(actionIndex) && actionIndex > 0
      ? `候选：第 ${Math.round(actionIndex)} 个`
      : '',
    actionCommand ? `命令匹配：${actionCommand}` : '',
    label ? `名称匹配：${label}` : '',
    '限制：只会运行项目分析器识别出的候选动作，不会执行任意临时命令。',
  ].filter(Boolean);

  return details;
}

function buildRunControlledCommandPlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || 'Run one controlled local command',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'run-controlled-command',
        'run-controlled-command',
        targetDescription
          ? `Run controlled command: ${targetDescription}`
          : 'Run controlled command',
        {
          details: [
            'The command runtime blocks destructive patterns, shell chaining, redirection, and pipes in v1.',
            'stdout, stderr, exitCode, cwd, and timeout status will be returned to the Agent loop.',
          ],
          requiresDesktopMode: true,
          targetDescription: targetDescription || 'controlled command',
        },
      ),
    ],
  };
}

export function buildLocalAppProjectToolPlan(
  command: AgentChatCommand,
  toolName: string,
  targetDescription: string,
  explicitGoal?: string,
): AgentExecutionPlan | null {
  switch (toolName) {

    case 'run_controlled_command':
      return buildRunControlledCommandPlan(command);


    case 'launch_local_app':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `打开或唤出应用：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'search-local-app',
            'search-local-app',
            `查找本机应用、快捷方式、任务栏固定项和用户应用记忆：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'launch-local-app',
            'launch-local-app',
            `优先唤出现有窗口，找不到再启动应用：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };


    case 'remember_local_app':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `记住应用位置：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'remember-local-app',
            'remember-local-app',
            `把 ${targetDescription} 绑定到用户提供的本机应用路径`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };


    case 'inspect_local_project':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `分析本机项目或程序目录：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'inspect-local-project',
            'inspect-local-project',
            `只读检查目录结构和关键配置文件：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };


    case 'run_local_project_action':
      // The executor always runs the project action, so the permission plan must describe
      // that run (and ask for approval) whatever words the user happened to use.
      const runDetails = getLocalProjectRunPlanDetails(command);
      return {
        commandKind: command.kind,
        goal: explicitGoal || `运行本机项目启动候选：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'inspect-local-project',
            'inspect-local-project',
            `确认本机项目候选启动动作：${targetDescription}`,
            {
              details: runDetails,
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'run-local-project-action',
            'run-local-project-action',
            `启动或打开受限候选动作：${targetDescription}`,
            {
              details: runDetails,
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };
    default: return null;
  }
}
