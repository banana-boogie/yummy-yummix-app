/**
 * Irmixy AI Orchestrator
 *
 * Unified entry point for all Irmixy AI interactions (text and voice).
 * Handles context loading, LLM tool calls, and structured response generation.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { createContextBuilder } from '../_shared/context-builder.ts';
import {
  IrmixyResponse,
  IrmixyResponseSchema,
  validateSchema,
  ValidationError,
} from '../_shared/irmixy-schemas.ts';
import {
  searchRecipes,
  searchRecipesTool,
} from '../_shared/tools/search-recipes.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

interface OrchestratorRequest {
  message: string;
  sessionId?: string;
  userId?: string;
  mode?: 'text' | 'voice';
  stream?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, sessionId, userId, mode = 'text', stream = false } =
      await req.json() as OrchestratorRequest;

    // Validate request
    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Initialize Supabase client with user's auth
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const effectiveUserId = userId || user.id;

    // Handle streaming vs non-streaming responses
    if (stream) {
      return handleStreamingRequest(
        supabase,
        effectiveUserId,
        sessionId,
        message,
        mode,
      );
    }

    // Non-streaming path (original behavior)
    const irmixyResponse = await processRequest(
      supabase,
      effectiveUserId,
      sessionId,
      message,
      mode,
    );

    return new Response(
      JSON.stringify(irmixyResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Orchestrator error:', error);

    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid response format',
          details: error.issues,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

/**
 * Process request and return IrmixyResponse (non-streaming)
 */
async function processRequest(
  supabase: any,
  userId: string,
  sessionId: string | undefined,
  message: string,
  mode: 'text' | 'voice',
): Promise<IrmixyResponse> {
  // Build user context
  const contextBuilder = createContextBuilder(supabase);
  const userContext = await contextBuilder.buildContext(userId, sessionId);

  // Check for resumable cooking session
  const resumableSession = await contextBuilder.getResumableCookingSession(
    userId,
  );

  // Build system prompt
  const systemPrompt = buildSystemPrompt(userContext, mode, resumableSession);

  // Build conversation messages
  const messages = [
    { role: 'system', content: systemPrompt },
    ...userContext.conversationHistory,
    { role: 'user', content: message },
  ];

  // Call OpenAI with tools
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages,
      tools: [
        searchRecipesTool,
        // Additional tools will be added in Phase 2+
      ],
      tool_choice: 'auto',
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error('Failed to get AI response');
  }

  const aiResponse = await response.json();
  const assistantMessage = aiResponse.choices[0].message;

  // Process tool calls if present
  let irmixyResponse: IrmixyResponse;

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Execute tools and build response
    irmixyResponse = await executeTools(
      supabase,
      assistantMessage.tool_calls,
      assistantMessage.content || '',
      userContext,
    );
  } else {
    // No tool calls - just return the message
    irmixyResponse = {
      version: '1.0',
      message: assistantMessage.content || '',
      language: userContext.language,
      status: null,
    };
  }

  // Save message to conversation history
  if (sessionId) {
    await saveMessageToHistory(
      supabase,
      sessionId,
      userId,
      message,
      irmixyResponse,
    );
  }

  // Validate response schema before returning
  validateSchema(IrmixyResponseSchema, irmixyResponse);

  return irmixyResponse;
}

/**
 * Handle streaming request with SSE
 */
