// The persona sharing service, shared by the settings panel and the character's persona tools.
// The project's public sharing service (Cloudflare Worker); VITE_PERSONA_COMMUNITY_API_URL overrides it.
const DEFAULT_PERSONA_COMMUNITY_API_URL = 'https://ai-desktop-pet-persona-api.qianxuanlian.workers.dev';
export const PERSONA_COMMUNITY_API_URL: string = import.meta.env?.VITE_PERSONA_COMMUNITY_API_URL?.trim() || DEFAULT_PERSONA_COMMUNITY_API_URL;
