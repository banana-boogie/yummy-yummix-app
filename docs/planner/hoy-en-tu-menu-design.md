# "Hoy en tu menú" — Design Spec

**Status:** Visual spec for the TodayHero surface and `/menu` orchestration described in `hoy-en-tu-menu-plan.md` v3.
**Audience:** Frontend agent. Read end-to-end before coding.
**Behavioral source of truth:** `hoy-en-tu-menu-plan.md`. This file makes only visual decisions.

---

## 1. Visual goals

1. **Lupita opens the app and sees one warm photo of one meal with one obvious peach button** — no scanning, no calendar, no choices. Confidence over choice.
2. **Sofía sees the week link directly under the hero, weighted as a secondary path that's clearly there but won't compete with "Cocinar esto"** — she can break out into planning mode in one tap when she wants to.
3. **The hero feels like a kitchen card sitting on a cream tablecloth, not a tile in a feed** — generous radius, soft shadow, real photo, warm Quicksand title, peach CTA. Layered, not flat.

---

## 2. Reference layouts

ASCII mockups use `█` = photo, `▓` = peach CTA fill, `░` = muted/disabled, `·` = caption text, `━` = divider. Width = mobile portrait (~360pt content area inside `px-lg`).

### 2.1 `activePlanned` — canonical hero (the one Lupita sees most)

```
┌─────────────────────────────────────────┐
│ Mi Menú                            ⚙    │  ← page header (existing chrome)
│                                         │
│ Hoy en tu menú                          │  ← preset h2, font-heading
│ martes 8 abr                            │  ← preset caption
│                                         │
│ ┌─────────────────────────────────────┐ │  ← card: rounded-xl, shadow-sm,
│ │                                     │ │     bg-neutral-white, p-0 around
│ │    █████████████████████████████    │ │     photo, p-lg below
│ │    █████████████████████████████    │ │
│ │    █████████████████████████████    │ │  ← photo: aspect 4:3, rounded-xl
│ │    █████████████████████████████    │ │     top-only (continuous w/ card)
│ │    █████████████████████████████    │ │
│ │                                     │ │
│ │ Sopa de pollo con arroz             │ │  ← preset h2, max 2 lines
│ │ Para 4 · 30 min · Thermomix         │ │  ← preset bodySmall, secondary
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │▓▓▓▓▓ Cocinar esto ▓▓▓▓▓▓▓▓▓▓▓▓▓│ │ │  ← Button primary, 72pt, fullWidth
│ │ └─────────────────────────────────┘ │ │
│ │                                     │ │
│ │           Cambiar                   │ │  ← Pressable text, centered
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│       Ver mi menú de la semana →        │  ← centered link, preset link
│                                         │
└─────────────────────────────────────────┘
```

### 2.2 `draftPlanned` — plan generated, not yet approved

Same shape as 2.1 but with the primary CTA replaced by a hint block. The card is intentionally still warm and complete — we are not communicating "broken," we are communicating "almost ready."

```
│ ┌─────────────────────────────────────┐ │
│ │    [photo, full saturation]         │ │
│ │ Sopa de pollo con arroz             │ │
│ │ Para 4 · 30 min · Thermomix         │ │
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │  ← bg-primary-light, rounded-md,
│ │ │ ⓘ Aprueba tu menú para empezar  │ │ │     p-md, icon = info-circle in
│ │ │   a cocinar                     │ │ │     primary-darkest at 18px
│ │ │   Ver mi menú →                 │ │ │  ← inline link, preset link
│ │ └─────────────────────────────────┘ │ │
│ │                                     │ │
│ │           Cambiar                   │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
```

The hint block replaces (does not sit alongside) the primary CTA. This preserves the rhythm of the canonical hero — there is always one block in that vertical slot — and avoids the user staring at a disabled grey button. The inline "Ver mi menú →" link inside the hint is the conversion path; the standalone week link below the card stays as a secondary affordance.

