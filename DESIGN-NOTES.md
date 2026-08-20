# Design Notes — the real toy & what to steal from it

Research from 2026-08-20 on the actual viral dumpling squishies and on what
keeps the closest comparable games sticky. Feeds art direction now and the v2
backlog later.

## The toy's signature traits (art + feel checklist)

1. **Slow-rise is THE trait.** The toy squishes instantly but re-inflates
   slowly — that slow puff-back is the satisfying part and what made it viral
   (1B+ TikTok views). Our spring currently boings back instantly; the
   authentic feel is fast squish → quick ~70% recovery → slow final puff over
   ~1–1.5s. Small tweak in `src/ui/dumpling.ts`.
2. **Shape:** bao bun with pleated top gathered into a knot. ✓ we have it.
3. **Presentation:** nestled in a bamboo steamer with a white paper liner —
   a defining accessory, not a background prop. ✓ we have it.
4. **Face:** kawaii eyes + small mouth + **blush cheeks** (blush is
   non-negotiable in every real design). ✓ we have it.
5. **Material for art prompts:** TPR/PU foam — matte, dough-soft, slight
   sheen, a bit translucent on some variants. "Soft and stretchy" reads.
6. **Finish variants are the collectible ladder** (real product line):
   pastel solids → glitter → tie-dye/rainbow → galaxy → glow-in-the-dark →
   metallic gold/silver (rarest). Perfect future skin-rarity tiers.
7. **Sizes:** minis (5cm) → standard → jumbo → giant (25cm). Maps to "your
   squishy grows at milestones."
8. **Sold as blind boxes** — mystery pulls with rare "chase" designs are half
   the appeal of the real toy.

## Why people are hooked (context from comparable products)

- **Capybara Clicker** (closest comp, huge with kids): beyond numbers-go-up,
  its retention levers are **skins/personalization** (validates our designer)
  and **environment unlocks** (weather/habitats — our analog: steamer and
  background upgrades).
- **Cookie Clicker psychology:** the strongest missing piece in our MVP is
  **variable rewards** — the golden-cookie moment where a random bonus
  appears briefly and players keep half-watching for it. A golden/rare
  dumpling event is the direct port.
- **Blind-box psychology (Labubu era):** surprise reveal + scarcity + series
  completion + social flex. Unboxing IS the shareable content. A "mystery
  steamer" that opens with a slow-rise reveal animation is both on-theme
  (the real toy is sold this way) and the single strongest v2 retention idea.

## v2 backlog, prioritized

1. **Slow-rise release animation** — tiny change, big authenticity win.
2. **Golden dumpling event** — random rare dumpling floats by, tap for a
   burst (x7 for 30s style). Classic variable reward, cheap to build.
3. **Mystery steamer (blind box)** — earn a sealed steamer every N minutes of
   active play / at milestones; opens with a slow-rise reveal; drops designer
   parts and body **finishes** by rarity (glitter → galaxy → glow → gold);
   collection board with silhouettes for unowned pulls; share prompt on rare
   pulls (that's the TikTok clip).
4. **Finish/skin rarity ladder in the designer** — the real product's variant
   list, gated behind pulls/milestones instead of all-free.
5. **Squishy grows** — body scales up slightly at lifetime milestones
   (mini → jumbo → giant), a visible "my dumpling is huge" flex.
6. **Environment unlocks** — nicer steamers, tablecloths, night market
   backgrounds (Capybara weather analog).

## Sources

- https://squishy-dumpling.com/blogs/dumpling-squishy-guides/what-is-a-dumpling-squishy
- https://www.abeectoys.com/blogs/the-buzz/why-is-everyone-obsessed-with-squishy-dumplings
- https://en.softonic.com/articles/addictive-psychology-clicker-games
- https://mobilefreetoplay.com/why-you-should-care-about-idle-games/
- https://capybara-clicker.co/ (feature set)
- https://www.colorado.edu/today/2025/11/17/labubu-blind-box-trend-reveals-why-surprise-and-scarcity-keep-us-shopping
- https://medium.com/publiclibrarysg/the-blind-box-boom-why-everyone-is-going-crazy-for-mystery-collectibles-6eca0298424c
