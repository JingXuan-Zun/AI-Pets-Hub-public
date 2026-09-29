export interface PublicPersonaEntry {
  id: string;
  title: string;
  description?: string;
  author?: string;
  format: 'txt' | 'md' | 'json';
  filename: string;
  sizeBytes: number;
  createdAt: string;
  sha256: string;
}

export interface PersonaCommunityConfig {
  apiUrl: string;
}
