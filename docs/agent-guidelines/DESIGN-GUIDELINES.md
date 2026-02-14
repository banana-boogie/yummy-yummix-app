# Design Guidelines

Domain playbook for UI/UX design in YummyYummix — grounded in the brand, the audience, and the design system.

---

## Who We're Designing For

### Target Audience

**Thermomix owners** — home cooks who love their Thermomix and want to get more out of it.

- **Primary persona:** A home cook (often cooking for family) who owns a Thermomix and wants easy, reliable recipes with Thermomix-specific settings (time, temperature, speed)
- **Pain points:** Finding TM-compatible recipes is hard. Adapting regular recipes for Thermomix is tedious. Remembering the right settings is stressful when cooking.
- **Delights:** Step-by-step guides with exact Thermomix parameters. An AI that knows their dietary needs and preferences. Voice-guided cooking so they can keep their hands free.
- **Emotional need:** The app should feel like a **helpful friend in the kitchen** — warm, approachable, encouraging. Not a corporate tool. Not overwhelming.

### Design Implications

- **Simplicity over features** — Every screen should feel calm and uncluttered
- **Warmth over clinical** — The warm peach palette and rounded shapes create a kitchen-friendly feel
- **Confidence over complexity** — Clear instructions, visible Thermomix parameters, reassuring feedback
- **Personal over generic** — Handwritten font touches, personalized recommendations, dietary awareness
- **Bilingual** — English and Mexican Spanish. Design must accommodate both (Spanish strings are often longer)

---

## Brand Identity

### Visual Personality
- **Warm** — Peach tones, cream backgrounds, soft shadows
- **Friendly** — Rounded corners, Quicksand headings, playful but not childish
- **Approachable** — Clean hierarchy, generous whitespace, no intimidating complexity
- **Personal** — ComingSoon handwritten font for personal touches, suggestion chips that feel conversational

### What We Are Not
- Corporate or sterile (no sharp corners, no cold blues/grays as primary)
- Childish or toy-like (we're friendly, not infantile)
- Information-dense (we're a cooking companion, not a recipe database)
- Generic (every design choice should feel intentional and on-brand)

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
- **Loading states:** Show skeleton or spinner, never blank screens
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

## Design Principles (inspired by Anthropic's frontend-design plugin)

1. **Intentional, not default** — Every design choice should be deliberate. No "it looks fine" — ask "does this serve our user?"
2. **Brand-native** — Designs should be unmistakably YummyYummix. If you swap the logo and it could be any app, it's too generic.
3. **Bold when appropriate** — Don't be afraid of the peach. The warm palette is the brand. Use it confidently.
4. **Hierarchy first** — Before choosing colors or fonts, establish what the user should see first, second, third.
5. **Kitchen context** — Users may have flour on their hands, a timer beeping, kids asking questions. Design for distraction and imperfect attention.
