import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { downloadJsonTextFile } from './settingsDownloadUtils';

const STATUS_CLASS: Record<DesktopPetExternalSkillMarketplaceProductionReadinessReportLike['status'], string> = {
  incomplete: 'text-amber-500',
  invalid: 'text-red-400',
  'not-configured': 'text-muted-foreground',
  'ready-disabled': 'text-primary',
};

const CHECK_CLASS = {
  fail: 'text-red-400',
  pass: 'text-primary',
  warning: 'text-amber-500',
} as const;

export function SettingsAgentSkillMarketplaceProductionReadinessPanel() {
  const [report, setReport] = useState<DesktopPetExternalSkillMarketplaceProductionReadinessReportLike | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const getReadiness = window.desktopPetShell?.getExternalSkillMarketplaceProductionReadiness;
    if (!getReadiness) {
      setFeedback('Production readiness audit is unavailable.');
      return;
    }
    setLoading(true);
    try {
      const nextReport = await getReadiness();
      setReport(nextReport);
      setFeedback('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Production readiness audit failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exportReport = async () => {
    const exportReadiness = window.desktopPetShell?.exportExternalSkillMarketplaceProductionReadiness;
    if (!exportReadiness) {
      setFeedback('Production readiness export is unavailable.');
      return;
    }
    const result = await exportReadiness();
    if (!result.ok || !result.fileName || !result.text) {
      setFeedback(result.error || 'Production readiness export failed.');
      return;
    }
    downloadJsonTextFile(result.fileName, result.text);
    setFeedback('Exported marketplace production readiness evidence.');
  };

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ShieldAlert className="h-3 w-3 text-primary" />
          Marketplace production readiness
        </div>
        <div className="flex items-center gap-1">
          <span className={`mr-1 font-mono text-3xs ${report ? STATUS_CLASS[report.status] : 'text-muted-foreground'}`}>
            {report?.status ?? (loading ? 'loading' : 'unavailable')}
          </span>
          <Button type="button" variant="outline" size="icon-xs" title="Refresh production readiness" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button type="button" variant="outline" size="icon-xs" title="Export production readiness" disabled={!report} onClick={() => void exportReport()}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {report ? (
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-1 font-mono text-3xs text-muted-foreground">
            <span>roots {report.rootRegistry.activeKeyCount}/{report.rootRegistry.totalKeyCount}</span>
            <span className="truncate">delivery {report.delivery.transportOrigin ?? report.delivery.status}</span>
            <span className="truncate">{report.configSource} / catalog {report.activeCatalog.sequence ?? report.activeCatalog.status}</span>
          </div>
          {report.checks.map((check) => (
            <div key={check.id} className="flex items-start justify-between gap-2 border-t border-border/50 pt-1 text-3xs">
              <span className="font-mono text-muted-foreground">{check.id}</span>
              <span className={`min-w-0 text-right ${CHECK_CLASS[check.status]}`}>{check.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
      {feedback ? <div className="mt-1 truncate text-3xs text-muted-foreground">{feedback}</div> : null}
    </div>
  );
}
