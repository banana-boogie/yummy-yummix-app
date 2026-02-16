# Product Guidelines

Domain playbook for product thinking in YummyYummix — who we serve, what we've built, and how to think about what to build next.

---

## Mission

**Make cooking better for every Thermomix owner.**

- For people who don't have time or energy — make it feel **easy**
- For people who love cooking — help them **explore creativity** and find new recipes
- For people intimidated by their Thermomix — build **confidence** and unlock full potential

**Positioning:** "Make cooking easy and stress-free, with a dash of fun."

The vehicle is **Irmixy** — an AI cooking companion that delivers this mission. Everything we build supports the AI companion. We don't just give you recipes — Irmixy helps you actually cook them.

---

## Target Audience

### Sofía — The Busy Professional (35-45)

- Grew up with technology, comfortable with apps
- Fairly new to Thermomix — sees it as a smart investment for efficiency
- Both parents work; she's in charge of the kitchen
- Demands of feeding a family, may have young kids or babies
- Wants to ease the kitchen load, not explore gourmet cooking (yet)
- Will try new things when she has time, but time is scarce
- Less intimidated by the machine, more frustrated by the time crunch
- Core need: **"Make dinner happen without the stress"**

### Lupita — The Experienced Home Cook (55+) — THE MAJORITY

- Retired or semi-retired, grew up cooking her whole life
- Has more time now to explore recipes she never had time for
- Loves the Thermomix for what it makes easier — dough, cookies, desserts
- Social — hosts friends, attends cooking workshops
- **The majority segment** of Thermomix users (the bigger group)
- **Technologically challenged** — needs help logging into email, that level
- If something requires self-guided discovery or figuring things out alone, she abandons it
- Core need: **"Help me explore and enjoy cooking without tech frustration"**

### Shared Traits

- Women, Mexico-based
- Looking for healthy, homemade recipes for day-to-day life
- Some love desserts specifically
- Everyone wants cooking to feel easy and stress-free
- Want Thermomix-specific parameters (time, temperature, speed)

### Design Constraint: Lupita First

Lupita is the critical design constraint. She's the bigger segment, and if the app works for her, it works for everyone. Sofía will tolerate a slightly rough edge; Lupita will not. This means:
- Onboarding must be guided, not self-service
- UI must be large, clear, and obvious
- No "figure it out yourself" flows
- Irmixy (voice) becomes even more important — she can talk to it instead of navigating menus

### Per-Persona Feature Mapping

| Feature | For Sofía | For Lupita |
|---------|-----------|------------|
| AI Chat (Irmixy) | Quick recipe suggestions from ingredients on hand | Patient companion that guides her through new recipes |
| Voice Assistant | Hands-free cooking while multitasking | **Primary interface** — talk, don't navigate |
| Recipe Discovery | Fast filters: 30-min meals, kid-friendly | Explore by category, desserts, traditional recipes |
| Step-by-Step Guide | Efficient — just show the Thermomix settings | Detailed, reassuring, with clear parameters |
| Onboarding | Quick setup, she'll figure it out | Fully guided, every step explained |
| Custom Recipes | "What can I make with what I have?" | "I want to try something new for my workshop" |

### Geographic & Cultural Focus

- **Mexico-first** — Spanish is the primary language
- Latin American market dynamics (WhatsApp as communication channel)
- Content and recipes should reflect Mexican and Latin American cuisine

### Pain Points

| Pain Point | Impact | Our Solution |
|------------|--------|-------------|
| Finding TM-compatible recipes is scattered across blogs, Facebook groups, PDFs | High | Curated recipe discovery with TM parameters |
| Adapting regular recipes for Thermomix requires guessing settings | High | AI-generated recipes with validated TM parameters |
| Forgetting the right time/temp/speed during cooking | Medium | Step-by-step cooking guide with TM parameters per step |
| Dietary restrictions make recipe discovery harder | Medium | AI-aware of allergies, diets, dislikes |
| Cooking alone can feel isolating | Low-Medium | Irmixy AI companion as a conversational friend |
| Technology is intimidating for the majority segment | High | Voice interface, guided flows, zero self-discovery |

