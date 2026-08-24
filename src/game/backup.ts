// The save backup code — the ONLY rescue path a save has. There is no backend
// and no account: iOS Safari evicts localStorage after ~7 days away, and
// clearing site data wipes hours of rebirths. A player who kept a code pasted
// somewhere can always come back.
//
// Export is serialize → UTF-8 bytes → base64, behind a recognizable prefix.
// Import strips ALL whitespace first (messaging apps insert line breaks into
// long strings), tolerates a missing prefix, and validates through
// deserialize() — the same heal-or-null gate loading from storage uses — so a
// tampered or truncated code can never produce a state the game can't run on.
import { deserialize, serialize } from './save';
import type { GameState } from './state';

export const BACKUP_PREFIX = 'DC1:';

export function exportCode(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return BACKUP_PREFIX + btoa(bin);
}

export function importCode(code: string): GameState | null {
  const compact = code.replace(/\s+/g, '');
  const body = compact.startsWith(BACKUP_PREFIX)
    ? compact.slice(BACKUP_PREFIX.length)
    : compact;
  if (body === '') return null;
  let json: string;
  try {
    const bin = atob(body);
    json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  return deserialize(json);
}
