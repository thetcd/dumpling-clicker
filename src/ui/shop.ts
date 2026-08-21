// Shop: upgrade chips on top, producer list below. Rows are built once and
// refreshed in place (throttled by the game loop) — no per-frame DOM churn.
import { buyProducer, buyUpgrade } from '../game/actions';
import { isUpgradeRevealed, clickValue, clickValueWith, costOf } from '../game/economy';
import { PRODUCERS } from '../game/config/producers';
import { UPGRADES } from '../game/config/upgrades';
import { MAX_UPGRADE_CHIPS } from '../game/config/balance';
import type { GameState } from '../game/state';
import { STR } from '../i18n/strings.he';
import { formatNumber, formatRate } from './format';
import { renderIcon } from './icons';

export interface ShopApi {
  update(): void;
}

export function initShop(
  host: HTMLElement,
  /**
   * A GETTER, not the state object. Rebirth REPLACES the state, and a captured
   * reference would leave the shop reading and mutating the dead run — the same
   * trap that startLoop documents.
   */
  getState: () => GameState,
  onPurchase: (kind: 'producer' | 'upgrade', id: string) => void,
): ShopApi {
  host.innerHTML = `
    <div class="upgrades" id="upgrade-list" hidden></div>
    <h2 class="shop-heading">${STR.shopProducers}</h2>
    <div class="producers" id="producer-list"></div>`;
  const upgradeHost = host.querySelector<HTMLElement>('#upgrade-list')!;
  const producerHost = host.querySelector<HTMLElement>('#producer-list')!;

  // --- producers: one row per tier, revealed as the player progresses ---
  const rows = PRODUCERS.map((def, i) => {
    const row = document.createElement('button');
    row.className = 'producer-row';
    row.innerHTML = `
      <span class="p-icon"></span>
      <span class="p-main">
        <span class="p-name"></span>
        <span class="p-desc"></span>
        <span class="p-gain"></span>
      </span>
      <span class="p-side">
        <span class="p-cost"></span>
        <span class="p-owned"></span>
      </span>`;
    row.addEventListener('click', () => {
      if (buyProducer(getState(), def.id)) {
        // audio is owned by the onPurchase handler in main.ts, which knows the
        // tier and whether this is the first of its kind
        onPurchase('producer', def.id);
        update();
      }
    });
    producerHost.appendChild(row);
    return {
      def,
      index: i,
      row,
      icon: row.querySelector<HTMLElement>('.p-icon')!,
      name: row.querySelector<HTMLElement>('.p-name')!,
      desc: row.querySelector<HTMLElement>('.p-desc')!,
      gain: row.querySelector<HTMLElement>('.p-gain')!,
      cost: row.querySelector<HTMLElement>('.p-cost')!,
      ownedEl: row.querySelector<HTMLElement>('.p-owned')!,
    };
  });

  // --- upgrades: chips rebuilt only when the visible set changes ---
  let upgradeSignature = '';

  function rebuildUpgrades(): void {
    const clicks = getState().stats.totalClicks;
    const earned = getState().totalEarned;
    const owned = (u: { id: string }) => getState().upgrades.includes(u.id);
    // Cheapest first, and only a few at a time. A chip is a tall card and they
    // wrap one per row, so at twelve upgrades the shelf measured 270% of the
    // shop's height and buried every producer row — the core purchase loop —
    // below the fold. UPGRADE_REVEAL_FRACTION staggers WHEN they appear; this
    // bounds HOW MANY are on screen at once. Buying one immediately promotes
    // the next, so the shelf is a steady drip rather than a wall.
    const unlocked = UPGRADES.filter((u) => !owned(u) && isUpgradeRevealed(u, clicks, earned))
      .sort((a, b) => a.cost - b.cost)
      .slice(0, MAX_UPGRADE_CHIPS);
    // tease the next locked upgrade so the player always sees that squishing
    // itself unlocks stronger squishes
    const nextLocked = UPGRADES.filter((u) => !owned(u) && !isUpgradeRevealed(u, clicks, earned))
      .sort((a, b) => a.cost - b.cost)[0];
    // which condition is actually blocking it decides what the teaser says —
    // "tap N more times" is a lie when the tap gate is already satisfied
    const teaserNeedsClicks = nextLocked !== undefined && clicks < nextLocked.unlockAtClicks;
    const sig = `${unlocked.map((u) => u.id).join()}|${nextLocked?.id ?? ''}|${teaserNeedsClicks}`;
    if (sig === upgradeSignature) {
      updateUpgradeDynamic();
      return;
    }
    upgradeSignature = sig;
    const any = unlocked.length > 0 || nextLocked !== undefined;
    upgradeHost.hidden = !any;
    upgradeHost.innerHTML = any
      ? `<h2 class="shop-heading">${STR.shopUpgrades}</h2>`
      : '';
    for (const def of unlocked) {
      const chip = document.createElement('button');
      chip.className = 'upgrade-chip';
      chip.dataset.cost = String(def.cost);
      // Concrete before/after, not just "x2": with the share-scaling upgrades
      // the real gain depends on current production, which no player can work
      // out in their head.
      chip.innerHTML = `
        <span class="u-name">${def.nameHe}</span>
        <span class="u-desc">${def.descHe}</span>
        <span class="u-gain" data-upgrade-gain="${def.id}"></span>
        <span class="u-cost">🥟 ${formatNumber(def.cost)}</span>`;
      chip.addEventListener('click', () => {
        if (buyUpgrade(getState(), def.id)) {
          onPurchase('upgrade', def.id);
          upgradeSignature = ''; // force rebuild (chip disappears)
          update();
        }
      });
      upgradeHost.appendChild(chip);
    }
    if (nextLocked) {
      const chip = document.createElement('button');
      chip.className = 'upgrade-chip teaser';
      chip.disabled = true;
      if (teaserNeedsClicks) chip.dataset.unlockAt = String(nextLocked.unlockAtClicks);
      chip.innerHTML = `
        <span class="u-name">❓</span>
        <span class="u-desc" data-teaser>${teaserNeedsClicks ? '' : STR.upgradeTeaserEarn}</span>`;
      upgradeHost.appendChild(chip);
    }
    updateUpgradeDynamic();
  }

  function updateUpgradeDynamic(): void {
    for (const chip of upgradeHost.querySelectorAll<HTMLButtonElement>('.upgrade-chip:not(.teaser)')) {
      chip.disabled = getState().dumplings < Number(chip.dataset.cost);
    }
    // the gain is live: a share-scaling upgrade is worth more as production grows
    for (const el of upgradeHost.querySelectorAll<HTMLElement>('[data-upgrade-gain]')) {
      const id = el.dataset.upgradeGain!;
      el.textContent = STR.gainClick(
        formatNumber(clickValue(getState())),
        formatNumber(clickValueWith(getState(), id)),
      );
    }
    const teaser = upgradeHost.querySelector<HTMLElement>('.teaser [data-teaser]');
    const teaserChip = upgradeHost.querySelector<HTMLElement>('.teaser');
    // Only a tap-gated teaser gets the countdown. A cost-gated one has no
    // `unlockAt`, and Number(undefined) is NaN, which rendered as the nonsense
    // "unlocks after 0 more squishes" while the real blocker was the price.
    if (teaser && teaserChip && teaserChip.dataset.unlockAt !== undefined) {
      const remaining = Number(teaserChip.dataset.unlockAt) - getState().stats.totalClicks;
      teaser.textContent = STR.upgradeTeaser(formatNumber(Math.max(remaining, 0)));
    }
  }

  function update(): void {
    for (const r of rows) {
      const owned = getState().producers[r.def.id] ?? 0;
      // reveal rule: always show the first tier, anything owned, anything the
      // player has earned enough to have "heard of" (25% of base cost), and
      // tease exactly one locked tier beyond the frontier as ???
      const prevOwned = r.index === 0 || (getState().producers[rows[r.index - 1].def.id] ?? 0) > 0;
      const known =
        r.index === 0 || owned > 0 || getState().totalEarned >= r.def.baseCost * 0.25;
      const teased = !known && prevOwned;
      r.row.hidden = !known && !teased;
      if (r.row.hidden) continue;
      const cost = costOf(r.def, owned);
      if (known) {
        renderIcon(r.icon, r.def.id, r.def.icon);
        r.name.textContent = r.def.nameHe;
        r.desc.textContent = r.def.descHe;
        // What this purchase gives you — the row showed a price and an owned
        // count but never the rate, so there was no way to judge the trade.
        r.gain.textContent =
          owned > 0
            ? `${STR.gainPerSecond(formatRate(r.def.baseDps))} · ${STR.producesNow(
                formatRate(r.def.baseDps * owned),
              )}`
            : STR.gainPerSecond(formatRate(r.def.baseDps));
        r.row.classList.remove('mystery');
      } else {
        r.icon.textContent = '❓'; // don't spoil the next tier
        r.name.textContent = STR.locked;
        r.desc.textContent = '';
        r.gain.textContent = '';
        r.row.classList.add('mystery');
      }
      // A teased row hid the icon, name and description and then printed the
      // exact price beside them, so the tier was trivially identifiable. Hide
      // the cost too, or there is nothing left to be curious about.
      r.cost.textContent = known ? `🥟 ${formatNumber(cost)}` : '🥟 ???';
      r.ownedEl.textContent = owned > 0 ? String(owned) : '';
      (r.row as HTMLButtonElement).disabled = getState().dumplings < cost || !known;
    }
    rebuildUpgrades();
  }

  update();
  return { update };
}
