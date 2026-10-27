import type { PlatformCapability } from '../platform-capabilities/platformCapabilityTypes';
import { createSelfCheckDeps } from './selfCheckDeps';
import { formatSelfCheckReport, runSelfCheck } from './selfCheckRunner';

// The character can run the checkup herself ("你帮我看看哪里出问题了"). Checks only read;
// the fixes it applies are the safe, repeatable ones (e.g. starting the local voice service).

export const SELF_CHECK_CAPABILITIES: PlatformCapability[] = [{
  args: [],
  description: 'Run the app checkup (chat model, local voice service, phone-QQ connection), fix what is safe to fix, and report (“帮我检查一下哪里有问题”“你怎么不说话了”“体检一下”).',
  describe: () => '体检',
  group: '体检',
  id: 'system.health_check',
  risk: 'personal',
  run: async (context) => {
    const entries = await runSelfCheck(createSelfCheckDeps(context.configRef.current));
    const problems = entries.filter((entry) => entry.result.status !== 'ok').length;
    return {
      ok: true,
      text: `${formatSelfCheckReport(entries)}\n${problems ? `一共 ${problems} 项有问题，按上面的建议处理。` : '都正常。'}`,
    };
  },
  title: '体检',
}];
