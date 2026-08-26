// The web retirement. The game is moving to a native Flutter app on Google
// Play (docs/FLUTTER-MIGRATION.md); this module owns the two facts every part
// of that move reads, and nothing else.
//
// Nothing here talks to the DOM, so the retirement screen (ui/farewell.ts) can
// import it from main.ts without dragging the game bundle in behind it.

/**
 * The Play listing. Deterministic from the applicationId, which is pinned in
 * the Flutter repo and unchangeable after the first upload, so this URL is
 * already correct — it just 404s for anyone outside the closed test until
 * production access lands.
 */
export const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.dumplingclicker.twa';

/**
 * THE SWITCH. `false` keeps the web game playable and only nags players to
 * save their backup code; `true` retires the site to a static screen that
 * points at Play and hands over the code one last time.
 *
 * Do not flip this until the Play listing is PUBLIC. While the app sits on a
 * closed-testing track the link works for 12 opted-in testers and nobody else,
 * so flipping early leaves every other player with no game at all.
 */
export const PLAY_LIVE = false;

// Not in the save: this is a fact about the DEVICE ("the person holding this
// phone has their code written down"), not about the run. Putting it in the
// save would also mean a restored code arrives already claiming it was saved.
const SAVED_KEY = 'migration-code-saved';

/** Has this device copied its backup code since the move was announced? */
export function codeSaved(): boolean {
  try {
    return localStorage.getItem(SAVED_KEY) !== null;
  } catch {
    return false; // storage blocked — nag rather than assume they are safe
  }
}

/** Called from the one place a code actually reaches the clipboard. */
export function markCodeSaved(): void {
  try {
    localStorage.setItem(SAVED_KEY, '1');
  } catch {
    /* storage blocked — they will be asked again, which is the safe direction */
  }
}

/**
 * Who sees the nag: players with a run to lose who have not written it down.
 *
 * A brand-new player is skipped on purpose. They have nothing to rescue yet,
 * and the first screen anyone sees is already the designer — opening on a
 * "this is going away" modal is how you lose someone before the first tap.
 * They have a save by their second launch, and the nag finds them there.
 */
export function shouldNag(hasSave: boolean): boolean {
  return hasSave && !codeSaved();
}
