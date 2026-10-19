// The persona sharing service, shared by the settings panel and the character's persona tools.
const DEFAULT_PERSONA_COMMUNITY_API_URL = '';
export const PERSONA_COMMUNITY_API_URL: string = import.meta.env?.VITE_PERSONA_COMMUNITY_API_URL?.trim() || DEFAULT_PERSONA_COMMUNITY_API_URL;
