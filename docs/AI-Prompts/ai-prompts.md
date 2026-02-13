# AI Collaboration Prompts

This document provides copy-paste prompts for iterative AI development workflows.

## Workflow Overview

1. **Plan** (AI #1) → 2. **Implement** (AI #1) → 3. **Review** (AI #2) → 4. **Address Feedback** (AI #1) → 5. **Repeat 3-4**

---

## 1. Planning Prompt (AI #1 - Plan Mode)

Use this when starting a new feature or complex task.

```
Help me plan [describe feature/task].

Use plan mode. Include:
- Implementation approach
- Files to modify
- Verification steps

Follow conventions in CLAUDE.md.
```

---

## 2. Implementation Prompt (AI #1)

Use this after planning is complete.

```
Implement the plan from [plan file or summary].

Follow CLAUDE.md conventions.
Commit when done.
```

---

## 3. Review Prompt (AI #2) ⭐

**KEY PROMPT**: Use this to have a fresh AI review changes comprehensively.

```
Review the latest changes from the last commit.

Evaluate:
1. **Security**: Input validation, authentication checks, data sanitization, injection vulnerabilities
2. **Code Quality**: Follows CLAUDE.md conventions, readable, maintainable, no code smells
3. **Correctness**: Bugs, edge cases, error handling, race conditions
4. **Performance**: Unnecessary re-renders, expensive operations, memory leaks, N+1 queries
5. **Design**: Component structure, separation of concerns, reusability, TypeScript types
6. **Testing**: Test coverage, edge cases tested, integration tests needed
7. **Documentation**: Comments for complex logic, README updates, API docs
8. **i18n**: All user-facing strings use i18n, both English and Spanish translations
9. **Suggestions and Improvements**: Come up with suggestions and improvements to this feature that would have the greatest value added for the user experience. Rank your suggestions and improvements based on the highest impact to work complexity.

Provide specific feedback with:
- File path and line numbers
- Severity (critical, high, medium, low)
- Specific recommendation or fix

Be constructive and acknowledge good patterns.
```

---

## 4. Address Feedback Prompt (AI #1)

Use this to systematically fix issues identified in the review.

```
Address the review feedback from AI #2.

Priority:
1. Critical issues first
2. High severity
3. Medium/low

Commit fixes when done.
```

---

## Tips

- **Fresh Eyes**: Use AI #2 for reviews to get unbiased feedback
- **Iterate**: Don't aim for perfection in one pass—iterate until satisfied
- **Customize**: Add project-specific criteria to the review prompt as needed
- **Security First**: Always prioritize critical security issues
- **Document Context**: When providing feedback to AI #1, include the AI #2 review output

---

## Example Workflow

```bash
# 1. Start with AI #1
"Help me plan adding user profile editing feature. Use plan mode."

# 2. AI #1 implements
"Implement the plan from /path/to/plan.md. Commit when done."

# 3. Switch to AI #2 for review
"Review the latest changes (commit abc123f). [paste full review prompt]"

# 4. Back to AI #1 with feedback
"Address the review feedback from AI #2: [paste AI #2's findings]"

# 5. Repeat review cycle as needed
```

---

## Review Checklist Template

When reviewing, AI #2 should address each category:

- [ ] **Security**: No vulnerabilities identified
- [ ] **Code Quality**: Follows project conventions
- [ ] **Correctness**: Logic is sound, edge cases handled
- [ ] **Performance**: No obvious bottlenecks
- [ ] **Design**: Well-structured and maintainable
- [ ] **Testing**: Adequate test coverage
- [ ] **Documentation**: Complex logic explained
- [ ] **i18n**: All user-facing strings internationalized
