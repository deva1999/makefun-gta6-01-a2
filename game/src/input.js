// Keyboard and mouse input, gathered in one place so the rest of the
// game reads plain booleans and a mouse position instead of events.

export function createInput(target) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let interactPressed = false;
  let pausePressed = false;

  target.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'KeyE' && !event.repeat) interactPressed = true;
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) pausePressed = true;
    keys.add(event.code);
  });
  target.addEventListener('keyup', (event) => keys.delete(event.code));
  target.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  target.addEventListener('mousemove', (event) => { mouse.x = event.clientX; mouse.y = event.clientY; });
  target.addEventListener('mousedown', (event) => { if (event.button === 0) { mouse.down = true; mouse.clicked = true; } });
  target.addEventListener('mouseup', (event) => { if (event.button === 0) mouse.down = false; });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    mouse,
    get forward() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    get back() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    get left() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    get right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    get sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get brake() { return keys.has('Space'); },
    consumeInteract() { const v = interactPressed; interactPressed = false; return v; },
    consumePause() { const v = pausePressed; pausePressed = false; return v; },
    consumeClick() { const v = mouse.clicked; mouse.clicked = false; return v; },
  };
}
