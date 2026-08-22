import { STR } from '../i18n/strings.he';
import { formatNumber, formatRate } from './format';

export interface HudApi {
  update(
    dumplings: number,
    dps: number,
    perClick: number,
    frenzyMs?: number,
    frenzyMult?: number,
  ): void;
}

export function initHud(host: HTMLElement): HudApi {
  host.innerHTML = `
    <h1 class="hud-title">${STR.title}</h1>
    <div class="hud-count"><span id="hud-num">0</span> <span id="hud-unit">${STR.dumplings}</span></div>
    <div class="hud-stats">
      <span class="hud-stat" id="hud-click"></span>
      <span class="hud-stat" id="hud-dps" hidden></span>
    </div>
    <div class="hud-frenzy" id="hud-frenzy" hidden></div>`;
  const num = host.querySelector<HTMLElement>('#hud-num')!;
  // the unit has to move with the number — it is singular at exactly one
  const unit = host.querySelector<HTMLElement>('#hud-unit')!;
  const clickEl = host.querySelector<HTMLElement>('#hud-click')!;
  const dpsEl = host.querySelector<HTMLElement>('#hud-dps')!;
  const frenzyEl = host.querySelector<HTMLElement>('#hud-frenzy')!;
  let lastNum = '';
  let lastUnit = '';
  let lastClick = '';
  let lastDps = '';
  let lastFrenzy = '';
  return {
    update(dumplings, dps, perClick, frenzyMs = 0, frenzyMult = 1) {
      const frenzyText =
        frenzyMs > 0 ? STR.frenzyBadge(frenzyMult, Math.ceil(frenzyMs / 1000)) : '';
      if (frenzyText !== lastFrenzy) {
        frenzyEl.textContent = frenzyText;
        frenzyEl.hidden = frenzyText === '';
        lastFrenzy = frenzyText;
      }
      const n = formatNumber(dumplings);
      if (n !== lastNum) {
        num.textContent = n;
        lastNum = n;
      }
      const unitText = STR.currencyUnit(dumplings);
      if (unitText !== lastUnit) {
        unit.textContent = unitText;
        lastUnit = unitText;
      }
      const clickText = `👆 ${formatNumber(perClick)} ${STR.perClick}`;
      if (clickText !== lastClick) {
        clickEl.textContent = clickText;
        lastClick = clickText;
      }
      const dpsText =
        dps > 0
          ? `⏱ ${formatRate(dps)} ${STR.perSecond}`
          : '';
      if (dpsText !== lastDps) {
        dpsEl.textContent = dpsText;
        dpsEl.hidden = dpsText === '';
        lastDps = dpsText;
      }
    },
  };
}
