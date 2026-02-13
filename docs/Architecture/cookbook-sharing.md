# Cookbook Sharing Architecture

## Status

The cookbook sharing backend is implemented, but sharing is intentionally disabled in the app for now (UI entry points are hidden and shared-link route access is redirected). This keeps current cookbook CRUD stable while the broader social sharing model is designed.

## High-Level Overview

Cookbook sharing uses a token-based link model:

1. Each cookbook has a `share_token` (UUID) and `share_enabled` flag in the database.
2. A share link points to a route containing the token (not cookbook ID).
3. Shared cookbook reads go through RPC functions that validate token + sharing state.
4. Access is granted only when the token matches and `share_enabled = true`.
5. Regenerating the share link rotates the token, invalidating the old link.

This model supports private-by-default cookbooks while allowing controlled link access.

## Token Lifecycle

- **Creation**: `share_token` is generated with `gen_random_uuid()` when the cookbook row is created.
- **Enable sharing**: sharing is made active by setting `share_enabled = true` (and token is available).
- **Rotate token**: `regenerate_cookbook_share_token(...)` generates a new UUID and enables sharing.
- **Disable sharing**: set `share_enabled = false`; token lookups should no longer return cookbook data.

## What Is an RPC?

RPC means **Remote Procedure Call**. In this app, the client calls a Postgres function by name via Supabase (`supabase.rpc(...)`) instead of directly querying tables for certain operations.

Examples used for sharing:

- `get_cookbook_by_share_token(...)`
- `get_cookbook_recipes_by_share_token(...)`
- `regenerate_cookbook_share_token(...)`

## What Is a Security-Definer RPC?

In Postgres, functions can run with:

- `SECURITY INVOKER` (default): function runs with caller permissions.
- `SECURITY DEFINER`: function runs with function-owner permissions.

Sharing read RPCs use `SECURITY DEFINER` so they can bypass normal RLS in a controlled way while still enforcing strict SQL predicates (`share_token` match + `share_enabled = true`).

This avoids broad public table policies and keeps access constrained to explicit share-link behavior.

## Cookbook Sharing vs Recipe Sharing

- **Cookbook sharing**: token-based capability link for cookbook collections.
- **Recipe sharing (current)**: recipe detail uses preview/share URL flow by recipe ID, not cookbook share-token RPC.

## Testing Notes (Current Environment)

Integration assertions should use existing `SUPABASE_*` environment naming.

Recommended fixed fixtures for deterministic tests:

- `SUPABASE_TEST_PRIVATE_SHARED_COOKBOOK_TOKEN`
- `SUPABASE_TEST_PRIVATE_UNSHARED_COOKBOOK_TOKEN`
- `SUPABASE_TEST_PUBLIC_COOKBOOK_TOKEN`

Tests should remain read-only when targeting the current dev cloud environment.

## Future Plan: Social Sharing Roadmap

### Shared-With-Me Experience

- Add a destination where users can see cookbooks shared to them.
- Support lifecycle states (pending, accepted, revoked, expired if applicable).

### Friend-Based Invites

- Let users share cookbooks directly to in-app friends.
- Add invite flow for recipients already on the app.
- Define permissions model (viewer/editor/owner-adjacent roles) and revocation rules.

### User Recipes and Sharing

- Add social sharing support for `user_recipes` (AI-generated user recipes).
- Add support for users to manually input and save their own recipes.
- Unify cookbook sharing and recipe sharing under a coherent social content model.

### Architecture Direction

- Keep cookbook sharing backend primitives reusable.
- Introduce social graph + invite metadata instead of relying only on raw token links.
- Maintain strict permission boundaries and explicit auditability of share actions.
