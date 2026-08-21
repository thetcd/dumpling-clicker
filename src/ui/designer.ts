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
import { isPartUnlocked, unlockLevel } from '../game/unlocks';

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
  // Available first, locked after. In registry order the two interleave and the
  // first screen a new player sees is a checkerboard of greys — it has to read
  // as "here are your choices" with the ladder below, not "mostly locked".
  /**
   * Just earned by the rebirth the player is standing on. The whole point of
   * gating a part is the moment you get it, and until now the designer gave no
   * hint which of 49 tiles was the new one.
   */
  const isNew = (o: PartOption) => state.prestige > 0 && unlockLevel(o) === state.prestige;

  const byAvailability = <T extends PartOption>(list: T[], worn: string): T[] => {
    // newest first, then the rest of what is open, then the locked ladder
    const fresh = list.filter((o) => isNew(o));
    const open = list.filter(
      (o) => !isNew(o) && isPartUnlocked(o, state.prestige, worn),
    );
    const shut = list.filter(
      (o) => !isNew(o) && !isPartUnlocked(o, state.prestige, worn),
    );
    return [...fresh, ...open, ...shut];
  };

  for (const c of byAvailability(BODY_COLORS, state.avatar.color)) {
    const b = document.createElement('button');
    b.className = 'dz-swatch';
    b.style.background = c.fill;
    b.dataset.id = c.id;
    // Colours are gated on the same ladder as the part tiles, but they are
    // built here rather than through partGroup, so the lock has to be applied
    // separately — easy to miss and the reason this comment exists.
    const colorOpen = isPartUnlocked(c, state.prestige, state.avatar.color);
    b.title = colorOpen ? c.nameHe : STR.partLocked(unlockLevel(c));
    if (isNew(c)) b.classList.add('dz-new');
    if (!colorOpen) {
      b.classList.add('locked');
      b.disabled = true;
      b.innerHTML = `<span class="dz-lock">🔒<b>${unlockLevel(c)}</b></span>`;
    }
    b.addEventListener('click', () => {
      if (!isPartUnlocked(c, state.prestige, state.avatar.color)) return;
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
        const opt = g.options.find((o) => o.id === id)!;
        // A locked tile shows the LOCK, not the part. Showing the part greyed
        // out reads as "broken", and showing the level it opens at is the whole
        // motivational point of gating them in the first place.
        if (!isPartUnlocked(opt, state.prestige, state.avatar[g.key])) {
          el.innerHTML = `<span class="dz-lock">🔒<b>${unlockLevel(opt)}</b></span>`;
        } else {
          el.innerHTML = avatarSVG({ ...draft, [g.key]: id }, 'mini-svg');
        }
      }
    }
  };

  const partGroup = (
    host: HTMLElement,
    options: PartOption[],
    key: 'eyes' | 'mouth' | 'accessory',
  ) => {
    const ordered = byAvailability(options, state.avatar[key]);
    groups.push({ host, options: ordered, key });
    for (const opt of ordered) {
      const b = document.createElement('button');
      b.className = 'dz-part';
      b.dataset.id = opt.id;
      const unlocked = isPartUnlocked(opt, state.prestige, state.avatar[key]);
      b.title = unlocked ? opt.nameHe : STR.partLocked(unlockLevel(opt));
      if (isNew(opt)) b.classList.add('dz-new');
      if (!unlocked) {
        b.classList.add('locked');
        b.disabled = true;
      }
      b.addEventListener('click', () => {
        if (!isPartUnlocked(opt, state.prestige, state.avatar[key])) return;
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
