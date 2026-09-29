import { Fragment } from 'react';
import { splitStoryNarrativeText } from './storyNarrativeTextSegments';

interface StoryNarrativeTextProps {
  dialogueColor: string;
  text: string;
}

export function StoryNarrativeText({ dialogueColor, text }: StoryNarrativeTextProps) {
  return splitStoryNarrativeText(text).map((segment, index) => (
    <Fragment key={`${segment.kind}-${index}`}>
      <span style={segment.kind === 'dialogue' ? { color: dialogueColor } : undefined}>
        {segment.text}
      </span>
    </Fragment>
  ));
}
