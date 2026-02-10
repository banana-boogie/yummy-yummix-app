// Use the Vercel Edge Function for preview generation

import { createClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

const normalizeLang = (lang) => (lang === 'es' ? 'es' : 'en');

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sanitizeUrl = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return null;
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export default async function handler(req, res) {
  // Extract recipe ID from the URL
  const id = req.query.id;
  const lang = normalizeLang(req.query.lang);
  
  // Basic request logging
  console.info(`[recipe-preview] Processing request for ID: ${id}, lang: ${lang}`);

  // Check if it's a bot/crawler requesting the preview (social media crawlers, search engines, etc.)
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /bot|crawler|spider|pinterest|facebook|twitter|linkedin|slack|discord|whatsapp/i.test(userAgent);
  
  if (!id || !isValidUuid(id)) {
    console.warn('[recipe-preview] Invalid recipe ID:', id);
    return res.status(400).send('Recipe ID is invalid');
  }

  // Actual app URL (destination for human visitors)
  const appUrl = `https://app.yummyyummix.com/(tabs)/recipes/${encodeURIComponent(id)}`;

  // For regular users, immediately redirect to the app
  if (!isBot) {
    console.info(`[recipe-preview] Redirecting user to: ${appUrl}`);
    res.setHeader('Location', appUrl);
    return res.status(302).end();
  }

  // For bots, generate and return HTML with meta tags
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[recipe-preview] Missing Supabase credentials');
      throw new Error('Supabase credentials are missing');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch recipe data
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, name_en, name_es, image_url')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[recipe-preview] Supabase error for ID ${id}:`, error.message);
      return res.status(404).send('Recipe not found');
    }

    if (!recipe) {
      console.warn(`[recipe-preview] Recipe not found: ${id}`);
      return res.status(404).send('Recipe not found');
    }

    // Select language version
    const recipeName = lang === 'es' && recipe.name_es ? recipe.name_es : recipe.name_en;
    const safeRecipeName = recipeName || (lang === 'es' ? 'esta receta' : 'this recipe');
    
    // Generate description based on language
    const description = lang === 'es'
      ? `¡Mira esta deliciosa receta de ${safeRecipeName} en YummyYummix!`
      : `Check out this delicious ${safeRecipeName} recipe on YummyYummix!`;

    // Generate title
    const title = `YummyYummix - ${safeRecipeName}`;
    const safeImageUrl = sanitizeUrl(recipe.image_url);

    // Generate HTML
    const html = generateHtml({
      id,
      title,
      description,
      imageUrl: safeImageUrl,
      language: lang,
      appUrl  // This is the correct destination URL, not the preview URL
    });

    // Set content type and send response
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 week
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
    console.info(`[recipe-preview] Serving preview HTML for bot: ${userAgent}`);
    return res.status(200).send(html);

  } catch (error) {
    const hasSupabaseUrl = !!process.env.EXPO_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    console.error('[recipe-preview] Error generating preview:', error.message);
    console.error('[recipe-preview] Environment check:', { 
      hasSupabaseUrl,
      hasSupabaseKey,
      nodeEnv: process.env.NODE_ENV
    });
    return res.status(500).send('Error generating preview');
  }
}

// HTML template function
function generateHtml({ id, title, description, imageUrl, language, appUrl }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeAppUrl = escapeHtml(appUrl);
  const safeImageUrl = imageUrl ? escapeHtml(imageUrl) : '';
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="${safeTitle}">
  <meta name="description" content="${safeDescription}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeAppUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  ${safeImageUrl ? `<meta property="og:image" content="${safeImageUrl}">` : ''}
  ${safeImageUrl ? '<meta property="og:image:width" content="1200">' : ''}
  ${safeImageUrl ? '<meta property="og:image:height" content="630">' : ''}
  <meta property="og:site_name" content="YummyYummix">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${safeAppUrl}">
  <meta property="twitter:title" content="${safeTitle}">
  <meta property="twitter:description" content="${safeDescription}">
  ${safeImageUrl ? `<meta property="twitter:image" content="${safeImageUrl}">` : ''}
  
  <!-- Additional Meta Tags -->
  ${safeImageUrl ? `<link rel="image_src" href="${safeImageUrl}">` : ''}
  ${safeImageUrl ? `<meta name="thumbnail" content="${safeImageUrl}">` : ''}
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${safeAppUrl}">
  
  <!-- Auto redirect (fallback) -->
  <meta http-equiv="refresh" content="0;url=${safeAppUrl}">
  
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
      line-height: 1.5;
    }
    h1 {
      color: #222;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 20px auto;
      display: block;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .redirect {
      color: #666;
      font-size: 0.9em;
      margin-top: 20px;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDescription}</p>
  ${safeImageUrl ? `<img src="${safeImageUrl}" alt="${safeTitle}">` : ''}
  <p class="redirect">If you are not redirected automatically, <a href="${safeAppUrl}">click here</a>.</p>
</body>
</html>`;
} 
