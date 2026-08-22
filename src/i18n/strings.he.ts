// Every user-facing string. The M5 content pass edits this file + config/ only.
export const STR = {
  title: 'דאמפלינג קליקר',
  // The currency is SHEKELS. One place, so a re-theme is one edit. Note the
  // rebirth meter deliberately does NOT use this — that bar is exp, not money
  // (Dor, 2026-08-22).
  dumplings: 'שקלים',
  currency: '₪',
  /**
   * The unit, agreeing with its number. Hebrew takes the singular at one, so
   * "1 שקלים" is wrong the way "1 shekels" is — and that shipped to the live
   * site, on the first screen, one tap in. Floors first because the HUD does.
   */
  currencyUnit: (n: number) => (Number.isFinite(n) && Math.floor(n) === 1 ? 'שקל' : 'שקלים'),
  perSecond: 'לשנייה',
  perClick: 'למעיכה',
  upgradeTeaser: (n: string) => `ייפתח אחרי עוד ${n} מעיכות`,
  upgradeTeaserEarn: 'ייפתח כשתאספו עוד קצת',
  upgradeTeaserNext: 'ייפתח אחרי שתקנו את השדרוג שלמעלה',
  shopProducers: 'הצוות שלך',
  shopUpgrades: 'שדרוגים',
  owned: 'ברשותך',
  locked: '???',
  // welcomeBackTitle/welcomeBackBody removed 2026-08-21 — nothing accrues while
  // the window is closed, so there is no haul to greet the player with.
  designTitle: 'עצבו את הסקווישי שלכם',
  designSubtitle: 'ככה הוא ייראה כשתמעכו אותו',
  designColor: 'צבע',
  designEyes: 'עיניים',
  designMouth: 'פה',
  designAccessory: 'אקססורי',
  partLocked: (level: number) => `ייפתח בלידה מחדש ${level}`,
  designDone: 'זה הסקווישי שלי!',
  settings: 'הגדרות',
  sound: 'צלילים',
  music: 'מוזיקת רקע',
  editSquishy: 'עיצוב הסקווישי מחדש',
  share: 'שתפו את הסקווישי שלכם',
  shareText: (count: string) =>
    `הסקווישי שלי כבר הרוויח ${count} שקלים בדאמפלינג קליקר! 🥟 בואו תמעכו גם`,
  // Deliberately NOT worded like `reset` below, which DESTROYS the save. These
  // two must never look alike in the UI.
  rebirthTitle: 'לידה מחדש',
  rebirthLevel: (n: number, max: number) => `לידה מחדש ${n}/${max}`,
  // The max state: a full bar, no button, and a reason to come back. This line
  // is the hook every weekly release pulls on.
  rebirthMaxed: 'הגעתם למקסימום! 🎉',
  rebirthMaxedNext: 'עוד לידות מחדש בעדכון הבא',
  rebirthReady: 'להיוולד מחדש!',
  rebirthBonus: (mult: string) => `בונוס קבוע ×${mult}`,
  rebirthNext: (mult: string) => `אחרי הלידה מחדש: ×${mult} לתמיד`,
  rebirthConfirmTitle: 'להיוולד מחדש?',
  rebirthConfirmBody:
    'השקלים והצוות שלכם יתאפסו. הסקווישי, הלידות מחדש והבונוס הקבוע נשארים — ואקססוריז חדשים ייפתחו.',
  // Spelled out because Dor could not tell what a rebirth kept ("the saved
  // items in each rebirth are not consistent"). Fed by rebirthKeepSummary, so
  // it always matches what the reset actually does.
  rebirthKeepTitle: 'מה נשאר לכם:',
  // Hebrew takes no numeral for one — "ב־1 מקומות" is wrong the way
  // "in 1 places" is wrong, and this is the line that explains the game's own
  // rules, so it cannot read as machine output.
  rebirthKeepProducers: (units: number, tiers: number) =>
    `אחד מכל 4 בצוות — ${units === 1 ? 'סקווישי אחד' : `${units} סקווישים`} ${
      tiers === 1 ? 'במקום אחד' : `ב־${tiers} מקומות`
    }`,
  rebirthKeepUpgrades: (n: number) =>
    n === 1 ? 'שדרוג מעיכה קבוע אחד' : `${n} שדרוגי מעיכה קבועים`,
  rebirthKeepNothing: 'הפעם אין צוות לשמור — הכל מתחיל מחדש',
  rebirthYes: 'קדימה!',
  rebirthDone: (n: number) => `לידה מחדש ${n}! 🎉`,
  rebirthCelebrateTitle: (n: number) => `🎉 לידה מחדש ${n}!`,
  rebirthCelebrateBody: (mult: string) => `כל ההכנסות שלכם ×${mult} מעכשיו, לתמיד.`,
  rebirthNewParts: (n: number) =>
    n === 1 ? 'ופריט עיצוב חדש נפתח לסקווישי שלכם!' : `ו-${n} פריטי עיצוב חדשים נפתחו לסקווישי שלכם!`,
  rebirthNoParts: 'הפריט הבא לעיצוב מחכה לכם בלידה מחדש הבאה.',
  rebirthDesignNow: '🎨 לעצב עכשיו',
  reset: 'מחיקת הכל',
  resetConfirm: 'בטוחים? הכל יימחק — שקלים, צוות ולידות מחדש. אין דרך לחזור.',
  resetYes: 'כן, למחוק הכל',
  cancel: 'ביטול',
  close: 'סגירה',
  bossTitle: '👑 הגעתם לפסגה!',
  bossBody: 'הבוס של הסקווישים — גל בכבודו ובעצמו — הצטרף לצוות שלכם!',
  bossShare: 'לספר לכולם',
  iosInstallHint: 'טיפ: לחצו על שיתוף ואז "הוסף למסך הבית" כדי לשחק כמו אפליקציה',
  gotIt: 'הבנתי',
  copied: 'הועתק!',
  // what a purchase actually buys you — shown on every shop row
  // ‎ (LRM) keeps the sign on the left of the digits; without it RTL bidi
  // reorders "+0.15" into "0.15+".
  gainPerSecond: (amount: string) => `‎+${amount}‎ לשנייה`,
  gainClick: (from: string, to: string) => `מעיכה: ${from} ← ${to}`,
  gainMult: (n: number) => `כל מעיכה ×${n}`,
  gainCritChance: (pct: number, mult: number) => `${pct}% סיכוי למעיכה ×${mult}`,
  gainCritMult: (mult: number) => `מעיכה מושלמת ×${mult}`,
  producesNow: (amount: string) => `מייצרים ${amount} לשנייה`,
  firstOfTier: (name: string) => `${name} הצטרפו לצוות! 🎉`,
  goldenLabel: 'כופתאה מוזהבת!',
  airdropLabel: 'חבילת שקלים!',
  commonLabel: 'משהו נוצץ!',
  rewardCaught: (amount: string) => `‎+${amount}`,
  critFloater: (amount: string) => `‎+${amount} 💥`,
  frenzyBadge: (mult: number, secs: number) => `🔥 טירוף ×${mult} — ${secs} שנ׳`,
  frenzyStart: (mult: number) => `×${mult} טירוף!`,
} as const;
