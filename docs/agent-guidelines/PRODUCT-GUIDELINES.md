# Product Guidelines

Domain playbook for product thinking in YummyYummix — who we serve, what we've built, and how to think about what to build next.

---

## Mission

**YummyYummix makes Thermomix cooking effortless, inspiring, and personal.**

We help Thermomix owners discover recipes, get AI-powered cooking help, and cook step-by-step with Thermomix-specific parameters (time, temperature, speed).

---

## Target Audience

### Primary User: The Thermomix Home Cook

- **Who:** Owns a Thermomix (TM5 or TM6). Cooks regularly, often for family. Ranges from enthusiastic beginners to experienced home cooks.
- **Where:** Initially targeting English and Mexican Spanish speakers.
- **Motivation:** Wants to use their Thermomix more — it's an expensive appliance and they want to get their money's worth.

### Pain Points

| Pain Point | Impact | Our Solution |
|------------|--------|-------------|
| Finding TM-compatible recipes is scattered across blogs, Facebook groups, PDFs | High | Curated recipe discovery with TM parameters |
| Adapting regular recipes for Thermomix requires guessing settings | High | AI-generated recipes with validated TM parameters |
| Forgetting the right time/temp/speed during cooking | Medium | Step-by-step cooking guide with TM parameters per step |
| Dietary restrictions make recipe discovery harder | Medium | AI-aware of allergies, diets, dislikes |
| Cooking alone can feel isolating | Low-Medium | Irmixy AI sous chef as a conversational companion |

### Delights

- Irmixy feels like a knowledgeable friend, not a search engine
- Voice-guided cooking keeps hands free
- AI remembers preferences and adapts suggestions
- Step-by-step guide with exact Thermomix settings removes guesswork
- Bilingual support feels natural, not translated

---

## Current Feature Map

| Feature | Status | Description |
|---------|--------|-------------|
| **Recipe Discovery** | Live | Browse, search, filter published recipes |
| **Recipe Detail** | Live | Full recipe view with ingredients, steps, nutrition |
| **AI Chat (Irmixy)** | Live | Conversational sous chef for recipe help, generation |
| **Custom Recipe Generation** | Live | AI creates recipes from ingredients with TM parameters |
| **Voice Assistant** | Live | Voice-guided cooking via OpenAI Realtime API |
| **Step-by-Step Guide** | Live | Cooking mode with per-step Thermomix parameters |
| **Dietary Awareness** | Live | Allergies, diet types, ingredient dislikes |
| **User Profiles** | Live | Preferences, equipment, household size, skill level |
| **Onboarding** | Live | First-run preference collection |
| **Bilingual (EN/ES)** | Live | Full English + Mexican Spanish support |
| **Analytics** | Live | User event tracking + admin dashboard |

---

## Product Thinking Framework

### When evaluating a feature idea, ask:

1. **Who benefits?** — Does this serve our primary user (Thermomix home cook)?
2. **What problem does it solve?** — Is this a real pain point or a nice-to-have?
3. **How often would it be used?** — Daily feature vs occasional feature?
4. **What's the smallest version that delivers value?** — MVP scope.
5. **Does it reinforce our differentiation?** — Thermomix-specific, AI-powered, personal.

### Prioritization Lens

| Factor | Weight | Question |
|--------|--------|----------|
| User retention impact | High | Will this bring users back? |
| Frequency of use | High | Will users use this daily/weekly? |
| Thermomix differentiation | Medium | Does this leverage our TM-specific advantage? |
| User-requested | Medium | Have users explicitly asked for this? |
| Technical feasibility | Medium | Can we build this well with current architecture? |
| Revenue potential | Low (for now) | Will this support monetization later? |

### Build-Measure-Learn

1. **Build** the smallest version that tests the hypothesis
2. **Measure** with analytics events (see `docs/operations/ANALYTICS.md`)
3. **Learn** from usage patterns, then iterate or pivot

---

## Competitive Landscape

### Cookidoo (Vorwerk's official app)
- **Strengths:** Massive recipe library, official TM integration, guided cooking
- **Weaknesses:** Subscription-only, no AI, limited personalization, no custom recipe generation, corporate feel
- **Our advantage:** AI-powered personalization, custom recipe generation, free tier, warmer UX

### General Recipe Apps (Paprika, Mealime, etc.)
- **Strengths:** Large recipe databases, meal planning, grocery lists
- **Weaknesses:** No Thermomix awareness, no AI cooking help, no TM-specific parameters
- **Our advantage:** Thermomix-first design, AI sous chef, TM parameters per step

### AI Cooking Assistants (ChatGPT, etc.)
- **Strengths:** General AI capability, broad knowledge
- **Weaknesses:** No Thermomix expertise, no validated parameters, no persistent preferences, no cooking mode
- **Our advantage:** Purpose-built for Thermomix, validated safety parameters, persistent user context, dedicated cooking UX

---

## User Story Format

When writing user stories:

```
As a [Thermomix owner who...],
I want to [action],
so that [benefit].

Acceptance Criteria:
- [ ] [Specific, testable criterion]
- [ ] [Another criterion]

Edge Cases:
- What if [edge case]?
- What about [another scenario]?
```

---

## MVP Scoping

When helping scope an MVP:

1. **Start with the user story** — What's the core action?
2. **Identify the critical path** — What's the minimum flow to deliver the value?
3. **Cut everything else** — Nice-to-have features go in Phase 2
4. **Define "done"** — What specific criteria make this shippable?

### MVP Checklist
- [ ] Solves the core problem for the primary user
- [ ] Works on iOS (primary platform)
- [ ] Supports both EN and ES
- [ ] Handles errors gracefully
- [ ] Respects user's dietary restrictions
- [ ] Analytics events track key engagement signals
- [ ] Doesn't break existing features

---

## Feature Brief Format

When producing a feature brief:

```
## Feature: [Name]

### Problem
What problem does this solve? Who has this problem?

### Proposed Solution
What should we build? How does it work?

### User Stories
1. [Primary user story]
2. [Secondary user story]

### MVP Scope
What's in Phase 1 vs Phase 2+?

### Success Metrics
How do we know this worked? What events do we track?

### Risks & Open Questions
What could go wrong? What don't we know yet?
```
