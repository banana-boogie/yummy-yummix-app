# Design Guidelines

Domain playbook for UI/UX design in YummyYummix — grounded in the brand, the audience, and the design system.

---

## Who We're Designing For

### Two Personas

**Sofía — The Busy Professional (35-45)**
- Tech-comfortable, grew up with apps
- Fairly new to Thermomix — uses it for efficiency
- Both parents work; she manages the kitchen for the family
- Wants quick answers: "What can I make with what I have?"
- Core need: **"Make dinner happen without the stress"**
- Design for her: efficiency-focused, quick access, can handle more features but still values simplicity

**Lupita — The Experienced Home Cook (55+) — THE MAJORITY**
- Has more time to explore recipes she never had time for
- Loves her Thermomix for what it makes easier — dough, cookies, desserts
- Social — hosts friends, attends cooking workshops
- **The bigger segment** of Thermomix users
- **Technologically challenged** — needs help logging into email, that level
- If something requires self-guided discovery, she abandons it
- Core need: **"Help me explore and enjoy cooking without tech frustration"**
- Design for her: large touch targets, clear labels, no hidden features, guided flows, simple navigation, large readable text, minimal cognitive load. **Voice chat (Irmixy) as the primary interface — talk, don't navigate.**

### Design Constraint: Lupita First

Lupita is the critical design constraint. She's the bigger segment, and if the app works for her, it works for everyone. Sofía will tolerate a slightly rough edge; Lupita will not.

### Design Implications

- **Simplicity over features** — Every screen should feel calm and uncluttered
- **Warmth over clinical** — The warm peach palette and rounded shapes create a kitchen-friendly feel
- **Confidence over complexity** — Clear instructions, visible Thermomix parameters, reassuring feedback
- **Personal over generic** — Handwritten font touches, personalized recommendations, dietary awareness
- **Guided over self-discovery** — If a user has to figure something out alone, we've failed the majority segment
- **Spanish-first** — Layouts must accommodate 20-30% longer strings naturally. Mexico is the primary market.
- **Accessible to all ages** — Text sizes, contrast, and touch targets must work for the 55+ segment
- **Lupita-first design** — Design for the technologically challenged majority; Sofía benefits naturally

---

## Brand Identity

### Visual Personality
- **Warm** — Peach tones, cream backgrounds, soft shadows
- **Friendly** — Rounded corners, Quicksand headings, playful but not childish
- **Approachable** — Clean hierarchy, generous whitespace, no intimidating complexity
- **Personal** — ComingSoon handwritten font for personal touches, suggestion chips that feel conversational

### Positioning

YummyYummix is a **cooking companion**, not just a recipe app. "We don't just give you recipes — Irmixy helps you actually cook them." The warm palette connects to confidence and kitchen warmth.

