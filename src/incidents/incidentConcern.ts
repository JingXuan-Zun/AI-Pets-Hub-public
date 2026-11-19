import { effectiveCharge } from '../character-cognition/characterCognitionRules';
import { MAX_CONCERNS, type CharacterCognition, type CognitionConcern } from '../character-cognition/characterCognitionTypes';
import { INCIDENT_SOURCE_LABELS, type Incident } from './incidentTypes';

// When the app runs into a new problem and the user has not decided about reporting yet, the
// character they talk to gets it on her mind (user, 2026-11-18: "用户自己的角色就会先提醒一下").
// Her usual speak-first rules decide when she brings it up (quiet hours, not right after the
// user spoke, a few times an hour at most); if she does not get to it, it still colours her next
// reply. Once the user decides (here or in Settings → 体检) it is taken off her mind.

export const INCIDENT_CONCERN_PREFIX = 'incident-';
/** Above the speak-first threshold (50), so she brings it up soon; halves in eight hours. */
const INCIDENT_CONCERN_CHARGE = 85;

const isIncidentConcern = (concern: CognitionConcern) => concern.id.startsWith(INCIDENT_CONCERN_PREFIX);

/** Her state with the problem on her mind; unchanged if one already is (one question at a time). */
export function withIncidentConcern(cognition: CharacterCognition, incident: Pick<Incident, 'fingerprint' | 'source' | 'title'>, now: number): CharacterCognition {
  if (cognition.concerns.some(isIncidentConcern)) return cognition;
  const concern: CognitionConcern = {
    about: 'user',
    charge: INCIDENT_CONCERN_CHARGE,
    chargedAt: now,
    createdAt: now,
    id: `${INCIDENT_CONCERN_PREFIX}${incident.fingerprint}`,
    keywords: ['问题', '出错', '报错', '反馈', '开发者', '崩'],
    text: `软件刚才出了点问题（${INCIDENT_SOURCE_LABELS[incident.source]}：${incident.title.slice(0, 60)}），想问问要不要把问题报告发给开发者——只发报错和出错位置，不含聊天和密钥`,
  };
  let concerns = [...cognition.concerns, concern];
  if (concerns.length > MAX_CONCERNS) {
    // Make room by letting go of the weakest thing she was thinking about.
    const weakest = cognition.concerns.reduce((low, item) => (effectiveCharge(item, now) < effectiveCharge(low, now) ? item : low));
    concerns = concerns.filter((item) => item.id !== weakest.id);
  }
  return { ...cognition, concerns, lastChange: '软件出了问题，想问你要不要反馈', updatedAt: now };
}

/** The question is answered: take it off her mind. */
export function withoutIncidentConcerns(cognition: CharacterCognition, now: number): CharacterCognition {
  if (!cognition.concerns.some(isIncidentConcern)) return cognition;
  return { ...cognition, concerns: cognition.concerns.filter((concern) => !isIncidentConcern(concern)), updatedAt: now };
}
