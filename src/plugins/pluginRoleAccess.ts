// Which characters may use which plugin. Imported skills keep their own per-character list
// (desktop-pet.agent-skill-bindings.v1, read by the skill runtime); everything else is stored
// here as exceptions to the plugin's default, so plugins that existed before keep working for
// every character until the user turns one off.

const ROLE_ACCESS_KEY = 'desktop-pet.plugin-role-access.v1';
const SKILL_BINDINGS_KEY = 'desktop-pet.agent-skill-bindings.v1';
const SKILL_PREFIX = 'skill:';

type RoleAccess = Record<string, Record<string, boolean>>;

function storage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readJsonRecord(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readSkillBindings() {
  const raw = readJsonRecord(SKILL_BINDINGS_KEY);
  return Object.fromEntries(Object.entries(raw).map(([petId, ids]) => [
    petId,
    Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
  ]));
}

export function isPluginEnabledForPet(pluginId: string, petId: string | null | undefined, enabledByDefault = true) {
  if (!petId) return enabledByDefault;
  if (pluginId.startsWith(SKILL_PREFIX)) {
    return (readSkillBindings()[petId] ?? []).includes(pluginId.slice(SKILL_PREFIX.length));
  }
  const choice = (readJsonRecord(ROLE_ACCESS_KEY) as RoleAccess)[pluginId]?.[petId];
  return typeof choice === 'boolean' ? choice : enabledByDefault;
}

export function setPluginEnabledForPet(pluginId: string, petId: string, enabled: boolean) {
  const store = storage();
  if (!store) return;
  if (pluginId.startsWith(SKILL_PREFIX)) {
    const skillId = pluginId.slice(SKILL_PREFIX.length);
    const bindings = readSkillBindings();
    const current = (bindings[petId] ?? []).filter((id) => id !== skillId);
    store.setItem(SKILL_BINDINGS_KEY, JSON.stringify({ ...bindings, [petId]: enabled ? [...current, skillId] : current }));
    return;
  }
  const access = readJsonRecord(ROLE_ACCESS_KEY) as RoleAccess;
  store.setItem(ROLE_ACCESS_KEY, JSON.stringify({ ...access, [pluginId]: { ...(access[pluginId] ?? {}), [petId]: enabled } }));
}

/** Drops the stored choices of a plugin that was uninstalled. */
export function forgetPluginRoleAccess(pluginId: string) {
  const store = storage();
  if (!store) return;
  if (pluginId.startsWith(SKILL_PREFIX)) {
    const skillId = pluginId.slice(SKILL_PREFIX.length);
    const bindings = readSkillBindings();
    store.setItem(SKILL_BINDINGS_KEY, JSON.stringify(Object.fromEntries(
      Object.entries(bindings).map(([petId, ids]) => [petId, ids.filter((id) => id !== skillId)]),
    )));
    return;
  }
  const { [pluginId]: _removed, ...rest } = readJsonRecord(ROLE_ACCESS_KEY);
  store.setItem(ROLE_ACCESS_KEY, JSON.stringify(rest));
}
