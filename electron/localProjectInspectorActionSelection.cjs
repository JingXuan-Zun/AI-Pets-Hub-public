function normalizeActionIndex(value) {
  const index = Number(value);
  if (!Number.isFinite(index)) {
    return null;
  }

  const roundedIndex = Math.round(index);
  if (roundedIndex <= 0) {
    return 0;
  }

  return roundedIndex - 1;
}

function findTextActionSelection(actions, requestedText, field, reason) {
  const normalizedText = requestedText.toLowerCase();
  const index = actions.findIndex((action) => {
    const text = String(action[field] || '').trim().toLowerCase();
    return field === 'command' ? text === normalizedText : text.includes(normalizedText);
  });
  return index >= 0 ? { action: actions[index], index, reason } : null;
}

function findSuggestedActionSelection(inspection, request = {}) {
  const actions = Array.isArray(inspection?.suggestedActions) ? inspection.suggestedActions : [];
  if (!actions.length) {
    return null;
  }

  const actionIndex = normalizeActionIndex(request?.actionIndex ?? request?.index);
  if (actionIndex !== null) {
    const action = actions[actionIndex] ?? null;
    return action
      ? {
          action,
          index: actionIndex,
          reason: 'index',
        }
      : null;
  }

  const requestedCommand = String(request?.command || '').trim();
  if (requestedCommand) {
    return findTextActionSelection(actions, requestedCommand, 'command', 'command');
  }

  const requestedLabel = String(request?.label || '').trim();
  if (requestedLabel) {
    return findTextActionSelection(actions, requestedLabel, 'label', 'label');
  }

  return actions[0]
    ? {
        action: actions[0],
        index: 0,
        reason: 'default',
      }
    : null;
}

module.exports = { normalizeActionIndex, findSuggestedActionSelection };
