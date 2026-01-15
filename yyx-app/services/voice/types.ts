// Voice provider status
export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

// Voice events
export type VoiceEvent = 'statusChange' | 'transcript' | 'response' | 'error' | 'quotaWarning';

// User context
export interface UserContext {
    language: 'en' | 'es';
    measurementSystem: 'metric' | 'imperial';
    dietaryRestrictions: string[];
    dietTypes: string[];
}

// Recipe context
export interface RecipeContext {
    type: 'cooking' | 'recipe' | 'chat';
    recipeId?: string;
    recipeTitle?: string;
    currentStep?: number;
    totalSteps?: number;
    stepInstructions?: string;
    ingredients?: Array<{ name: string; amount: string }>;
}

// Conversation context
export interface ConversationContext {
    userContext: UserContext;
    recipeContext?: RecipeContext;
}

// Quota info
export interface QuotaInfo {
    remainingMinutes: number;
    minutesUsed: number;
    quotaLimit: number;
    warning?: string;
}

// Provider config
export interface ProviderConfig {
    openaiApiKey?: string; // Client-side key for WebRTC
    language: 'en' | 'es';
    sessionId: string;
}

// Abstract provider interface
export interface VoiceAssistantProvider {
    // Initialize provider
    initialize(config: ProviderConfig): Promise<any>;

    // Start conversation
    startConversation(context: ConversationContext): Promise<void>;

    // Stop conversation
    stopConversation(): void;

    // Update context mid-conversation
    setContext(userContext: UserContext, recipeContext?: RecipeContext): void;

    // Event handling
    on(event: VoiceEvent, callback: (...args: any[]) => void): void;
    off(event: VoiceEvent, callback: (...args: any[]) => void): void;

    // Get current status
    getStatus(): VoiceStatus;

    // Get quota info
    getRemainingQuota(): Promise<QuotaInfo>;

    // Cleanup
    destroy(): Promise<void>;
}
