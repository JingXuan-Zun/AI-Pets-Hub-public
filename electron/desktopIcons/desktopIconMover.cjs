function findDesktopIconForMove(icons, request) {
  const iconId = typeof request?.iconId === 'string' ? request.iconId.trim() : '';
  const iconName = typeof request?.iconName === 'string' ? request.iconName.trim() : '';

  return icons.find((icon) => icon.id === iconId)
    || icons.find((icon) => icon.name === iconName)
    || null;
}

function prepareDesktopIconMoveTarget(icons, request, coordinateSpace, targetX, targetY, petToScreenCoordinate) {
  const icon = findDesktopIconForMove(icons, request);
  if (!icon) {
    return {
      error: 'Desktop icon not found.',
      ok: false,
    };
  }

  const targetNativeScreenPoint = coordinateSpace === 'native-screen'
    ? {
        x: Math.round(targetX),
        y: Math.round(targetY),
      }
    : petToScreenCoordinate({
        x: Math.round(targetX),
        y: Math.round(targetY),
      });
  if (icon.canMove === false) {
    return {
      error: 'Desktop icon position source is read-only.',
      icon,
      ok: false,
    };
  }

  return { icon, targetNativeScreenPoint };
}

function selectDesktopIconMoveScript(icon, targetNativeScreenPoint, getDesktopIconFolderViewMovePowerShellScript, getDesktopIconMovePowerShellScript) {
  return icon.positionSource === 'folder-view'
    ? getDesktopIconFolderViewMovePowerShellScript({
        index: icon.index,
        nativeScreenX: targetNativeScreenPoint.x,
        nativeScreenY: targetNativeScreenPoint.y,
      })
    : getDesktopIconMovePowerShellScript({
        index: icon.index,
        nativeScreenX: targetNativeScreenPoint.x,
        nativeScreenY: targetNativeScreenPoint.y,
      });
}

function createDesktopIconMoveFailureReporter({ invalidate, compactDesktopIconPowerShellError, logMessage }) {
  function reportDesktopIconMoveFailure(error, icon, targetNativeScreenPoint) {
    invalidate();
    const errorText = compactDesktopIconPowerShellError(error?.message || String(error));
    logMessage('desktop icon move PowerShell failed', {
      error: errorText,
      iconName: icon.name,
      positionSource: icon.positionSource,
      stderr: error?.stderr,
      stdout: error?.stdout,
      targetX: targetNativeScreenPoint.x,
      targetY: targetNativeScreenPoint.y,
    });
    return {
      error: errorText || 'PowerShell desktop icon move command failed.',
      icon,
      ok: false,
    };
  }
  return reportDesktopIconMoveFailure;
}

function createDesktopIconMoveVerificationReporter({ logMessage }) {
  function reportDesktopIconMoveVerification(nextIcons, icon, targetX, targetY) {
    const movedIcon = findDesktopIconForMove(nextIcons, {
      iconId: icon.id,
      iconName: icon.name,
    });
    const tolerance = 8;
    const verified = Boolean(
      movedIcon
      && Math.abs(movedIcon.x - Math.round(targetX)) <= tolerance
      && Math.abs(movedIcon.y - Math.round(targetY)) <= tolerance
    );

    logMessage('desktop icon moved', {
      iconName: icon.name,
      targetX: Math.round(targetX),
      targetY: Math.round(targetY),
      verified,
    });

    return {
      icon: movedIcon ?? icon,
      ok: true,
      verified,
    };
  }
  return reportDesktopIconMoveVerification;
}

function createDesktopIconMoveExecutor({ listDesktopIcons, normalizeDesktopIconCoordinateSpaceOption, petToScreenCoordinate, getDesktopIconFolderViewMovePowerShellScript, getDesktopIconMovePowerShellScript, runPowerShellScript, invalidate, reportDesktopIconMoveFailure, reportDesktopIconMoveVerification }) {
  async function moveDesktopIcon(request = {}) {
    if (process.platform !== 'win32') {
      return {
        error: 'Desktop icon movement is only supported on Windows.',
        ok: false,
      };
    }

    const targetX = Number(request?.x);
    const targetY = Number(request?.y);
    if (![targetX, targetY].every(Number.isFinite)) {
      return {
        error: 'Invalid target position.',
        ok: false,
      };
    }

    const coordinateSpace = normalizeDesktopIconCoordinateSpaceOption(request?.coordinateSpace);
    const icons = await listDesktopIcons({ coordinateSpace, forceRefresh: true });
    const prepared = prepareDesktopIconMoveTarget(icons, request, coordinateSpace, targetX, targetY, petToScreenCoordinate);
    if (prepared.error) return prepared;
    const { icon, targetNativeScreenPoint } = prepared;
    const moveScript = selectDesktopIconMoveScript(icon, targetNativeScreenPoint, getDesktopIconFolderViewMovePowerShellScript, getDesktopIconMovePowerShellScript);
    let stdout = '';
    try {
      stdout = await runPowerShellScript(moveScript);
    } catch (error) {
      return reportDesktopIconMoveFailure(error, icon, targetNativeScreenPoint);
    }
    const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
    if (!parsed?.ok) {
      invalidate();
      return {
        error: 'Windows desktop did not accept the icon movement request.',
        icon,
        ok: false,
      };
    }

    invalidate();
    const nextIcons = await listDesktopIcons({ coordinateSpace, forceRefresh: true });
    return reportDesktopIconMoveVerification(nextIcons, icon, targetX, targetY);
  }
  return moveDesktopIcon;
}

function createDesktopIconMover(dependencies) {
  const reportDesktopIconMoveFailure = createDesktopIconMoveFailureReporter(dependencies);
  const reportDesktopIconMoveVerification = createDesktopIconMoveVerificationReporter(dependencies);
  return createDesktopIconMoveExecutor({ ...dependencies, reportDesktopIconMoveFailure, reportDesktopIconMoveVerification });
}

module.exports = { createDesktopIconMover };