### 2.3 `cooked` and `noUncookedToday` — closure state

```
│ ┌─────────────────────────────────────┐ │
│ │ ┌──┐                                │ │
│ │ │██│ ← photo, 60% saturation,       │ │  ← see §6 for dim treatment
│ │ │██│   white overlay 35%            │ │
│ │ │██│                                │ │
│ │ │██│  ┌──┐                          │ │
│ │ └──┘  │ ✓│  ← checkmark badge        │ │
│ │       └──┘     bg-status-success,    │ │
│ │              28pt circle, white ✓    │ │
│ │                                     │ │
│ │ Cocinada hoy                        │ │  ← preset bodySmall,
│ │ Sopa de pollo con arroz             │ │     status-success, uppercase letter-tracked
│ │                                     │ │  ← title still h2 default color
│ │     Ver receta otra vez →           │ │  ← preset link, centered
│ │                                     │ │
│ │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │  ← divider only when
│ │                                     │ │     noUncookedToday
│ │      ¡Buen trabajo hoy! 🌿          │ │  ← preset handwritten,
│ │                                     │ │     centered, primary-darkest
│ └─────────────────────────────────────┘ │
```

`cooked` and `noUncookedToday` share the same hero shape. The "¡Buen trabajo hoy!" footer is the only addition for `noUncookedToday`, separated by a 1px `border-grey-default` divider with `pt-md mt-md`. Use `font-handwritten` here — it is the one place in the spec where the brand's personal voice surfaces. The leaf glyph is optional; if the frontend agent can't load an emoji that renders consistently across iOS/Android/web, drop it. No animation on entry.

### 2.4 `skipped` — slot was skipped

```
│ ┌─────────────────────────────────────┐ │
│ │    [photo, opacity 0.5, no badge]   │ │
│ │                                     │ │
│ │ Sopa de pollo con arroz             │ │  ← preset h2, opacity 0.6
│ │ Para 4 · 30 min · Thermomix         │ │
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Esta comida se saltó.           │ │ │  ← bg-grey-light, rounded-md,
│ │ │ Elige otra opción.              │ │ │     p-md, preset bodySmall,
│ │ └─────────────────────────────────┘ │ │     text-text-secondary
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │░░░░░░░  Cambiar  ░░░░░░░░░░░░░░░│ │ │  ← Button **outline** variant,
│ │ └─────────────────────────────────┘ │ │     fullWidth, 72pt — promoted
│ │                                     │ │     because it's the only action
│ └─────────────────────────────────────┘ │
```

Tone is matter-of-fact, not scolding. The card visually recedes (opacity, muted backgrounds) but the action is more prominent (Cambiar promoted from text-button to a full outline button) — Lupita gets a clear way out. Note: copy "Esta comida se saltó. Elige otra opción." is **new** and must be added to the planner i18n table — flagged in §8 open questions.

### 2.5 `noSlotToday` — active plan but nothing today / stale plan

The hero card shape is replaced. This is the only variant where we don't render a card.

```
│ Mi Menú                            ⚙    │
│                                         │
│ Hoy en tu menú                          │
│ martes 8 abr                            │
│                                         │
│         ┌────────────────────┐          │  ← Irmixy face avatar, 96pt,
│         │   [Irmixy face]    │          │     reusing existing asset
│         └────────────────────┘          │     (irmixy-face.png) per
│                                         │     MealPlanEmptyState pattern
│   Hoy no tienes nada planeado           │  ← preset h3, centered
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │▓▓▓▓ Ver mi menú de la semana ▓▓▓▓▓▓│ │  ← Button primary, 72pt — week
│ └─────────────────────────────────────┘ │     link is promoted to primary
│                                         │     CTA in this variant only
└─────────────────────────────────────────┘
```

In this variant the secondary "Ver mi menú de la semana →" link below the hero is **omitted** — the primary CTA already does that job. Avoids two competing affordances pointing to the same place.

