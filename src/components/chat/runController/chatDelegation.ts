// "Chat with one character, let another do the work": in a private chat, "让小玲去把文件夹挪到副屏"
// hands that message to 小玲 — her reply, task card, spoken questions and voice — while it all
// stays in the conversation the user is in. Only explicit hand-offs count ("让/叫/请/派/喊/麻烦/
// 拜托 + 名字", or a message that starts with the name); merely mentioning a name does not.

interface DelegationSlot {
  id: string;
  personality: { name: string; wakeWords?: string };
}

const HAND_OFF_VERBS = '(?:让|叫|请|派|喊|麻烦|拜托|交给)';
const activeScopes = new Map<string, string>();

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function namesOf(slot: DelegationSlot) {
  const wakeWords = (slot.personality.wakeWords ?? '').split(/[,，、\s]+/u);
  return [slot.personality.name, ...wakeWords].map((name) => name.trim()).filter((name) => name.length >= 2);
}

/** The character the user hands this message to, if it is not the one being chatted with. */
export function resolveDelegatedSlotId(text: string, slots: DelegationSlot[], chattingPetId: string) {
  const message = text.trim();
  if (!message) return null;
  for (const slot of slots) {
    if (slot.id === chattingPetId) continue;
    for (const name of namesOf(slot)) {
      const escaped = escapeRegExp(name);
      if (new RegExp(`${HAND_OFF_VERBS}\\s*${escaped}`, 'u').test(message) || new RegExp(`^${escaped}\\s*[，,:：、!！\\s]`, 'u').test(message)) {
        return slot.id;
      }
    }
  }
  return null;
}

/**
 * While a hand-off runs, messages the helper posts belong to the chatting character's
 * conversation (scopePetId) though she is the speaker (petId).
 */
export function beginDelegatedScope(speakerPetId: string, scopePetId: string) {
  activeScopes.set(speakerPetId, scopePetId);
  return () => {
    if (activeScopes.get(speakerPetId) === scopePetId) activeScopes.delete(speakerPetId);
  };
}

/** Fields to add to a message the given speaker posts now (empty unless she is helping). */
export function delegatedScopeFields(speakerPetId: string | null | undefined) {
  const scopePetId = speakerPetId ? activeScopes.get(speakerPetId) : undefined;
  return scopePetId ? { scopePetId } : {};
}
