import { stripGroupRelationshipSignalMarkers } from '../relationship/groupRelationshipSignalProtocol';
import { stripGroupTopicSignalMarkers } from './groupTopicSignalProtocol';
import { stripGroupContributionSignalMarkers } from './groupContributionSignalProtocol';

const TRAILING_PARTIAL_MARKER_REGEX = /\[\[[^\]\r\n]*$/u;

export function stripGroupRoleSignalMarkers(text: string) {
  return stripGroupContributionSignalMarkers(stripGroupTopicSignalMarkers(stripGroupRelationshipSignalMarkers(text)))
    .replace(TRAILING_PARTIAL_MARKER_REGEX, '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}
