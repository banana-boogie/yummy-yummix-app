// Use the Vercel Edge Function for preview generation

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Extract recipe ID from the URL
  const id = req.query.id;
  const lang = req.query.lang || 'en';
  
  // Basic request logging
  console.info(`[recipe-preview] Processing request for ID: ${id}, lang: ${lang}`);

  // Check if it's a bot/crawler requesting the preview (social media crawlers, search engines, etc.)
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /bot|crawler|spider|pinterest|facebook|twitter|linkedin|slack|discord|whatsapp/i.test(userAgent);
  
  // Actual app URL (destination for human visitors)
  const appUrl = `https://app.yummyyummix.com/(tabs)/recipes/${id}`;

  // For regular users, immediately redirect to the app
  if (!isBot) {
    console.info(`[recipe-preview] Redirecting user to: ${appUrl}`);
    res.setHeader('Location', appUrl);
    return res.status(302).end();
  }

  if (!id) {
    console.warn('[recipe-preview] Missing recipe ID');
    return res.status(400).send('Recipe ID is required');
  }

  // For bots, generate and return HTML with meta tags
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[recipe-preview] Missing Supabase credentials');
      throw new Error('Supabase credentials are missing');
    }

    // Fetch recipe data
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, name_en, name_es, picture_url')
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
    
    // Generate description based on language
    const description = lang === 'es'
      ? `¡Mira esta deliciosa receta de ${recipeName} en YummyYummix!`
      : `Check out this delicious ${recipeName} recipe on YummyYummix!`;

    // Generate title
    const title = `YummyYummix - ${recipeName}`;

    // Generate HTML
    const html = generateHtml({
      id,
      title,
      description,
      imageUrl: recipe.picture_url,
      language: lang,
      appUrl  // This is the correct destination URL, not the preview URL
    });

    // Set content type and send response
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 week
    console.info(`[recipe-preview] Serving preview HTML for bot: ${userAgent}`);
    return res.status(200).send(html);

  } catch (error) {
    console.error('[recipe-preview] Error generating preview:', error.message);
    console.error('[recipe-preview] Environment check:', { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasSupabaseKey: !!supabaseAnonKey,
      nodeEnv: process.env.NODE_ENV
    });
    return res.status(500).send('Error generating preview');
  }
}

// HTML template function
function generateHtml({ id, title, description, imageUrl, language, appUrl }) {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${appUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="YummyYummix">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${appUrl}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${imageUrl}">
  
  <!-- Additional Meta Tags -->
  <link rel="image_src" href="${imageUrl}">
  <meta name="thumbnail" content="${imageUrl}">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${appUrl}">
  
  <!-- Auto redirect (fallback) -->
  <meta http-equiv="refresh" content="0;url=${appUrl}">
  
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
  <h1>${title}</h1>
  <p>${description}</p>
  ${imageUrl ? `<img src="${imageUrl}" alt="${title}">` : ''}
  <p class="redirect">If you are not redirected automatically, <a href="${appUrl}">click here</a>.</p>
</body>
</html>`;
} 