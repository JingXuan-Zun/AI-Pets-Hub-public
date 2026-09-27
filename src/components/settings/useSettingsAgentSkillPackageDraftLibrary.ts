import { useState } from 'react';
import {
  createEmptyAgentSkillPackageDraftLibrary,
  parseAgentSkillPackageDraftLibraryJson,
  removeAgentSkillPackageDraft,
  saveAgentSkillPackageImportPreviewToLibrary,
  serializeAgentSkillPackageDraftLibrary,
  setAgentSkillPackageDraftEnabled,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageDraftSaveResult,
  type AgentSkillPackageImportPreview,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-package-drafts.v1';

function loadDraftLibrary() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillPackageDraftLibrary();
    }

    return parseAgentSkillPackageDraftLibraryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillPackageDraftLibrary();
  }
}

function persistDraftLibrary(library: AgentSkillPackageDraftLibrary) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Skill package drafts can only be saved in the browser or desktop shell.';
    }

    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillPackageDraftLibrary(library));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Skill package draft storage failed.';
  }
}

export function useSettingsAgentSkillPackageDraftLibrary() {
  const [library, setLibrary] = useState(loadDraftLibrary);

  const saveImportPreview = (preview: AgentSkillPackageImportPreview | null): AgentSkillPackageDraftSaveResult => {
    const result = saveAgentSkillPackageImportPreviewToLibrary(library, preview);
    if (result.error) {
      return result;
    }

    const error = persistDraftLibrary(result.library);
    if (error) {
      return { ...result, error };
    }

    setLibrary(result.library);
    return result;
  };

  const removeDraft = (draftId: string) => {
    const nextLibrary = removeAgentSkillPackageDraft(library, draftId);
    const error = persistDraftLibrary(nextLibrary);
    if (!error) {
      setLibrary(nextLibrary);
    }
    return error;
  };

  const setDraftEnabled = (draftId: string, enabled: boolean) => {
    const result = setAgentSkillPackageDraftEnabled(library, draftId, enabled);
    if (result.error) {
      return result.error;
    }

    const error = persistDraftLibrary(result.library);
    if (!error) {
      setLibrary(result.library);
    }
    return error;
  };

  const clearDrafts = () => {
    const nextLibrary = createEmptyAgentSkillPackageDraftLibrary();
    const error = persistDraftLibrary(nextLibrary);
    if (!error) {
      setLibrary(nextLibrary);
    }
    return error;
  };

  const replaceLibrary = (nextLibrary: AgentSkillPackageDraftLibrary) => {
    const error = persistDraftLibrary(nextLibrary);
    if (!error) {
      setLibrary(nextLibrary);
    }
    return error;
  };

  return { clearDrafts, library, removeDraft, replaceLibrary, saveImportPreview, setDraftEnabled };
}
