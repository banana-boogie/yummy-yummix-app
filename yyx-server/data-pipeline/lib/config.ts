/**
 * Pipeline Configuration
 *
 * Loads environment variables and creates Supabase/OpenAI clients
 * based on --local or --production flag.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger.ts';

export type Environment = 'local' | 'production';

export interface PipelineConfig {
  environment: Environment;
  supabase: SupabaseClient;
  supabaseUrl: string;
  openaiApiKey: string;
  usdaApiKey: string;
}

/** Parse --local / --production from Deno.args */
export function resolveEnvironment(args: string[]): Environment {
  const hasLocal = args.includes('--local');
  const hasProduction = args.includes('--production');
  if (hasLocal && hasProduction) {
    throw new Error('Cannot specify both --local and --production');
  }
  if (hasProduction) return 'production';
  if (hasLocal) return 'local';
  throw new Error('Must specify --local or --production');
}

/** Parse --local / --production from Deno.args */
export function parseEnvironment(args: string[]): Environment {
  try {
    return resolveEnvironment(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // console.error intentional: called before any Logger is created
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }
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
  // Resolve paths: lib/ → data-pipeline/ → yyx-server/ → repo root → yyx-app/
  const appRoot = new URL('../../../yyx-app', import.meta.url).pathname;
  const serverRoot = new URL('../..', import.meta.url).pathname;

  let supabaseUrl: string;
  let supabaseKey: string;
  let keyType: string;
  let openaiApiKey: string;
  let usdaApiKey: string;

  if (env === 'local') {
    const envLocal = loadEnvFile(`${appRoot}/.env.local`);
    supabaseUrl = envLocal['EXPO_PUBLIC_SUPABASE_URL'] || '';

    // For API keys, try .env.local first, then .env, then env vars
    const serverEnvLocal = loadEnvFile(`${serverRoot}/.env.local`);
    const serverEnv = loadEnvFile(`${serverRoot}/.env`);
    const appEnv = loadEnvFile(`${appRoot}/.env`);

    // Prefer service role key for DB writes (bypasses RLS), fall back to anon key
    const serviceKey = serverEnvLocal['SUPABASE_SERVICE_ROLE_KEY'] ||
      serverEnv['SUPABASE_SERVICE_ROLE_KEY'] ||
      appEnv['SUPABASE_SERVICE_ROLE_KEY'] ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (serviceKey) {
      supabaseKey = serviceKey;
      keyType = 'service_role';
    } else {
      supabaseKey = envLocal['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '';
      keyType = 'anon';
    }

    openaiApiKey = serverEnvLocal['OPENAI_API_KEY'] || serverEnv['OPENAI_API_KEY'] ||
      appEnv['OPENAI_API_KEY'] || Deno.env.get('OPENAI_API_KEY') || '';
    usdaApiKey = serverEnvLocal['USDA_API_KEY'] || serverEnv['USDA_API_KEY'] ||
      appEnv['USDA_API_KEY'] || Deno.env.get('USDA_API_KEY') || '';
  } else {
    const appEnv = loadEnvFile(`${appRoot}/.env`);
    supabaseUrl = appEnv['EXPO_PUBLIC_SUPABASE_URL'] || '';

    const serverEnvLocal = loadEnvFile(`${serverRoot}/.env.local`);
    const serverEnv = loadEnvFile(`${serverRoot}/.env`);

    // Production requires service role key for DB writes (RLS blocks anon inserts)
    const serviceKey = serverEnvLocal['SUPABASE_SERVICE_ROLE_KEY'] ||
      serverEnv['SUPABASE_SERVICE_ROLE_KEY'] ||
      appEnv['SUPABASE_SERVICE_ROLE_KEY'] ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!serviceKey) {
      // console.error intentional: Logger not yet available during bootstrap
      console.error(
        'Error: SUPABASE_SERVICE_ROLE_KEY is required for production. ' +
          'Set it in yyx-server/.env or as an environment variable.',
      );
      Deno.exit(1);
    }
    supabaseKey = serviceKey;
    keyType = 'service_role';

    openaiApiKey = serverEnvLocal['OPENAI_API_KEY'] || serverEnv['OPENAI_API_KEY'] ||
      appEnv['OPENAI_API_KEY'] || Deno.env.get('OPENAI_API_KEY') || '';
    usdaApiKey = serverEnvLocal['USDA_API_KEY'] || serverEnv['USDA_API_KEY'] ||
      appEnv['USDA_API_KEY'] || Deno.env.get('USDA_API_KEY') || '';
  }

  if (!supabaseUrl || !supabaseKey) {
    // console.error intentional: Logger not yet available during bootstrap
    console.error(`Missing Supabase credentials for ${env} environment`);
    Deno.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const logger = new Logger('config');
  logger.info(`Environment: ${env}`);
  logger.info(`Supabase URL: ${supabaseUrl}`);
  logger.info(`Supabase key type: ${keyType}`);
  logger.info(`OpenAI API key: ${openaiApiKey ? 'configured' : 'MISSING'}`);

  return {
    environment: env,
    supabase,
    supabaseUrl,
    openaiApiKey,
    usdaApiKey,
  };
}
