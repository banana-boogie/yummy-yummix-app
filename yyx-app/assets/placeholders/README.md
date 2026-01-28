# Placeholder Images

This directory contains temporary placeholder images used when actual images are not available.

## Current Files

- `ingredient-placeholder.png` - Used for ingredients without images
- `recipe-placeholder.png` - Used for recipes without images

## TODO

Replace these temporary placeholders with actual designed images from the designer.

The placeholders should match the YummyYummix branding:
- Primary colors: warm peach (#FEE5E2), cream (#FCF6F2)
- Typography: Quicksand for headings
- Style: Friendly, approachable, food-focused

## Usage

Import via `constants/placeholders.ts`:

```typescript
import { PLACEHOLDER_IMAGES } from '@/constants/placeholders';

<Image source={PLACEHOLDER_IMAGES.ingredient} />
<Image source={PLACEHOLDER_IMAGES.recipe} />
```
