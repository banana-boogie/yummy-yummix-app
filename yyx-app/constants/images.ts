export const IMAGE_GUIDELINES = {
  maxWidth: 1200,
  maxHeight: 675,
  minWidth: 640,
  minHeight: 360,
  maxFileSize: 2 * 1024 * 1024,
  acceptedFormats: ['image/jpeg', 'image/webp', 'image/png'],
  aspectRatio: 16/9,
  quality: 75,
  recommendedFormat: 'image/webp',
};

export const PLACEHOLDER_SVG = `
<svg width="110" height="80" viewBox="0 0 110 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="110" height="80" fill="url(#gradient)"/>
  <path d="M55 30C47.268 30 41 36.268 41 44C41 51.732 47.268 58 55 58C62.732 58 69 51.732 69 44C69 36.268 62.732 30 55 30ZM55 54C49.486 54 45 49.514 45 44C45 38.486 49.486 34 55 34C60.514 34 65 38.486 65 44C65 49.514 60.514 54 55 54Z" fill="white" fill-opacity="0.5"/>
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="110" y2="80" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FDA4AF"/>
      <stop offset="1" stop-color="#FB7185"/>
    </linearGradient>
  </defs>
</svg>
`;

export const IMAGES = {
  FILTER_CATEGORIES: {
    // BREAKFAST: require('@/assets/images/categories/breakfast.png'),
    // MAIN: require('@/assets/images/categories/main.png'),
    // DESSERT: require('@/assets/images/categories/dessert.png'),
    // SNACK: require('@/assets/images/categories/snack.png'),
    // DRINK: require('@/assets/images/categories/drink.png'),
    // SALAD: require('@/assets/images/categories/salad.png'),
    PLACEHOLDER: { uri: `data:image/svg+xml;base64,${btoa(PLACEHOLDER_SVG)}` },
  }
};