## Project Overview

**YummyYummix** is a cross-platform cooking app with recipe discovery, step-by-step cooking guides, and AI-powered sous chef features. **The app is designed with Thermomix users as the primary audience**, providing specialized cooking parameters and equipment-specific recipe adaptations. Our mission: "Make cooking easy and stress-free, with a dash of fun." **Irmixy** is the AI cooking companion that delivers this mission.

### Target Audience
**Primary users are women aged 30-60** who are Thermomix owners. They are:
- Busy home cooks balancing multiple responsibilities (family, work, health)
- Health-conscious and interested in nutrition and dietary wellness
- Looking for time-saving solutions (30-min meals, make-ahead, batch cooking)
- Family-oriented (cooking for households, kid-friendly options)
- Value practical, easy-to-read interfaces over overly playful designs
- Appreciate inspirational content that feels achievable, not exclusionary
- Want warmth and approachability without sacrificing sophistication

**Avatar strategy: Sell to Sofía, Design for Lupita.**
- **Sofía (35–50) — the buyer.** Mexican Thermomix owner who runs the household's weekly food decisions. Acute weekly-planning pain; pays 149 MXN/mo; tech-comfortable; matches the founder's own use case (dogfood works). Defined by job-to-be-done, not demographic.
- **Lupita (55+) — the design constraint, not the buyer.** Tech-anxious experienced cook. Pain is execution and tech-anxiety, not weekly planning. Subscription willingness is weaker than Sofía's. Included in beta only as 3–5 usability/accessibility testers.

Every UI decision must pass two gates:
- **Sofía gate** — does the buyer pay more, retain longer, or refer more after this surface change?
- **Lupita gate** — can the constraint user complete it without help (44px+ targets, no self-discovery, large readable text)?

**Mexico-first launch** — Spanish is the primary language.

### Repository Structure
- `yyx-app/` - React Native mobile app (Expo)
- `yyx-server/` - Backend with Supabase Edge Functions (Deno/TypeScript)
- `supabase/` - Supabase configuration
