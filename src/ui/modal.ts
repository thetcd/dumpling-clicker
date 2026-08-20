// One modal at a time, promise-free and tiny.
export interface ModalButton {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export function showModal(opts: {
  title: string;
  bodyHTML: string;
  buttons: ModalButton[];
  celebration?: boolean;
}): void {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${opts.celebration ? 'modal-celebrate' : ''}" role="dialog" aria-modal="true">
      <h2>${opts.title}</h2>
      <div class="modal-body">${opts.bodyHTML}</div>
      <div class="modal-buttons"></div>
    </div>`;
  const buttonHost = backdrop.querySelector<HTMLElement>('.modal-buttons')!;
  for (const b of opts.buttons) {
    const btn = document.createElement('button');
    btn.className = b.primary ? 'btn btn-primary' : 'btn';
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      closeModal();
      b.onClick?.();
    });
    buttonHost.appendChild(btn);
  }
  document.body.appendChild(backdrop);
}

export function closeModal(): void {
  document.querySelector('.modal-backdrop')?.remove();
}
