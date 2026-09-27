import { StoryActionChoices } from './StoryActionChoices';
import type { StorySessionState } from './storyTypes';

interface StoryTurnControlsProps {
  onChooseAction: (action: string) => void;
  session: StorySessionState;
}

export function StoryTurnControls(props: StoryTurnControlsProps) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-2">
      <StoryActionChoices
        actions={props.session.suggestedActions}
        onChooseAction={props.onChooseAction}
      />
    </div>
  );
}