### 2.6 Loading skeleton

```
│ Mi Menú                            ⚙    │
│ ┌────────────┐                          │  ← bar 60% width, h-md, rounded-sm
│ │░░░░░░░░░░░░│                             bg-grey-light
│ └────────────┘
│ ┌────────┐                              │  ← bar 30% width, h-sm, same fill
│ │░░░░░░░░│
│ └────────┘
│
│ ┌─────────────────────────────────────┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │  ← photo block, aspect 4:3,
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │     bg-grey-light, rounded-xl
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │     top-only
│ │                                     │ │
│ │ ┌──────────────────────┐            │ │  ← title bar, 70%, h-md
│ │ │░░░░░░░░░░░░░░░░░░░░░░│            │ │
│ │ └──────────────────────┘            │ │
│ │ ┌────────────────┐                  │ │  ← meta bar, 50%, h-sm
│ │ │░░░░░░░░░░░░░░░░│                  │ │
│ │ └────────────────┘                  │ │
│ │ ┌─────────────────────────────────┐ │ │  ← ghost CTA, 72pt, rounded-xl
│ │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │ │     bg-grey-light
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
```

### 2.7 Error variant

```
│ Mi Menú                            ⚙    │
│                                         │
│ ┌─────────────────────────────────────┐ │  ← bg-primary-lighter, rounded-lg,
│ │ ⚠ No pude cargar tu menú             │ │     p-lg, no shadow.
│ │                                     │ │     icon = alert-circle 24pt
│ │ Revisa tu conexión e intenta otra   │ │     in status-error
│ │ vez.                                │ │  ← preset bodySmall, secondary
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │░░░░░░░  Reintentar  ░░░░░░░░░░░░│ │ │  ← Button **outline** variant,
│ │ └─────────────────────────────────┘ │ │     fullWidth, default 56pt
│ └─────────────────────────────────────┘ │     (not 72 — error is not
│                                         │      the primary path)
```

The "Revisa tu conexión..." secondary line is **new copy** and must be added to i18n (`planner.today.loadErrorHint`) — flagged in §8.

### 2.8 Page chrome (header + back-to-today affordance)

The Mi Menú header is unchanged in `today` mode — same layout as `app/(tabs)/menu/index.tsx` today (Mi Menú heading + settings gear). In `week` mode, the header swaps to:

```
│ ← Volver a hoy                     ⚙    │  ← Pressable left side: chevron-back
│                                         │     20pt + "Volver a hoy" preset body,
│ Mi Menú de la semana                    │     primary-darkest tint. Settings
│                                         │     gear stays right.
```

Two-line header in week mode, single-line in today mode. The "Volver a hoy" affordance is icon + text, not icon-only — Lupita needs the words. Tap target is the whole left half of the header row (44pt min height enforced by `hitSlop`).

---

## 3. Token usage table

Every visual element + the design token that drives it. New tokens are flagged with **NEW**.

### Hero card container

| Element | Token | Value |
|---|---|---|
| Background | `bg-neutral-white` | `#FFFFFF` |
| Border radius | `rounded-xl` | 24px |
| Shadow | `shadow-sm` (RN-style: offset 0/2, opacity 0.06, radius 8, elevation 2) | — |
| Outer page padding (card horizontal) | `px-lg` | 24px |
| Card inner vertical padding (below photo) | `p-lg` | 24px |
| Vertical gap between header and card | `mt-lg` | 24px |
| Vertical gap between card and week link | `mt-xl` | 32px |

### Photo

