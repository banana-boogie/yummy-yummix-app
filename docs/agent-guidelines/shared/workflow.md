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

For full guided development, use `/build-feature` (Claude) or `$build-feature` (Codex). It covers discovery, exploration, design, implementation, review, and documentation with built-in checkpoints. The phases below describe the same process for manual orchestration.

**Phase 1: Design**
1. Create a detailed plan for the task
2. Ask another AI agent to review the plan using its plan-review skill (`$review-plan` in Codex, `/review-plan` in Claude)
3. Revise the plan based on that feedback
4. Iterate until the plan is strong enough to implement

**Phase 2: Approval**
5. A human reviews the final plan and gives feedback
6. Plan is updated based on that feedback
7. Plan is approved for implementation

**Phase 3: Implementation**
8. The implementing AI agent implements the plan
9. The implementing AI agent self-reviews using its local-changes review skill (`$review-changes` in Codex, `/review-changes` in Claude) and corrects issues

**Phase 4: Cross-Review**
10. A second AI agent reviews the branch using its local-changes review skill
11. Claude uses `/triage-review` on that external review to separate must-fix items from noise
12. Claude creates a revised fix plan that combines the best findings from both AI reviews
13. The implementing AI agent applies the revised plan
14. Repeat if needed until the branch is ready for PR

**Phase 5: Testing**
15. A human tests the implementation and gives feedback
16. Minor issues: the implementing AI agent fixes directly
17. Major issues: full plan -> implement -> review cycle again

**Phase 6: Documentation**
18. The implementing AI agent syncs documentation (`/update-docs` in Claude, `$update-docs` in Codex)

**Phase 7: PR**
19. The implementing AI agent creates the PR
20. Codex reviews the PR with `$review-pr <PR#>`
21. Claude reviews the PR with `/review-pr <PR#>`
22. Claude uses `/triage-review` on Codex's review, creates a revised plan that takes the best of both AI reviews, and implements the changes
23. A human reviews the PR manually and gives feedback
24. The implementing AI agent addresses that feedback; repeat until approved and merged

### Git Strategy

#### Branch Naming
Follow the Git Conventions section for branch naming and commit message rules.

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

### Commit Workflow

**Resolve first, then commit.** Do not commit after every small change. Iterate on the fix, verify it works, then commit once the issue is resolved.

- Make edits and suggest the user test the change
- If the fix doesn't work, iterate — do NOT commit broken or partial work
- Once the issue is resolved, suggest committing (but wait for user confirmation)
- Before moving on to the next issue, commit the resolved one
- Group related fixes into a single meaningful commit

### Working with Product Kitchen

The product strategy and implementation plans live in `../product-kitchen/` (a sibling directory, not part of this repo). Key files:

- `../product-kitchen/PRODUCT_STRATEGY.md` — The north star product strategy
- `../product-kitchen/combined-implementation-plan/` — Detailed implementation plans for each feature
- `../product-kitchen/research/` — Research findings that inform the strategy

When building features, reference the relevant implementation plan for design decisions, acceptance criteria, and architectural guidance. The plans are the source of truth for what to build and why.
