// Shop: upgrade chips on top, producer list below. Rows are built once and
// refreshed in place (throttled by the game loop) — no per-frame DOM churn.
import { buyProducer, buyUpgrade } from '../game/actions';
import { isUpgradeRevealed, clickValue, clickValueWith, costOf, critParams } from '../game/economy';
import { PRODUCERS } from '../game/config/producers';
import { CRIT_BASE_MULT, UPGRADES, type UpgradeDef } from '../game/config/upgrades';
import { MAX_UPGRADE_CHIPS } from '../game/config/balance';
import type { GameState } from '../game/state';
import { STR } from '../i18n/strings.he';
import { formatNumber, formatRate } from './format';
import { renderIcon } from './icons';

export interface ShopApi {
  update(): void;
}

/**
 * What a chip promises, phrased per tier — one label for all three was wrong.
 *
 * The absolute "מעיכה: 2 ← 4" reads as "your click BECOMES 4". With several x2
 * upgrades on the shelf at once, each independently doubling from the same
 * current value, every one of them promised 4 at a different price and they
 * looked like the same upgrade duplicated. Dor hit exactly this. They are
 * sequential doublings — a relative "×2" says that and stays true whatever the
 * player buys first.
 *
 * A share upgrade keeps the before/after, because its real gain depends on
 * current production and is the one number nobody can work out in their head.
 *
 * A crit upgrade needs its own phrasing or it is actively broken: crit lives
 * outside clickValue by design, so the before/after preview rendered "49 ← 49",
 * an upgrade that looks like it does nothing at all.
 */
/**
 * Which click upgrades the shop offers right now, and what the teaser is
 * waiting on.
 *
 * **One at a time, in cost order.** Every click upgrade improves the same
 * thing, so two on the shelf together — "ידיים חמות" and "כפפות משי", both ×2 —
 * read as one upgrade listed twice at two prices. Dor reported exactly that.
 * Selling them in sequence makes the ladder obvious: buy this, the next
 * appears. It also keeps the shelf short, which is what stops twelve upgrades
 * burying the producer list.
 *
 * The teaser is the next one by cost whether or not it is revealed, because
 * with a sequence the honest message is "after you buy this one" — the old
 * "next LOCKED upgrade" would skip past anything the sequence is holding back
 * and tease a tier further up.
 */
export function upgradeShelf(state: GameState): {
  shown: UpgradeDef[];
  teaser?: UpgradeDef;
  teaserReason?: 'sequence' | 'clicks' | 'cost';
} {
  const { totalClicks } = state.stats;
  const unbought = UPGRADES.filter((u) => !state.upgrades.includes(u.id)).sort(
    (a, b) => a.cost - b.cost,
  );
  const shown = unbought
    .filter((u) => isUpgradeRevealed(u, totalClicks, state.totalEarned))
    .slice(0, MAX_UPGRADE_CHIPS);
  const teaser = unbought.find((u) => !shown.includes(u));
  if (!teaser) return { shown };
  const teaserReason = isUpgradeRevealed(teaser, totalClicks, state.totalEarned)
    ? 'sequence'
    : totalClicks < teaser.unlockAtClicks
      ? 'clicks'
      : 'cost';
  return { shown, teaser, teaserReason };
}

export function upgradeGainLabel(def: UpgradeDef, state: GameState): string {
  if (def.critChance || def.critMult) {
    const now = critParams(state.upgrades);
    const after = critParams([...state.upgrades, def.id]);
    // `after.mult` is 0 when no crit CHANCE is owned yet — critParams reports
    // "no crit at all" in that case, which is right for the economy and wrong
    // for a label: a payout upgrade previewed on its own rendered "×0".
    const mult = after.mult || def.critMult || CRIT_BASE_MULT;
    return def.critChance && after.chance !== now.chance
      ? STR.gainCritChance(Math.round(after.chance * 100), mult)
      : STR.gainCritMult(mult);
  }
  // A share upgrade is checked BEFORE the flat one because it now carries both
  // (see upgrades.ts): the before/after is the honest total of the two effects,
  // where `x1.5` would report only half of what the player is buying.
  if (def.shareMultiplier) {
    const before = clickValue(state);
    const after = clickValueWith(state, def.id);
    const from = formatNumber(before);
    const to = formatNumber(after);
    if (from !== to) return STR.gainClick(from, to);
    // The two rendered identically, which reads as "this upgrade does nothing".
    // formatNumber is lossy on purpose — it floors below a million and carries
    // one decimal above it — so two genuinely different values collide in the
    // string long before they collide in the maths. Fall back to the relative
    // multiplier, which is always true and can never read as no change.
    const ratio = before > 0 && Number.isFinite(after / before) ? after / before : 0;
    return STR.gainMult(ratio > 1 ? Math.round(ratio * 10) / 10 : def.shareMultiplier);
  }
  if (def.multiplier) return STR.gainMult(def.multiplier);
  return STR.gainClick(
    formatNumber(clickValue(state)),
    formatNumber(clickValueWith(state, def.id)),
  );
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
    // one at a time, in cost order — see upgradeShelf
    const { shown: unlocked, teaser: nextLocked, teaserReason } = upgradeShelf(getState());
    const teaserNeedsClicks = teaserReason === 'clicks';
    const sig = `${unlocked.map((u) => u.id).join()}|${nextLocked?.id ?? ''}|${teaserReason ?? ''}`;
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
      // the effect line is phrased per tier — see upgradeGainLabel
      chip.innerHTML = `
        <span class="u-name">${def.nameHe}</span>
        <span class="u-desc">${def.descHe}</span>
        <span class="u-gain" data-upgrade-gain="${def.id}"></span>
        <span class="u-cost">${STR.currency} ${formatNumber(def.cost)}</span>
        <span class="u-keep" data-upgrade-keep="${def.id}"></span>`;
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
      // "after this one" is the honest message when the sequence is the only
      // thing holding it back — the player can already afford it
      const waiting =
        teaserReason === 'sequence'
          ? STR.upgradeTeaserNext
          : teaserReason === 'cost'
            ? STR.upgradeTeaserEarn
            : '';
      chip.innerHTML = `
        <span class="u-name">❓</span>
        <span class="u-desc" data-teaser>${waiting}</span>`;
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
      const def = UPGRADES.find((u) => u.id === el.dataset.upgradeGain);
      if (def) el.textContent = upgradeGainLabel(def, getState());
    }
    // Permanence countdown. Why it is on the chip and not in a menu: this is
    // the line that stops a re-bought upgrade reading as a demotion.
    for (const el of upgradeHost.querySelectorAll<HTMLElement>('[data-upgrade-keep]')) {
      const def = UPGRADES.find((u) => u.id === el.dataset.upgradeKeep);
      if (!def) continue;
      const rank = getState().prestige;
      el.textContent =
        rank >= def.permanentFromRank ? STR.upgradeKeepForever : STR.upgradeKeepFrom(def.permanentFromRank);
      el.classList.toggle('is-forever', rank >= def.permanentFromRank);
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
      r.cost.textContent = known ? `${STR.currency} ${formatNumber(cost)}` : `${STR.currency} ???`;
      r.ownedEl.textContent = owned > 0 ? String(owned) : '';
      (r.row as HTMLButtonElement).disabled = getState().dumplings < cost || !known;
    }
    rebuildUpgrades();
  }

  update();
  return { update };
}
