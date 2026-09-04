// Phase 0a of docs/FLUTTER-MIGRATION.md: emit the JS-side truth for Hebrew
// number formatting so the Dart port can be asserted against it. The fixture
// is committed to the Flutter project (test/fixtures/format_he.json); regenerate
// with `node tools/format-fixture.mjs > <flutter>/test/fixtures/format_he.json`
// whenever format.ts or quantize.ts changes.
//
// Deterministic on purpose — no randomness, so the fixture never churns.
import { formatNumber, formatRate } from '../src/ui/format.ts';
import { roundToDisplay } from '../src/game/quantize.ts';
import { fixtureValues } from './fixture-values.mjs';

// quantize idempotence pairs: value → roundToDisplay(value)
const rows = fixtureValues().map((v) => ({
  v,
  num: formatNumber(v),
  rate: formatRate(v),
  quant: roundToDisplay(v),
}));
process.stdout.write(JSON.stringify(rows, null, 1));