### Delights

- Irmixy feels like a knowledgeable friend, not a search engine
- Voice-guided cooking keeps hands free (essential for Lupita)
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

1. **Who benefits?** — Does this serve Sofía, Lupita, or both?
2. **What problem does it solve?** — Is this a real pain point or a nice-to-have?
3. **How often would it be used?** — Daily feature vs occasional feature?
4. **What's the smallest version that delivers value?** — MVP scope.
5. **Does it reinforce our differentiation?** — Thermomix-specific, AI-powered, personal.
6. **Does it work for Lupita?** — If it requires self-guided discovery, forget about it.

### Prioritization Lens

| Factor | Weight | Question |
|--------|--------|----------|
| User retention impact | High | Will this bring users back? |
| Frequency of use | High | Will users use this daily/weekly? |
| Thermomix differentiation | Medium | Does this leverage our TM-specific advantage? |
| User-requested | Medium | Have users explicitly asked for this? |
| Technical feasibility | Medium | Can we build this well with current architecture? |
| Revenue potential | Medium | Will this support conversion and retention? |

### ICE Scoring

For rapid prioritization, use **ICE scoring**: Impact x Confidence x Ease (each 1-10).

| Score | Action |
|-------|--------|
| 200+ | Do this week |
| 100-199 | Next sprint |
| < 100 | Backlog |

### Build-Measure-Learn

1. **Build** the smallest version that tests the hypothesis
2. **Measure** with analytics events (see `docs/operations/ANALYTICS.md`)
3. **Learn** from usage patterns, then iterate or pivot

---

## What Makes Us Different

Irmixy is an AI cooking companion built specifically for Thermomix owners. Unlike Cookidoo (subscription recipe library, no AI) or general recipe apps (no Thermomix awareness), we combine:

- **AI-powered personalization** — Irmixy knows your dietary needs, preferences, and skill level
- **Thermomix-first** — Every recipe has validated TM parameters (time, temperature, speed)
- **Voice-guided cooking** — Hands-free cooking help, especially valuable for users who prefer talking over navigating

**One-line positioning:** "We don't just give you recipes — Irmixy helps you actually cook them."

---

## Monetization Strategy

- **Paid subscription** model — price target ~$5 USD/month (to be validated in beta)
- Payments via **Stripe on YummyYummix website**
- App Store / Google Play IAP may be added later if needed
- **Mexico market:** credit/debit cards via Stripe — the payment method our audience is familiar with
- Features should be evaluated by impact on **conversion** (free → paid) and **retention** (monthly renewals)

---

## Key Metrics

| Metric | Type | What It Tells Us |
|--------|------|-----------------|
| **Cooking sessions** | Primary engagement | How often users actually cook using the app |
| **Chef Sessions** | Core loop | Full loop: AI recipe generation → cook → complete |
| Onboarding completion + first Irmixy interaction | Activation | Did the user get to the "aha moment"? |
| 7-day and 30-day return rates | Retention | Are users coming back? |
| Irmixy chats per active user per week | Engagement | Is the AI companion sticky? |

---

## User Story Format

When writing user stories, use the persona that best fits:

```
As [Sofía / Lupita / a Thermomix owner who...],
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
- [ ] Spanish-first (Mexico primary market)
- [ ] Works for Lupita — guided flows, no self-discovery required
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
What problem does this solve? Who has this problem — Sofía, Lupita, or both?

### Proposed Solution
What should we build? How does it work?

### User Stories
1. [Primary user story — use persona name]
2. [Secondary user story]

### MVP Scope
What's in Phase 1 vs Phase 2+?

### Success Metrics
How do we know this worked? What events do we track?

### Risks & Open Questions
What could go wrong? What don't we know yet?
```
