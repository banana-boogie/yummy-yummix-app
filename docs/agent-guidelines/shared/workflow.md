## Development Workflow

### Collaborative Design-Build-Review Cycle

For significant features, follow this cycle. Not every task needs the full cycle — use judgment on complexity.

#### When to Use the Full Cycle
- New features that affect the core product loop (meal planning, shopping list connection)
- Architectural decisions (new edge functions, database schema, navigation changes)
- UX flows that affect Lupita or Sofía directly
- Anything where a wrong design decision would require significant rework

#### When to Skip to Implementation
- Bug fixes with clear cause and fix
- Copy/i18n changes
- Style/layout tweaks
- Adding tests to existing code

#### The Cycle

**Phase 1: Design**
1. Create a detailed plan for the task
2. Pass the plan to Codex for review
3. Use `/triage-review` on Claude to audit Codex's feedback and update the plan
4. Iterate between Claude and Codex until both agree

**Phase 2: Approval**
5. Ian reviews the final plan and gives feedback
6. Plan is updated based on Ian's feedback
7. Plan is approved for implementation

**Phase 3: Implementation**
8. Claude implements the plan
9. Claude reviews using `/review-changes` and corrects issues

**Phase 4: Cross-Review**
10. Codex reviews the changes using `review-changes {# of commits}`
11. `/triage-review` on Claude produces a fix plan
12. Plan is passed to Codex for review
13. Codex passes feedback to Claude
14. Claude implements fixes

**Phase 5: Testing**
15. Ian tests the implementation and gives feedback
16. Minor issues: Claude fixes directly
17. Major issues: full plan → implement → review cycle again

**Phase 6: PR**
18. Claude creates the PR
19. Ian reviews the PR and gives feedback
20. Claude addresses issues (minor: direct fix; major: collaborative plan)
21. Repeat until PR is approved and merged

### Git Strategy

#### Branch Naming
- Feature branches: `feature/description-in-kebab-case`
- Bug fixes: `fix/issue-description`
- Follow conventional commits in commit messages

#### Worktrees
The project uses git worktrees to work on multiple features in parallel. Each worktree is an isolated copy of the repo on a different branch.

**Existing worktrees** (check `../` relative to the main repo for sibling directories):
- `yummy-yummix-app` — main branch
- Other worktrees may exist for feature branches

**Creating a new worktree:**
```bash
# From the main repo directory
git worktree add ../worktree-name -b feature/branch-name
```

**Rules:**
- Each worktree works on one feature branch
- Never push directly to main — always use PRs
- Worktrees share the same git history — commits made in one are visible in others after fetch
- Clean up worktrees after PRs are merged: `git worktree remove ../worktree-name`

#### PR Workflow
1. Work is done in a feature branch (via worktree or regular branch)
2. PR is created against main
3. PR goes through the review cycle (Phase 4-6 above)
4. PR is merged after approval
5. Worktree is cleaned up if applicable

### Working with Product Kitchen

The product strategy and implementation plans live in `../product-kitchen/` (a sibling directory, not part of this repo). Key files:

- `../product-kitchen/PRODUCT_STRATEGY.md` — The north star product strategy
- `../product-kitchen/combined-implementation-plan/` — Detailed implementation plans for each feature
- `../product-kitchen/research/` — Research findings that inform the strategy

When building features, reference the relevant implementation plan for design decisions, acceptance criteria, and architectural guidance. The plans are the source of truth for what to build and why.