### What We Are Not
- Corporate or sterile (no sharp corners, no cold blues/grays as primary)
- Childish or toy-like (we're friendly, not infantile)
- Information-dense (we're a cooking companion, not a recipe database)
- Generic (every design choice should feel intentional and on-brand)
- Intimidating or complex (no tech-savvy required to navigate)
- Requiring self-guided discovery (if Lupita can't find it immediately, it doesn't exist)

---

## Photography & Imagery Style

- **Real, achievable home cooking** — not restaurant plating or Pinterest-perfect. Food should look like something you'd actually make.
- **Kitchen context:** countertops, Thermomix visible, everyday kitchenware. Not a studio set.
- **People:** reflect both personas — women across age range, Latin American. Show confidence and enjoyment.
- **Illustrations:** warm, hand-drawn style consistent with the ComingSoon font. Friendly, not clinical.

---

## Color System

Source of truth: `constants/design-tokens.js`

### Primary Palette
| Token | Hex | NativeWind Class | Usage |
|-------|-----|-----------------|-------|
| primary.lightest | `#FCF6F2` | `bg-primary-lightest` | Page backgrounds, cream base |
| primary.lighter | `#FFF3EF` | `bg-primary-lighter` | Subtle highlights |
| primary.light | `#FFE9E3` | `bg-primary-light` | Card backgrounds, hover states |
| primary.default | `#FEE5E2` | `bg-primary-default` | Brand color, headers, accents |
| primary.medium | `#FFBFB7` | `bg-primary-medium` | Action buttons, active states |
| primary.dark | `#FF9A99` | `bg-primary-dark` | Links, emphasis |
| primary.darkest | `#D83A3A` | `bg-primary-darkest` | Errors, destructive actions |

### Neutrals
| Token | Hex | Class | Usage |
|-------|-----|-------|-------|
| neutral.black | `#2D2D2D` | `text-text-default` | Primary text |
| grey.medium_dark | `#828181` | `text-text-secondary` | Secondary/muted text |
| grey.medium | `#B5B1B1` | `border-border-default` | Borders, dividers |
| grey.default | `#EDEDED` | `bg-grey-default` | Subtle backgrounds |
| grey.light | `#F8F8F8` | `bg-grey-light` | Very subtle backgrounds |
| neutral.white | `#FFFFFF` | `bg-background-default` | Default background |

### Status
| Token | Hex | Class | Usage |
|-------|-----|-------|-------|
| status.success | `#78A97A` | `bg-status-success` | Success, confirmed |
| status.warning | `#FFA000` | `bg-status-warning` | Caution, alerts |
| status.error | `#D83A3A` | `bg-status-error` | Errors, destructive |
| status.medium | `#ca8a04` | `bg-status-medium` | Medium difficulty |

---

## Typography

### Font Families
| Font | Class | Personality | Used For |
|------|-------|------------|----------|
| Quicksand | `font-heading` | Friendly, rounded, warm | Headings (h1-h3) |
| Lexend | `font-subheading` | Clean, readable, modern | Subheadings |
| Montserrat | `font-body` | Elegant, versatile | Body text, captions, links |
| ComingSoon | `font-handwritten` | Personal, playful | Personal touches, signatures |

### Text Presets (use via `<Text preset="...">`)
| Preset | Font | Weight | Size | Color |
|--------|------|--------|------|-------|
| `h1` | Quicksand | 800 (extraBold) | 36px | default |
| `h2` | Quicksand | 600 (semibold) | 30px | default |
| `h3` | Quicksand | 500 (medium) | 20px | default |
| `subheading` | Lexend | 300 (light) | 24px | default |
| `body` | Montserrat | 400 (regular) | 16px | default |
| `bodySmall` | Montserrat | 400 (regular) | 14px | default |
| `caption` | Montserrat | 400 (regular) | 14px | secondary |
| `link` | Montserrat | 400 (regular) | 16px | dark, underlined |
| `handwritten` | ComingSoon | 400 (regular) | 16px | default |

---

## Spacing & Layout

### Spacing Scale
```
xxxs: 2px    xxs: 4px    xs: 8px     sm: 12px
md: 16px     lg: 24px    xl: 32px    xxl: 48px
xxxl: 64px
```

### Border Radius
```
xs: 4px    sm: 8px    md: 12px    lg: 16px
xl: 24px   xxl: 32px  round: 9999px
```

**Convention:** Use rounded corners generously — they reinforce the friendly, approachable aesthetic. `rounded-md` (12px) is the default for cards. `rounded-lg` (16px) for larger containers. `rounded-round` for avatar circles and pill buttons.

### Layout Components
- **`PageLayout`** — Wraps screens with header/footer, handles safe areas
- **`ResponsiveLayout`** — Constrains content width with responsive max-widths
- Max widths: mobile (500), tablet (700), desktop (800), recipeDetail (900), cookingGuide (1000), recipeList (1200)

---

## Component Palette

### Available Components (from `components/common/`)
- **Text** — All text rendering with preset system
- **Button** — Primary, secondary, outline variants; small/medium/large sizes; icon support
- **SearchBar** — Search input with debounce
- **Switch** — Toggle with label
- **AlertModal** — Confirmation dialogs
- **ErrorMessage** — Error display
- **CheckboxButton** — Selectable option chips
- **Divider** — Section separators
- **GradientHeader** — Gradient header backgrounds

### Design Spec Format

When producing design specs for the frontend agent, include:

```
## Screen: [Name]

### Layout
- PageLayout with [header description]
- ResponsiveLayout maxWidth={[value]}

### Component Hierarchy
<PageLayout>
  <ResponsiveLayout>
    <View className="[classes]">
      <Text preset="h2">{i18n.t('key')}</Text>
      <Button variant="primary">{i18n.t('key')}</Button>
    </View>
  </ResponsiveLayout>
</PageLayout>

### Visual Notes
- [Specific design decisions and why]
- [Color choices and their purpose]
- [Spacing and rhythm notes]
```

---

## Interaction Patterns

- **Touch targets:** Minimum 44x44px (iOS HIG). Use `p-sm` or `p-md` padding on interactive elements.
- **Loading states:** Choose the right pattern for the wait duration and user expectation:

  | Pattern | When to Use | Example |
  |---------|------------|---------|
  | **Spinner** | Brief waits (<2s), no content to preview | Button submission, navigation |
  | **Skeleton** | Medium waits (2-5s), content shape is predictable | Loading recipe cards, chat messages |
  | **Progress tracker** | Long waits (10s+) with meaningful stages | Recipe generation (~45s) — `RecipeProgressTracker` |

  The `RecipeProgressTracker` uses a "Domino's tracker" pattern: 6 named stages with icons, a progress bar, and stage labels. This transforms a long wait into an engaging narrative ("Irmixy is selecting ingredients... calculating cooking times..."). Use this pattern when: (a) the operation takes >10s, (b) there are identifiable stages, and (c) the user benefits from knowing progress. Never show a blank screen or a static spinner for waits over 5s.

- **Empty states:** Friendly illustration + helpful message + action button
- **Error states:** Clear message + retry option. Never technical jargon.
- **Transitions:** Subtle and fast. The app should feel snappy, not animated.

---

## Accessibility

- **Color contrast:** Text on colored backgrounds must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- **Touch targets:** 44px minimum
- **Screen readers:** Meaningful labels on interactive elements
- **Don't rely on color alone** — use icons, text, or patterns alongside color to convey meaning

---

## Motion & Micro-Interactions

Subtle, purposeful animation builds confidence and makes the app feel alive — not flashy.

### Principles
- **Confidence-building feedback** — Animate success states (checkmarks, saved confirmations) so Lupita knows her action worked. Never leave her wondering.
- **Guided transitions** — Screen transitions should feel like turning a page, not teleporting. Slide, fade, or cross-dissolve between views so Lupita understands where she is.
- **High-impact moments over scattered effects** — One well-orchestrated page load with staggered reveals creates more delight than random micro-interactions everywhere.
- **Loading = progress, not emptiness** — Skeleton screens with a gentle shimmer feel faster than spinners. Use animated placeholders that match the layout.
- **Keep it snappy** — Animations should be 150-300ms. Anything longer feels sluggish; anything shorter feels jarring. Lupita should never wait for an animation to finish.

### Where to Animate
- **State transitions** — Loading to loaded, empty to populated, error to retry
- **User actions** — Button press feedback, toggle switches, checkbox selections
- **Navigation** — Screen slides, modal presentations, tab switches
- **Success moments** — Recipe saved, cooking step completed, Irmixy responding

### Where NOT to Animate
- Don't animate for decoration. Every animation must answer: "Does this help the user understand what happened?"
- No parallax, no bouncing logos, no attention-grabbing effects that compete with content
- No animations that block interaction (the user should never wait for an animation)

---

## Visual Depth & Atmosphere

Flat, solid-color screens feel generic. Subtle depth cues make the app feel warm and crafted.

### Techniques (use sparingly and on-brand)
- **Soft shadows** — `shadow-sm` on cards and elevated elements. The app should feel layered, not flat.
- **Warm gradient backgrounds** — Gentle gradients from `primary-lightest` to white add warmth without distraction. Use for headers, hero areas, and empty states.
- **Texture hints** — Subtle noise overlays or grain on hero images can add a hand-crafted, kitchen-table feel. Don't overdo it.
- **Layered cards** — Slight elevation differences between card levels create visual hierarchy without borders.
- **Rounded warmth** — Generous `rounded-lg` and `rounded-xl` on containers. Sharp corners feel corporate; rounded corners feel kitchen-friendly.

### What to Avoid
- Heavy drop shadows or 3D effects — they feel dated and corporate
- Busy patterns or textures that compete with content
- Transparent overlays that reduce text readability
- Dark themes or moody atmospheres — YummyYummix is warm and bright

---

## Spatial Composition

Layouts should feel intentional and alive, not like a stack of rectangles.

### Techniques
- **Visual rhythm** — Alternate between full-width and constrained content to create breathing room
- **Hierarchy through scale** — Hero elements should be noticeably larger, not just slightly bigger
- **Asymmetric balance** — A large image left + smaller text right feels more dynamic than centered-everything
- **Generous negative space** — White space is not wasted space. It's what makes Lupita feel calm instead of overwhelmed.
- **Grouped proximity** — Related items close together, unrelated items clearly separated. Lupita should never wonder "does this go with that?"

### Grid-Breaking (with restraint)
- Overlapping elements (e.g., an avatar slightly overlapping a card header) add personality
- Full-bleed images breaking out of content containers feel intentional
- But keep it subtle — Lupita needs predictability. One surprise per screen, maximum.

---

## Design Principles (inspired by Anthropic's frontend-design plugin)

1. **Intentional, not default** — Every design choice should be deliberate. No "it looks fine" — ask "does this serve our user?"
2. **Brand-native** — Designs should be unmistakably YummyYummix. If you swap the logo and it could be any app, it's too generic.
3. **Bold when appropriate** — Don't be afraid of the peach. The warm palette is the brand. Use it confidently.
4. **Hierarchy first** — Before choosing colors or fonts, establish what the user should see first, second, third.
5. **Kitchen context** — Users may have flour on their hands, a timer beeping, kids asking questions. Design for distraction and imperfect attention.
6. **Confidence, not confusion** — Every screen should build confidence. No jargon without explanation. Progressive disclosure. If the user is confused, we've failed.
7. **Guided, not guessed** — The majority of our users (Lupita) won't explore on their own. Guide them explicitly through every flow. If it requires self-guided discovery, forget about it.
8. **Polished, not generic** — Every screen should feel crafted, not assembled from defaults. If a screen looks like it could belong to any app, it needs more brand personality.
