import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 设置面板统一的 Section 卡片。
 * 设计系统:design-system/ai-desktop-pet/MASTER.md(Minimalism & Swiss)。
 * 替代此前 62+ 文件中手工复制的 `rounded-sm border border-border bg-secondary/20 p-4` 模板。
 */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  className = '',
}: SettingsSectionProps) {
  const hasHeader = Boolean(title || actions);
  return (
    <section className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      {hasHeader ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="text-xs font-semibold text-foreground">{title}</h3> : null}
            {description ? (
              <p className="mt-1 text-2xs leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
