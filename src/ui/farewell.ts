// Both halves of the goodbye, in one file because they tell one story: the
// game is moving to the Play app, and the player's run only comes with them if
// the backup code does.
//
//  - showMigrationNag()   runs on the LIVE site while PLAY_LIVE is false. The
//                         game still works; this only asks for the code.
//  - renderFarewell()     replaces the site once PLAY_LIVE is true.
//
// The farewell screen deliberately still hands the code over. The player who
// lands on it is by definition the one who never acted on the nag, so it is
// the last chance their run has, and a screen that only said "we moved" would
// be the thing that actually destroyed the saves.
import { exportCode } from '../game/backup';
import { loadFromStorage } from '../game/save';
import { STR } from '../i18n/strings.he';
import { PLAY_URL } from '../migration';
import { showModal } from './modal';
import { openBackupModal } from './backup-modal';
import { toast } from './toast';
import type { GameState } from '../game/state';

/**
 * The one-time-ish ask on the live site. Not once-only: it keeps coming back
 * every launch until the code is actually copied (migration.shouldNag), which
 * is the whole point — a player who taps "later" forever is a player whose run
 * is about to die quietly.
 */
export function showMigrationNag(state: GameState): void {
  showModal({
    title: STR.migrationTitle,
    bodyHTML: `<p>${STR.migrationBody}</p>`,
    buttons: [
      {
        label: STR.migrationCta,
        primary: true,
        // openBackupModal owns marking the code as saved, on the clipboard
        // success path only. Nothing here may mark it: opening the modal is
        // not the same as the code leaving the phone.
        onClick: () => openBackupModal(exportCode(state)),
      },
      { label: STR.migrationLater },
    ],
  });
}

/**
 * The retired site. Called from main.ts INSTEAD of booting the game, so no
 * loop, no audio, no service worker and no analytics ever start — same
 * discipline as the retired GitHub Pages screen it sits beside.
 */
export function renderFarewell(host: HTMLElement): void {
  const saved = loadFromStorage();
  const code = saved === null ? null : exportCode(saved);
  host.innerHTML = `
    <div class="moved-screen">
      <div class="moved-emoji">🥟</div>
      <p class="moved-title">${STR.farewellTitle}</p>
      <p class="moved-body">${STR.farewellBody}</p>
      <a class="moved-cta" href="${PLAY_URL}">${STR.farewellCta}</a>
      ${
        code === null
          ? `<p class="moved-body">${STR.farewellNoCode}</p>`
          : `<p class="moved-body">${STR.farewellCodeIntro}</p>
             <textarea class="backup-code" readonly dir="ltr">${code}</textarea>
             <button class="btn" type="button" id="farewell-copy">${STR.backupCopy}</button>`
      }
    </div>`;
  if (code === null) return;
  document.getElementById('farewell-copy')!.addEventListener('click', () => {
    navigator.clipboard.writeText(code).then(
      () => toast(STR.copied),
      // No reopen-the-modal fallback needed here: unlike the settings sheet,
      // this code is not inside a dismissable modal. It stays on screen for a
      // manual select-and-copy no matter what the clipboard does.
      () => toast(STR.backupCopyFailed),
    );
  });
}
