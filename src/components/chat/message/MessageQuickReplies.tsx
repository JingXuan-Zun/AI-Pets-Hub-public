import { ExternalLink, Settings } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import { openSettingsPage } from '../hub/settingsPageRequest';
import type { SettingsControlCenterPageId } from '../../settings/settingsControlCenterNavigation';

// Buttons under a guide message: send a phrase back, open a web page, or open a settings page.

export function MessageQuickReplies(props: {
  message: ChatMessage;
  onSendMessage?: (text?: string) => unknown;
}) {
  const replies = props.message.quickReplies;
  if (!replies?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {replies.map((reply) => {
        const className = 'inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/70 px-3 py-1 text-2xs font-medium text-primary transition-colors hover:bg-primary/10';
        if (reply.kind === 'link') {
          return (
            <a key={reply.label} className={className} href={reply.value} target="_blank" rel="noreferrer">
              {reply.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        }
        if (reply.kind === 'settings') {
          return (
            <button key={reply.label} type="button" className={className} onClick={() => openSettingsPage(reply.value as SettingsControlCenterPageId)}>
              <Settings className="h-3 w-3" />
              {reply.label}
            </button>
          );
        }
        return (
          <button key={reply.label} type="button" className={className} disabled={!props.onSendMessage} onClick={() => void props.onSendMessage?.(reply.value)}>
            {reply.label}
          </button>
        );
      })}
    </div>
  );
}
