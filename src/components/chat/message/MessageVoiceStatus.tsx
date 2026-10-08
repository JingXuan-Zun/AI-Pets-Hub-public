

export function VoicePlaybackDots() {
  return (
    <span className="ml-0.5 inline-flex text-2xs leading-none" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={`voice-dot-${index}`}
          className="inline-block animate-pulse"
          style={{
            animationDelay: `${index * 120}ms`,
            animationDuration: '1s',
          }}
        >
          .
        </span>
      ))}
    </span>
  );
}

export function PetChatConversationVoiceUnavailableStatus() {
  return (
    <span className="inline-flex h-6 max-w-[150px] items-center rounded-full border border-border bg-muted px-2 text-2xs font-medium tracking-normal text-muted-foreground">
      <span className="truncate whitespace-nowrap">语音不可用</span>
    </span>
  );
}
