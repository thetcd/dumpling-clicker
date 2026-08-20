// The squishy creator: live preview + four option groups. Opens on first
// launch and from settings. Writes the design into state and reports done.
import {
  ACCESSORIES,
  BODY_COLORS,
  EYES,
  MOUTHS,
  type PartOption,
} from '../game/config/parts';
import type { AvatarDesign, GameState } from '../game/state';
import { STR } from '../i18n/strings.he';
import { avatarSVG } from './avatar';

export function openDesigner(
  state: GameState,
  onDone: (design: AvatarDesign) => void,
): void {
  const draft: AvatarDesign = { ...state.avatar };
  const overlay = document.createElement('div');
  overlay.className = 'designer';
  overlay.innerHTML = `
    <h2>${STR.designTitle}</h2>
    <p class="designer-sub">${STR.designSubtitle}</p>
    <div class="designer-preview" id="dz-preview"></div>
    <div class="designer-groups">
      <div class="dz-group"><h3>${STR.designColor}</h3><div class="dz-options" id="dz-color"></div></div>
      <div class="dz-group"><h3>${STR.designEyes}</h3><div class="dz-options" id="dz-eyes"></div></div>
      <div class="dz-group"><h3>${STR.designMouth}</h3><div class="dz-options" id="dz-mouth"></div></div>
      <div class="dz-group"><h3>${STR.designAccessory}</h3><div class="dz-options" id="dz-accessory"></div></div>
    </div>
    <button class="btn btn-primary designer-done">${STR.designDone}</button>`;
  document.body.appendChild(overlay);

  const preview = overlay.querySelector<HTMLElement>('#dz-preview')!;
  const render = () => {
    preview.innerHTML = avatarSVG(draft, 'preview-svg');
  };

  // color swatches
  const colorHost = overlay.querySelector<HTMLElement>('#dz-color')!;
  for (const c of BODY_COLORS) {
    const b = document.createElement('button');
    b.className = 'dz-swatch';
    b.style.background = c.fill;
    b.title = c.nameHe;
    b.dataset.id = c.id;
    b.addEventListener('click', () => {
      draft.color = c.id;
      mark(colorHost, c.id);
      render();
      paintTiles();
    });
    colorHost.appendChild(b);
  }

  // Part groups: each tile is the CURRENT draft with only this part swapped.
  // They used to be rendered once at open time from `{...draft, color:'classic'}`,
  // so after you picked hearts eyes every mouth tile still showed dot eyes, and
  // no tile ever showed your chosen colour — you chose a mouth by looking at a
  // face that wasn't yours. Re-render every group whenever the draft changes.
  const groups: Array<{
    host: HTMLElement;
    options: PartOption[];
    key: 'eyes' | 'mouth' | 'accessory';
  }> = [];

  const paintTiles = () => {
    for (const g of groups) {
      for (const el of Array.from(g.host.children) as HTMLElement[]) {
        const id = el.dataset.id!;
        el.innerHTML = avatarSVG({ ...draft, [g.key]: id }, 'mini-svg');
      }
    }
  };

  const partGroup = (
    host: HTMLElement,
    options: PartOption[],
    key: 'eyes' | 'mouth' | 'accessory',
  ) => {
    groups.push({ host, options, key });
    for (const opt of options) {
      const b = document.createElement('button');
      b.className = 'dz-part';
      b.dataset.id = opt.id;
      b.title = opt.nameHe;
      b.addEventListener('click', () => {
        draft[key] = opt.id;
        mark(host, opt.id);
        render();
        paintTiles();
      });
      host.appendChild(b);
    }
  };
  partGroup(overlay.querySelector<HTMLElement>('#dz-eyes')!, EYES, 'eyes');
  partGroup(overlay.querySelector<HTMLElement>('#dz-mouth')!, MOUTHS, 'mouth');
  partGroup(overlay.querySelector<HTMLElement>('#dz-accessory')!, ACCESSORIES, 'accessory');

  const mark = (host: HTMLElement, id: string) => {
    for (const el of host.children) {
      el.classList.toggle('selected', (el as HTMLElement).dataset.id === id);
    }
  };
  mark(colorHost, draft.color);
  mark(overlay.querySelector<HTMLElement>('#dz-eyes')!, draft.eyes);
  mark(overlay.querySelector<HTMLElement>('#dz-mouth')!, draft.mouth);
  mark(overlay.querySelector<HTMLElement>('#dz-accessory')!, draft.accessory);
  render();
  paintTiles();

  overlay.querySelector('.designer-done')!.addEventListener('click', () => {
    overlay.remove();
    onDone(draft);
  });
}
