// The English twin of format-fixture.mjs: emits Intl 'en' truth for the same
// 482 values so the Flutter app's StrEn formatting can be asserted against
// real Intl output instead of a guess. The formatters are built inline (the
// production src/ui/format.ts hardcodes 'he' on purpose — the web game is
// Hebrew; English exists only in the Flutter app).
//
// Regenerate with:
//   node tools/format-fixture-en.mjs > <flutter>/test/fixtures/format_en.json
//
// The `quant` column comes from the SAME locale-free quantize.ts — identical
// to the he fixture's by construction, kept so the Dart test loop stays
// uniform across locales.
import { roundToDisplay } from '../src/game/quantize.ts';
import { fixtureValues } from './fixture-values.mjs';

const plain = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  compactDisplay: 'long',
  maximumFractionDigits: 1,
});
const mantissa = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

const COMPACT_CEILING = 1e15;

function formatNumberEn(n) {
  if (!Number.isFinite(n) || n < 0) return '0';
  const whole = Math.floor(n);
  if (whole < 1_000_000) return plain.format(whole);
  if (whole < COMPACT_CEILING) return compact.format(whole);
  const exp = Math.floor(Math.log10(whole));
  return `${mantissa.format(whole / 10 ** exp)}e${exp}`;
}

function formatRateEn(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 10) {
    const fixed = n.toFixed(n < 1 ? 2 : 1);
    return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  }
  return formatNumberEn(n);
}

const rows = fixtureValues().map((v) => ({
  v,
  num: formatNumberEn(v),
  rate: formatRateEn(v),
  quant: roundToDisplay(v),
}));
process.stdout.write(JSON.stringify(rows, null, 1));
