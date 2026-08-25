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
  // Play's Designed for Families rules expect the privacy policy to be
  // reachable INSIDE the app, not only from the store listing. Both pages are
  // same-origin, so a TWA opens them without leaving the app, and both are
  // precached, so they work offline.
  privacyLink: 'מדיניות פרטיות',
  aboutLink: 'אודות',
  // The backup code is the only rescue path a save has — no accounts, no
  // server, and iOS Safari evicts localStorage after ~7 days away. "קוד" and
  // not "ייצוא/יבוא": codes are a thing these players already know from Roblox.
  backup: 'קוד גיבוי',
  backupBody:
    'שמרו את הקוד במקום בטוח, למשל בהודעה לעצמכם. אם המשחק נמחק, מדביקים אותו ב"שחזור מקוד גיבוי" וממשיכים מאיפה שעצרתם.',
  backupCopy: 'העתקת הקוד',
  backupCopyFailed: 'ההעתקה לא עבדה. סמנו את הקוד והעתיקו אותו ידנית',
  restore: 'שחזור מקוד גיבוי',
  restoreBody: 'הדביקו כאן את קוד הגיבוי. זה יחליף את ההתקדמות הנוכחית שלכם.',
  restoreYes: 'לשחזר',
  restoreInvalid: 'הקוד לא תקין 😕 בדקו שהעתקתם את כולו',
  // The update toast: a new build downloaded in the background and WAITS for
  // this tap. Never reload on our own — see ui/update.ts.
  updateReady: '🎁 יש עדכון חדש! לחצו כאן',
  updateLoading: 'מעדכן…',
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
    'השקלים והצוות שלכם יתאפסו. הסקווישי, הלידות מחדש והבונוס הקבוע נשארים, ואקססוריז חדשים ייפתחו.',
  // Spelled out because Dor could not tell what a rebirth kept ("the saved
  // items in each rebirth are not consistent"). Fed by rebirthKeepSummary, so
  // it always matches what the reset actually does.
  rebirthKeepTitle: 'מה נשאר לכם:',
  // On a chip that is not permanent yet: turns re-buying it from a demotion
  // into a visible countdown. One line, one number — the same grammar a Roblox
  // rebirth shop uses, which these players already read.
  upgradeKeepFrom: (rank: number) => `נשאר לתמיד מדרגה ${rank}`,
  upgradeKeepForever: 'נשאר לכם לתמיד ✨',
  rebirthNewPermanent: (n: number) =>
    n === 1 ? 'שדרוג מעיכה אחד נשאר לכם לתמיד מעכשיו! ✨' : `${n} שדרוגי מעיכה נשארים לכם לתמיד מעכשיו! ✨`,
  // Hebrew takes no numeral for one — "ב־1 מקומות" is wrong the way
  // "in 1 places" is wrong, and this is the line that explains the game's own
  // rules, so it cannot read as machine output.
  rebirthKeepProducers: (units: number, tiers: number) =>
    `אחד מכל 4 בצוות: ${units === 1 ? 'סקווישי אחד' : `${units} סקווישים`} ${
      tiers === 1 ? 'במקום אחד' : `ב־${tiers} מקומות`
    }`,
  rebirthKeepUpgrades: (n: number) =>
    n === 1 ? 'שדרוג מעיכה קבוע אחד' : `${n} שדרוגי מעיכה קבועים`,
  rebirthKeepNothing: 'הפעם אין צוות לשמור, הכל מתחיל מחדש',
  rebirthYes: 'קדימה!',
  rebirthDone: (n: number) => `לידה מחדש ${n}! 🎉`,
  rebirthCelebrateTitle: (n: number) => `🎉 לידה מחדש ${n}!`,
  rebirthCelebrateBody: (mult: string) => `כל ההכנסות שלכם ×${mult} מעכשיו, לתמיד.`,
  rebirthNewParts: (n: number) =>
    n === 1 ? 'ופריט עיצוב חדש נפתח לסקווישי שלכם!' : `ו-${n} פריטי עיצוב חדשים נפתחו לסקווישי שלכם!`,
  rebirthNoParts: 'הפריט הבא לעיצוב מחכה לכם בלידה מחדש הבאה.',
  rebirthDesignNow: '🎨 לעצב עכשיו',
  reset: 'מחיקת הכל',
  resetConfirm: 'בטוחים? הכל יימחק: שקלים, צוות ולידות מחדש. אין דרך לחזור.',
  resetYes: 'כן, למחוק הכל',
  cancel: 'ביטול',
  close: 'סגירה',
  bossTitle: '👑 הגעתם לפסגה!',
  bossBody: 'הבוס של הסקווישים, גל בכבודו ובעצמו, הצטרף לצוות שלכם!',
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
  frenzyBadge: (mult: number, secs: number) => `🔥 טירוף ×${mult} · ${secs} שנ׳`,
  frenzyStart: (mult: number) => `×${mult} טירוף!`,
  // The GitHub Pages build (VITE_BASE set) is retired to this screen after the
  // domain move — old home-screen installs land here instead of a dead game.
  // No emoji in the title — the screen already renders a large 🥟 right above
  // it, and in RTL the trailing emoji lands at the far left, reading as a
  // second stray dumpling rather than punctuation.
  movedTitle: 'עברנו לבית חדש!',
  movedBody: 'המשחק עבר לכתובת חדשה. ההתקדמות הישנה לא עוברת איתו, אבל מכאן ממשיכים.',
  movedCta: 'המשיכו למשחק ←',
} as const;
