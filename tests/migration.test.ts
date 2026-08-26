// The gate on the "save your backup code" nag. Small surface, but it decides
// whether a player's run survives the move to the Play app, and both of its
// failure directions are asymmetric: nagging someone twice costs a tap, while
// staying quiet at the wrong moment costs hours of rebirths. Every case here
// is pinned in the direction that keeps the code moving off the device.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeSaved, markCodeSaved, shouldNag, PLAY_LIVE, PLAY_URL } from '../src/migration';

// Tests run in node, with no DOM and no localStorage, so each case installs
// the store it wants — including one that throws, which is what a browser in
// private mode with storage blocked actually does.
function useStore(store: Map<string, string>): void {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
  });
}

function useBlockedStore(): void {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('storage blocked');
    },
    setItem: () => {
      throw new Error('storage blocked');
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('the nag gate', () => {
  it('asks a returning player who has never copied a code', () => {
    useStore(new Map());
    expect(shouldNag(true)).toBe(true);
  });

  it('stops asking once a code has actually been copied', () => {
    useStore(new Map());
    markCodeSaved();
    expect(codeSaved()).toBe(true);
    expect(shouldNag(true)).toBe(false);
  });

  it('never asks a brand-new player, who has nothing to rescue yet', () => {
    useStore(new Map());
    expect(shouldNag(false)).toBe(false);
  });

  it('keeps asking when storage is blocked, rather than assuming they are safe', () => {
    useBlockedStore();
    expect(codeSaved()).toBe(false);
    expect(shouldNag(true)).toBe(true);
  });

  it('survives a blocked write without throwing into the caller', () => {
    useBlockedStore();
    expect(() => markCodeSaved()).not.toThrow();
  });
});

describe('the switch', () => {
  // The one assertion that has to fail loudly the day someone flips this by
  // accident: while the Play listing is closed-testing only, PLAY_LIVE true
  // would replace the game with a screen linking somewhere that 404s for
  // everyone except the 12 opted-in testers. Delete this case in the same
  // commit that flips the flag, and not before.
  it('is off, because the Play listing is not public yet', () => {
    expect(PLAY_LIVE).toBe(false);
  });

  it('points at the pinned applicationId, which cannot change after upload', () => {
    expect(PLAY_URL).toContain('id=com.dumplingclicker.twa');
  });
});