| Element | Token | Value |
|---|---|---|
| Aspect ratio | — | 4:3 (`aspectRatio: 4/3`) |
| Border radius | `rounded-xl` top-only (`borderTopLeftRadius`/`borderTopRightRadius` = 24) | 24px top, 0 bottom |
| Placeholder bg | `bg-grey-light` | `#F8F8F8` |
| Cooked-state white overlay opacity | — | **0.35** (open Q in §8) |
| Cooked-state photo saturation | — | 0.6 (via `expo-image` `tintColor`/CSS filter) |
| Skipped-state opacity | — | 0.5 |
| Checkmark badge bg | `bg-status-success` | `#78A97A` |
| Checkmark badge size | — | 28pt circle, positioned bottom-right of photo with `bottom: 12, right: 12` |

### Typography

| Element | Preset | Why |
|---|---|---|
| "Hoy en tu menú" header heading | `h2` | Page-level greeting. h1 is reserved for the existing "Mi Menú" tab title. |
| Date subtitle "martes 8 abr" | `caption` | Secondary, dated context. Quicksand h2 above + Montserrat caption below = warmth + legibility. |
| Recipe title (hero) | `h2` | Visually equal in weight to the page heading — the recipe IS the screen. |
| Meta line "Para 4 · 30 min · Thermomix" | `bodySmall` with `text-text-secondary` | Three pieces of info, comma-style separator (`·`). Not `caption` — slightly heavier weight reads better at this size on 60+ devices. |
| "Cocinar esto" CTA label | inherits `Button` preset | (Button uses subheading-style internal preset) |
| "Cambiar" secondary action | `body` (16px) with `text-primary-dark` | Using `body` not `link` — no underline, treated as button-text not link. Color = `primary-dark` (#FF9A99) for emphasis without underline noise. |
| "Ver mi menú de la semana →" page-level link | `link` | This IS a link — it changes views. Underlined per `link` preset. Centered. |
| "Cocinada hoy" status label | `bodySmall` with `text-status-success`, `uppercase`, `letterSpacing: 0.5` | Small but emphatic, reads as a status badge in text form. |
| "¡Buen trabajo hoy!" footer | `handwritten` with `color: COLORS.primary.darkest` | The one personal-voice moment. Brand-native. |
| `noSlotToday` heading "Hoy no tienes nada planeado" | `h3` | Lighter than h2 — the message is calm, not alarming. |
| Error heading "No pude cargar tu menú" | `body` with `font-semibold` | (See §8 — current `body` preset is `regular`. Use inline `style={{ fontWeight: '600' }}` if no preset exists.) |
| Skipped notice / draft hint copy | `bodySmall` | Compact, supportive. |

### Buttons

| Variant | Component | Notes |
|---|---|---|
| Primary "Cocinar esto" | `Button variant="primary" size="large" fullWidth style={{ minHeight: 72 }}` | Identical pattern to `MealPlanApprovalCTA`. Reuse that height contract. |
| Secondary "Cambiar" (active/draft) | `Pressable` wrapping `Text preset="body"` with `text-primary-dark`, `py-md px-lg`, `minHeight: 44`, centered | Text-button style, not Button component — Button outline would compete visually with the primary peach. |
| Promoted "Cambiar" (skipped variant) | `Button variant="outline" size="large" fullWidth style={{ minHeight: 72 }}` | When it's the only action, it earns Button treatment. |
| Primary "Ver mi menú de la semana" (noSlotToday) | `Button variant="primary" size="large" fullWidth style={{ minHeight: 72 }}` | Same contract as Cocinar esto. |
| Outline "Reintentar" (error) | `Button variant="outline" size="medium" fullWidth` | Default 56pt is fine — error is a recovery affordance, not the main path. |
| "Volver a hoy" header (week mode) | `Pressable` with chevron + Text preset body, primary-darkest tint | — |

### Spacing

| Where | Token |
|---|---|
| Page horizontal padding | `px-lg` (24px) |
| Hero card → photo seam | 0 (photo rests flush at top of card) |
| Photo → recipe title | `mt-md` (16px) inside `p-lg` content area |
| Title → meta line | `mt-xxs` (4px) |
| Meta line → primary CTA | `mt-lg` (24px) |
| Primary CTA → secondary "Cambiar" | `mt-sm` (12px) |
| Card bottom → week link | `mt-xl` (32px) |
| Week link → screen edge bottom safe area | `mb-xl` (32px) |

### Pull-to-refresh

| Property | Token | Value |
|---|---|---|
| iOS `tintColor` | `COLORS.primary.darkest` | `#D83A3A` |
| Android `colors={[...]}` | `[COLORS.primary.darkest]` | `[#D83A3A]` |
| Android `progressBackgroundColor` | `COLORS.primary.lightest` | `#FCF6F2` |

(Same red the existing `ActivityIndicator` uses in `menu/index.tsx`.)

### NEW tokens proposed

None strictly required. The existing palette and spacing scale cover everything.

**One nice-to-have, not blocking:** A `shadow.card` token spec (offset 0/2, opacity 0.06, radius 8, elevation 2). The codebase doesn't currently centralize shadow style. The frontend agent should inline the values for this PR; a follow-up token migration is out of scope.

---

## 4. Typography hierarchy (rationale)

Lupita's eye should land in this order, every time:

1. **"Hoy en tu menú" + date** — orientation. h2 + caption. Reads as a friendly title.
2. **Hero photo** — emotional anchor. No text decoration on or over the photo (no overlay text — keep all copy below the image so it scales with system font size without crashing into the photo).
3. **Recipe title** — h2 again, intentionally matching the page heading. The recipe is co-equal with the page itself.
4. **Meta line** — bodySmall, secondary color, single line, ` · ` separators. Order is fixed: `Para N · M min · Tool` (matches the strategy mockup; matches Spanish reading rhythm).
5. **Primary CTA** — peach, 72pt, label in subheading-weight Button text. Visually loudest element on the screen by design.
6. **Cambiar** — quiet, no underline, single line, primary-dark color. Reads as "there's another option here" without pulling focus.
7. **Week link** — outside the card, centered, underlined link preset. Visually a different "level" — it's a navigation affordance, not a card action.
8. **Footer ("¡Buen trabajo hoy!")** — handwritten, only in `noUncookedToday`. The personality moment.

We deliberately **do not** use `subheading` (Lexend light 24px) anywhere in the hero — it competes with h2 and reads as "second title" rather than "supporting copy." Lexend stays for the existing `MealCard` titles in week view, where there's a different visual rhythm.

---

## 5. Spacing & layout

### Hero card vertical rhythm (top to bottom inside the card)

```
[photo, aspect 4:3, no inner padding, flush to card edges]
│
├── 24px (p-lg top of content block)
│
[Recipe title — h2, max 2 lines, numberOfLines=2]
│
├── 4px (xxs)
│
[Meta line — bodySmall secondary, 1 line, numberOfLines=1, ellipsize=tail]
│
├── 24px (lg)
│
[Primary CTA — 72pt height, fullWidth]
│
├── 12px (sm)
│
[Cambiar — Pressable, 44pt min height, centered text]
│
├── 24px (p-lg bottom of content block)
```

### Hit targets

| Element | Min size |
|---|---|
| Cocinar esto | 72pt height × full content width |
| Cambiar | 44pt height × full card width (Pressable spans the row, text centered) |
| Ver mi menú de la semana → | 44pt height × wider than text by `px-lg` on each side |
| Volver a hoy header pressable | 44pt height × ~50% of header width |
| Settings gear | 44pt with `hitSlop={12}` (existing) |
| Retry button | default Button medium (56pt) |

### Screen padding

- Mobile: `px-lg` (24px) on all four sides of the page-level scroll content.
- The hero card itself has no horizontal margin beyond the screen padding — the photo runs to the card edge, the card runs to the screen padding edge.

---

## 6. States & transitions

| Variant | Visual diff from canonical |
|---|---|
| `activePlanned` | baseline |
| `draftPlanned` | swap primary CTA → primary-light hint block; keep Cambiar |
| `cooked` | photo: 35% white overlay + 0.6 saturation + 28pt success-green checkmark badge bottom-right of photo. Replace primary CTA + Cambiar with single centered text-link "Ver receta otra vez →". Add "Cocinada hoy" eyebrow above title. |
| `noUncookedToday` | same as cooked + 1px grey divider + handwritten footer "¡Buen trabajo hoy!" |
| `skipped` | photo: 0.5 opacity, no badge. Title + meta also 0.6 opacity. Replace primary CTA with grey-light "saltó" notice + outline-Button Cambiar. |
| `noSlotToday` | no card. Replace with Irmixy face avatar (96pt) + h3 message + primary 72pt week-link button. |

### Transitions / motion

- **No cross-variant transition animations.** Per plan §5.4, when the selector returns a different slot the hero just re-renders. We honor that.
- **Skeleton pulse:** opacity loop between 0.5 and 1.0, duration 1200ms, easing `ease-in-out`, infinite. Implement with `Animated.loop` on a single shared `opacity` value applied to all skeleton blocks. Respect `useReducedMotion` — if reduced, lock opacity at 0.7 (no animation, no flicker).
- **Photo entry fade:** `expo-image` already cross-fades on load (its default). Keep default.
- **Pull-to-refresh:** native `RefreshControl`. No custom motion.
- **CTA press feedback:** rely on `Button` component's default press state. Do not add scale or shadow animation on press.
- **Mode toggle (today ↔ week):** no slide/fade — `mode` is local state in `MenuScreen`, swap is instant. Plan §5.4 explicitly accepts this.

The skeleton's gentle pulse is the only motion in this surface. That's intentional — the kitchen-card aesthetic should feel still and ready, not busy.

---

## 7. Accessibility specifics

### Large text scaling (Dynamic Type / Android font scale)

- Verify hero layout at **1.5×** scale (per plan §7a). At 1.5×:
  - Recipe title (h2 = 30px → 45px): wraps to 3 lines max — set `numberOfLines={3}` instead of 2 when `PixelRatio.getFontScale() >= 1.3`. Frontend agent: gate via `useWindowDimensions` + `PixelRatio.getFontScale()` if RN exposes it; otherwise accept 2-line ellipsis at 1.5× as a known limitation.
  - Meta line should **stay 1 line with ellipsize tail** even at 1.5× — losing "Thermomix" off the end is acceptable; wrapping to two lines is not.
  - "Cocinar esto" CTA: 72pt height is **fixed** (hit-target safety). Inner text scales; if text exceeds button width at 1.5×, allow `numberOfLines={1}` with `adjustsFontSizeToFit` (RN supports this).
- Card itself does not have a max height. The page is a `ScrollView`, so vertical overflow at large text scales is fine.

### Color contrast verification

Required pairings to verify on-device with the WCAG contrast tool (don't trust eyeballs):

| Foreground | Background | Required ratio | Notes |
|---|---|---|---|
| `text-text-secondary` (#828181) on `bg-neutral-white` (#FFF) | white | 4.5:1 (normal text) | **Likely fails** — #828181 on white = ~3.3:1. Used for the meta line. **Mitigation:** use `text-text-default` (#2D2D2D) for the meta line instead, accepting that the visual hierarchy from title is carried by font weight + size, not color. ⚠ Open question §8. |
| `text-primary-dark` (#FF9A99) on `bg-neutral-white` | white | 4.5:1 | **Likely fails** — light peach on white ≈ 2.7:1. Used for "Cambiar" label. **Mitigation:** use `text-primary-darkest` (#D83A3A) instead — visually warmer, still distinct from body text, ~5.6:1 against white. ⚠ Open question §8. |
| `text-status-success` (#78A97A) on `bg-neutral-white` | white | 4.5:1 | ~3.5:1 — borderline fail at 14px. **Mitigation:** boost to font-semibold (`fontWeight: '600'`) which qualifies as "large text" if size ≥ 14px and bold (3:1 threshold). The "Cocinada hoy" eyebrow already calls for emphasis — works in our favor. |
| `text-text-default` on `bg-primary-lighter` (#FFF3EF) | warm cream | 4.5:1 | ✓ Should pass (#2D2D2D on #FFF3EF ≈ 14.8:1). Used in the draft-state hint block. |
| `text-text-default` on `bg-primary-light` (#FFE9E3) | peach card | 4.5:1 | ✓ Should pass (#2D2D2D on #FFE9E3 ≈ 13.5:1). |
| White on `bg-primary-medium` (#FFBFB7) | peach button | 4.5:1 | **Almost certainly fails** — but the existing `Button variant="primary"` already handles this; we inherit whatever it does. Out of scope to fix here. |

### Screen reader

- Photo `accessibilityLabel`: recipe title only — do not announce as "image".
- Order on `cooked` variant: "Cocinada hoy" → recipe title → "Ver receta otra vez" link. Implement via `accessibilityLabel` composition or layered ordering of accessible nodes.
- `noUncookedToday` footer: announced last, after the link. Use `accessibilityLabel="¡Buen trabajo hoy!"` — drop the leaf glyph for screen readers.
- Week link: `accessibilityRole="button"`, `accessibilityLabel="Ver mi menú de la semana"` (drop the `→` per plan §7a).
- "Volver a hoy": `accessibilityRole="button"`, label = "Volver a hoy".

### Focus management

- On today→week toggle: shift focus to the week-mode header (per plan §7a).
- On week→today toggle: shift focus to the hero photo (give photo a focusable accessible wrapper).

---

## 8. Open visual questions

Concrete decisions for product/design review before the frontend agent commits:

1. **Cooked photo dim treatment: 35% white overlay vs 60% saturation drop?** Recommend **both layered** (overlay 0.35 + tint towards desaturated), but if pick-one: 35% white overlay is more legible against the green checkmark badge. Mocked at 0.35; verify on a real recipe photo on device.

2. **Meta line color — `text-text-secondary` (visual hierarchy intent) vs `text-text-default` (contrast safety)?** Spec currently calls for secondary; contrast likely fails. Recommend **switch to `text-text-default`** and rely on font size (14px) + position alone for hierarchy. Alternative: keep secondary and bump size to 16px (qualifying as "large text" at lower contrast threshold) — but loses the visual "subordination" we want.

3. **"Cambiar" color — `text-primary-dark` (warm, on-brand) vs `text-primary-darkest` (legible)?** Recommend **`text-primary-darkest`**. We lose a tiny bit of softness; we gain Lupita actually being able to read it.

4. **Hint copy in `draftPlanned` — does the inline "Ver mi menú →" link belong inside the hint block or below it?** Spec puts it inside (one tight unit). Alternative: keep the hint as plain text and lean on the standalone "Ver mi menú de la semana →" link below the card. **Recommend inside** — Lupita reads the hint and her eye lands on the action immediately, no gaze travel.

5. **`skipped` variant copy "Esta comida se saltó. Elige otra opción." — is this the right tone in MX Spanish?** Plan does not specify copy for this variant. We're proposing a string; product should validate. **Open for product review.** If product prefers a different phrasing, swap the string; visual treatment unchanged.

6. **Error-state secondary line "Revisa tu conexión e intenta otra vez." — needed at all?** Plan §7 specifies only `loadError` ("No pude cargar tu menú") and `retry` ("Reintentar"). Adding a secondary explainer is a design proposal. **Recommend adding** — Lupita needs a hint about *why* it failed and what she can do. Open for product review on copy.

7. **`noSlotToday` Irmixy face — reuse or restraint?** Spec calls for the existing `irmixy-face.png`. Alternative: leaner empty-state with no avatar (less visual noise). **Recommend keep avatar** — the empty state otherwise feels like an error; Irmixy's presence keeps it warm.

8. **Wide-screen photo: cap or grow?** Plan caps `maxWidth: 600`. At 600px wide with 4:3 aspect, photo = 450pt tall. Recommend **stay capped at 600** — a 450pt-tall hero photo on iPad is plenty heroic; growing further makes the title and CTA feel undersized. Frontend: wrap the page content in `ResponsiveLayout maxWidth={600}` (existing component).

9. **Shadow style on the hero card — `shadow-sm` (current convention) or stronger?** The hero is the most important card on the screen. A slightly heavier shadow (offset 0/4, opacity 0.08, radius 12) would lift it. **Recommend lift it slightly** — but not so much it feels modal. If the codebase has no precedent for a "hero shadow", use `shadow-sm` for v1 and revisit after concierge feedback.

10. **Should `noUncookedToday` retain the photo at all?** Current spec says yes (dimmed, with checkmark). Alternative: replace photo block with a confirmation illustration. **Recommend keep photo** — Lupita just made it; seeing the result of her work is the reward moment. This is the only state where the photo earns a "trophy" character.

---

## 9. New i18n strings introduced by this spec

Beyond the strings in plan §7, this spec adds:

| Key | ES | EN |
|---|---|---|
| `planner.today.skippedNotice` | "Esta comida se saltó. Elige otra opción." | "This meal was skipped. Pick another option." |
| `planner.today.loadErrorHint` | "Revisa tu conexión e intenta otra vez." | "Check your connection and try again." |

Both flagged as open questions in §8. Frontend agent: do not invent additional strings beyond these two and the plan's table.

---

## 10. Reuse map (so the frontend agent doesn't reinvent)

| Need | Reuse |
|---|---|
| Primary 72pt CTA | `Button variant="primary" size="large" fullWidth style={{ minHeight: 72 }}` — identical contract to `MealPlanApprovalCTA` |
| Outline 72pt CTA (skipped state) | `Button variant="outline" size="large" fullWidth style={{ minHeight: 72 }}` |
| Card-style container with shadow | manual: `View className="bg-neutral-white rounded-xl shadow-sm overflow-hidden"` — there is no `Card` primitive in `components/common`; matches `MealCard` pattern |
| Recipe photo | `expo-image` `Image`, `contentFit="cover"`, `aspectRatio: 4/3` |
| Settings gear in header | existing block in `app/(tabs)/menu/index.tsx` (keep) |
| Empty-state Irmixy avatar | `require('@/assets/images/irmixy-avatar/irmixy-face.png')` — same asset `MealPlanEmptyState` uses |
| Page wrapper | `PageLayout` (existing) |
| Wide-screen cap | `ResponsiveLayout maxWidth={600}` (existing) |
| Loading spinner (orchestrator-level, not skeleton) | `ActivityIndicator color={COLORS.primary.darkest}` (existing pattern) |
| RefreshControl | RN `RefreshControl`, gated `Platform.OS !== 'web'` per plan §5.5 |

---

## 11. Sanity checklist for the frontend agent

Before opening the PR, confirm:

- [ ] All 6 hero variants render with realistic data (run through a mock script).
- [ ] Skeleton respects `useReducedMotion` (lock opacity, no animation).
- [ ] At system font scale 1.5×, no text is clipped, no CTA is cropped.
- [ ] At iPad width (>700pt), content is centered, capped at 600pt, photo doesn't grow past that.
- [ ] Pull-to-refresh works on iOS + Android, hidden on web.
- [ ] Retry button on error appears at default 56pt, not 72pt.
- [ ] "Volver a hoy" header in week mode is a single tap target ≥44pt.
- [ ] Color contrast verified for the four ⚠ pairs in §7 (use a contrast tool, not eyes).
- [ ] No new fonts, no new color hex values outside `design-tokens.js` snuck in.
- [ ] Screen-reader order matches §7 on all variants.
