import { type PetConfig } from '../../../types';

export type ActivityDisplayOption = {
  value: PetConfig['settings']['activityDisplayId'] | PetConfig['settings']['interactiveDialogueDisplayId'];
  tag: string;
  title: string;
  width: number;
  height: number;
};
