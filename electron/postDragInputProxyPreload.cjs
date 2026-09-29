const { ipcRenderer } = require('electron');

const BUTTON_BY_INDEX = ['left', 'middle', 'right'];

function resolveButton(index) {
  return BUTTON_BY_INDEX[index] || 'left';
}

function sendPointerEvent(type, event) {
  ipcRenderer.send('desktop-pet:post-drag-input-proxy-event', {
    button: resolveButton(event.button),
    buttons: Number(event.buttons || 0),
    clickCount: Math.max(1, Number(event.detail || 1)),
    movementX: Number(event.movementX || 0),
    movementY: Number(event.movementY || 0),
    type,
    x: Number(event.clientX || 0),
    y: Number(event.clientY || 0),
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const setProxyCursor = (cursor) => {
    document.documentElement.style.cursor = cursor;
    document.body.style.cursor = cursor;
  };

  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  document.body.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.width = '100vw';
  setProxyCursor('grab');

  window.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setProxyCursor('grabbing');
    try {
      event.target?.setPointerCapture?.(event.pointerId);
    } catch {
    }
    sendPointerEvent('mouseDown', event);
  }, true);

  window.addEventListener('pointermove', (event) => {
    if (event.buttons !== 0) {
      event.preventDefault();
    }
    sendPointerEvent('mouseMove', event);
  }, true);

  const finishPointer = (type, event) => {
    event.preventDefault();
    setProxyCursor('grab');
    sendPointerEvent(type, event);
    try {
      event.target?.releasePointerCapture?.(event.pointerId);
    } catch {
    }
  };

  window.addEventListener('pointerup', (event) => finishPointer('mouseUp', event), true);
  window.addEventListener('pointercancel', (event) => finishPointer('mouseUp', event), true);
  window.addEventListener('contextmenu', (event) => event.preventDefault(), true);

  window.addEventListener('wheel', (event) => {
    event.preventDefault();
    ipcRenderer.send('desktop-pet:post-drag-input-proxy-event', {
      deltaX: Number(event.deltaX || 0),
      deltaY: Number(event.deltaY || 0),
      type: 'mouseWheel',
      x: Number(event.clientX || 0),
      y: Number(event.clientY || 0),
    });
  }, { capture: true, passive: false });
});