async function handleStreamingRequest(
  supabase: any,
  userId: string,
  sessionId: string | undefined,
  message: string,
  mode: 'text' | 'voice',
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial "thinking" status
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'status', status: 'thinking' })}\n\n`,
          ),
        );

        // Build user context
        const contextBuilder = createContextBuilder(supabase);
        const userContext = await contextBuilder.buildContext(userId, sessionId);

        // Check for resumable cooking session
        const resumableSession = await contextBuilder.getResumableCookingSession(
          userId,
        );

        // Build system prompt
        const systemPrompt = buildSystemPrompt(
          userContext,
          mode,
          resumableSession,
        );

        // Build conversation messages
        const messages = [
          { role: 'system', content: systemPrompt },
          ...userContext.conversationHistory,
          { role: 'user', content: message },
        ];

        // Call OpenAI with tools
        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4-turbo-preview',
              messages,
              tools: [
                searchRecipesTool,
                // Additional tools will be added in Phase 2+
              ],
              tool_choice: 'auto',
              temperature: 0.7,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('OpenAI API error:', error);
          throw new Error('Failed to get AI response');
        }

        const aiResponse = await response.json();
        const assistantMessage = aiResponse.choices[0].message;

        // Process tool calls if present
        let irmixyResponse: IrmixyResponse;

        if (
          assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0
        ) {
          // Send "searching" or "generating" status based on tool type
          const toolName = assistantMessage.tool_calls[0].function.name;
          const status = toolName === 'search_recipes'
            ? 'searching'
            : 'generating';

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'status', status })}\n\n`,
            ),
          );

          // Execute tools and build response
          irmixyResponse = await executeTools(
            supabase,
            assistantMessage.tool_calls,
            assistantMessage.content || '',
            userContext,
          );
        } else {
          // No tool calls - just return the message
          irmixyResponse = {
            version: '1.0',
            message: assistantMessage.content || '',
            language: userContext.language,
            status: null,
          };
        }

        // Save message to conversation history
        if (sessionId) {
          await saveMessageToHistory(
            supabase,
            sessionId,
            userId,
            message,
            irmixyResponse,
          );
        }

        // Validate response schema before sending
        validateSchema(IrmixyResponseSchema, irmixyResponse);

        // Send final response
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', response: irmixyResponse })}\n\n`,
          ),
        );

        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        controller.enqueue(
          encoder.encode(
            `data: ${
              JSON.stringify({
                type: 'error',
                error: error.message || 'Internal server error',
              })
            }\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Build system prompt with user context and mode-specific instructions
 */
function buildSystemPrompt(
  userContext: any,
  mode: 'text' | 'voice',
  resumableSession: any,
): string {
  const basePrompt = `You are Irmixy, a cheerful and helpful cooking assistant for the YummyYummix app.

Your goal: Help users cook better with less time, energy, and inspire creativity.

USER CONTEXT:
- Language: ${userContext.language}
- Measurement system: ${userContext.measurementSystem}
- Skill level: ${userContext.skillLevel || 'not specified'}
- Household size: ${userContext.householdSize || 'not specified'}
- Dietary restrictions: ${
    userContext.dietaryRestrictions.length > 0
      ? userContext.dietaryRestrictions.join(', ')
      : 'none'
  }
- Ingredient dislikes: ${
    userContext.ingredientDislikes.length > 0
      ? userContext.ingredientDislikes.join(', ')
      : 'none'
  }

IMPORTANT RULES:
1. Always respond in ${userContext.language === 'es' ? 'Spanish' : 'English'}
2. Use ${userContext.measurementSystem} measurements (${
    userContext.measurementSystem === 'imperial'
      ? 'cups, oz, °F'
      : 'ml, g, °C'
  })
3. NEVER suggest ingredients from the dietary restrictions list
4. Use tools to search recipes or generate custom recipes - don't make up recipe data
5. Be encouraging and positive, especially for beginner cooks
6. Keep safety in mind - always mention proper cooking temperatures for meat`;

  // Add resumable session context
  let sessionContext = '';
  if (resumableSession) {
    sessionContext = `\n\nACTIVE COOKING SESSION:
The user has an incomplete cooking session for "${resumableSession.recipeName}".
They stopped at step ${resumableSession.currentStep} of ${resumableSession.totalSteps}.
Ask if they'd like to resume cooking.`;
  }

  // Add mode-specific instructions
  const modeInstructions = mode === 'voice'
    ? `\n\nVOICE MODE:
Keep responses SHORT and conversational (1-2 sentences).
This will be spoken aloud, so:
- Avoid lists, use natural speech
- Say "I found a few options" not "Here are 4 recipes:"
- Ask one question at a time`
    : '';

  return basePrompt + sessionContext + modeInstructions;
}

/**
 * Execute tool calls and build IrmixyResponse
 */
async function executeTools(
  supabase: any,
  toolCalls: any[],
  message: string,
  userContext: any,
): Promise<IrmixyResponse> {
  const response: IrmixyResponse = {
    version: '1.0',
    message: message || 'Let me help you with that.',
    language: userContext.language,
    status: null,
  };

  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;

    try {
      if (name === 'search_recipes') {
        const params = JSON.parse(args);

        // Execute search
        const recipes = await searchRecipes(supabase, params, userContext);

        response.recipes = recipes;
        response.status = 'searching';

        // Generate suggestions based on results
        if (recipes.length > 0) {
          response.suggestions = recipes.slice(0, 3).map((recipe) => ({
            label: recipe.name,
            message: `Tell me about ${recipe.name}`,
          }));
        } else {
          response.suggestions = [
            {
              label: userContext.language === 'es'
                ? 'Crear receta personalizada'
                : 'Create custom recipe',
              message: userContext.language === 'es'
                ? 'Ayúdame a crear algo'
                : 'Help me create something',
            },
          ];
        }
      }
      // Additional tools will be added here in Phase 2+
    } catch (error) {
      console.error(`Tool ${name} error:`, error);
      response.safetyFlags = {
        error: true,
      };
      response.message = userContext.language === 'es'
        ? 'Hubo un problema. Por favor, intenta de nuevo.'
        : 'There was a problem. Please try again.';
    }
  }

  return response;
}

/**
 * Save message exchange to conversation history
 */
async function saveMessageToHistory(
  supabase: any,
  sessionId: string,
  userId: string,
  userMessage: string,
  assistantResponse: IrmixyResponse,
): Promise<void> {
  // Save user message
  await supabase.from('user_chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: userMessage,
  });

  // Save assistant response
  await supabase.from('user_chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'assistant',
    content: assistantResponse.message,
  });
}
