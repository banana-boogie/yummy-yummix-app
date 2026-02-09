/**
 * Pipeline Configuration
 *
 * Loads environment variables and creates Supabase/OpenAI clients
 * based on --local or --production flag.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Environment = 'local' | 'production';

export interface PipelineConfig {
  environment: Environment;
  supabase: SupabaseClient;
  supabaseUrl: string;
  openaiApiKey: string;
  usdaApiKey: string;
}

/** Parse --local / --production from Deno.args */
export function parseEnvironment(args: string[]): Environment {
  if (args.includes('--production')) return 'production';
  if (args.includes('--local')) return 'local';
  console.error('Error: Must specify --local or --production');
  Deno.exit(1);
}

/** Parse a named flag value from args (e.g. --limit 50) */
export function parseFlag(args: string[], flag: string, defaultValue?: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

/** Check if a boolean flag is present */
export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

/** Load .env file and return key-value pairs */
function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = Deno.readTextFileSync(path);
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Initialize the full pipeline config */
export function createPipelineConfig(env: Environment): PipelineConfig {
  // Resolve paths relative to yyx-app (where .env files live)
  const appRoot = new URL('../../yyx-app', import.meta.url).pathname;
  const serverRoot = new URL('../../yyx-server', import.meta.url).pathname;

  let supabaseUrl: string;
  let supabaseKey: string;
  let openaiApiKey: string;
  let usdaApiKey: string;

  if (env === 'local') {
    const envLocal = loadEnvFile(`${appRoot}/.env.local`);
    supabaseUrl = envLocal['EXPO_PUBLIC_SUPABASE_URL'] || '';
    supabaseKey = envLocal['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '';

    // For API keys, try .env in yyx-server first, then yyx-app
    const serverEnv = loadEnvFile(`${serverRoot}/.env`);
    const appEnv = loadEnvFile(`${appRoot}/.env`);
    openaiApiKey = serverEnv['OPENAI_API_KEY'] || appEnv['OPENAI_API_KEY'] ||
      Deno.env.get('OPENAI_API_KEY') || '';
    usdaApiKey = serverEnv['USDA_API_KEY'] || appEnv['USDA_API_KEY'] ||
      Deno.env.get('USDA_API_KEY') || '';
  } else {
    const appEnv = loadEnvFile(`${appRoot}/.env`);
    supabaseUrl = appEnv['EXPO_PUBLIC_SUPABASE_URL'] || '';
    supabaseKey = appEnv['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '';

    const serverEnv = loadEnvFile(`${serverRoot}/.env`);
    openaiApiKey = serverEnv['OPENAI_API_KEY'] || appEnv['OPENAI_API_KEY'] ||
      Deno.env.get('OPENAI_API_KEY') || '';
    usdaApiKey = serverEnv['USDA_API_KEY'] || appEnv['USDA_API_KEY'] ||
      Deno.env.get('USDA_API_KEY') || '';
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error(`Missing Supabase credentials for ${env} environment`);
    Deno.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`[config] Environment: ${env}`);
  console.log(`[config] Supabase URL: ${supabaseUrl}`);
  console.log(`[config] OpenAI API key: ${openaiApiKey ? 'configured' : 'MISSING'}`);

  return {
    environment: env,
    supabase,
    supabaseUrl,
    openaiApiKey,
    usdaApiKey,
  };
}
