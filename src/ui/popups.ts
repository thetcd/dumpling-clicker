// Pooled "+N" floaters at the squish point. Fixed pool, no allocations in the
// hot path, CSS does the animation.
const POOL_SIZE = 14;
let pool: HTMLElement[] = [];
let next = 0;

export function initPopups(): void {
  const host = document.createElement('div');
  host.className = 'floaters';
  document.body.appendChild(host);
  pool = Array.from({ length: POOL_SIZE }, () => {
    const el = document.createElement('div');
    el.className = 'floater';
    host.appendChild(el);
    return el;
  });
}

export function spawnFloater(x: number, y: number, text: string): void {
  const el = pool[next];
  next = (next + 1) % POOL_SIZE;
  el.textContent = text;
  const jx = (Math.random() - 0.5) * 30;
  el.style.left = `${x + jx}px`;
  el.style.top = `${y - 20}px`;
  el.classList.remove('float-up');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('float-up');
}
