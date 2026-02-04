import { supabase } from '@/lib/supabase';

export type TimeframeFilter = 'today' | '7_days' | '30_days' | 'all_time';

interface TimeframeRange {
  start: Date | null;
  end: Date;
}

/**
 * Get date range for a given timeframe filter
 */
function getTimeframeRange(timeframe: TimeframeFilter): TimeframeRange {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  switch (timeframe) {
    case 'today':
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      return { start: startOfDay, end: endOfDay };
    case '7_days':
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return { start: sevenDaysAgo, end: endOfDay };
    case '30_days':
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return { start: thirtyDaysAgo, end: endOfDay };
    case 'all_time':
      return { start: null, end: endOfDay };
  }
}

/**
 * Format date for Supabase query
 */
function formatDate(date: Date): string {
  return date.toISOString();
}

export interface OverviewMetrics {
  dau: number;
  wau: number;
  mau: number;
  totalSignups: number;
  onboardingRate: number;
}

export interface RetentionMetrics {
  day1Retention: number;
  day7Retention: number;
  day30Retention: number;
  avgTimeToFirstCook: number | null;
  weeklyCookRate: number;
}

export interface FunnelMetrics {
  totalViews: number;
  totalStarts: number;
  totalCompletes: number;
  viewToStartRate: number;
  startToCompleteRate: number;
  overallConversionRate: number;
}

export interface TopRecipe {
  recipeId: string;
  recipeName: string;
  count: number;
}

export interface TopSearch {
  query: string;
  count: number;
}

export interface AIMetrics {
  aiAdoptionRate: number;
  totalChatSessions: number;
  totalVoiceSessions: number;
  aiUserCount: number;
  returnAIUsers: number;
}

export interface PatternMetrics {
  cookingByHour: { hour: number; count: number }[];
  languageSplit: { language: string; count: number }[];
}

export const analyticsService = {
  /**
   * Get overview metrics (DAU, WAU, MAU, signups, onboarding rate)
   */
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    // DAU - distinct users with events today
    const { data: dauData } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', formatDate(today));

    const dau = new Set(dauData?.map(e => e.user_id) || []).size;

    // WAU - distinct users with events in last 7 days
    const { data: wauData } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', formatDate(oneWeekAgo));

    const wau = new Set(wauData?.map(e => e.user_id) || []).size;

    // MAU - distinct users with events in last 30 days
    const { data: mauData } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', formatDate(oneMonthAgo));

    const mau = new Set(mauData?.map(e => e.user_id) || []).size;

    // Total signups (from user_profiles table)
    const { count: totalSignups } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // Onboarding completion rate
    const { count: completedOnboarding } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_complete', true);

    const onboardingRate = totalSignups && totalSignups > 0
      ? ((completedOnboarding || 0) / totalSignups) * 100
      : 0;

    return {
      dau,
      wau,
      mau,
      totalSignups: totalSignups || 0,
      onboardingRate,
    };
  },

  /**
   * Get cooking funnel metrics
   */
  async getFunnelMetrics(timeframe: TimeframeFilter): Promise<FunnelMetrics> {
    const { start, end } = getTimeframeRange(timeframe);

    let query = supabase
      .from('user_events')
      .select('event_type, user_id');

    if (start) {
      query = query.gte('created_at', formatDate(start));
    }
    query = query.lte('created_at', formatDate(end));

    const { data: events } = await query;

    const views = events?.filter(e => e.event_type === 'view_recipe').length || 0;
    const starts = events?.filter(e => e.event_type === 'cook_start').length || 0;
    const completes = events?.filter(e => e.event_type === 'cook_complete').length || 0;

    return {
      totalViews: views,
      totalStarts: starts,
      totalCompletes: completes,
      viewToStartRate: views > 0 ? (starts / views) * 100 : 0,
      startToCompleteRate: starts > 0 ? (completes / starts) * 100 : 0,
      overallConversionRate: views > 0 ? (completes / views) * 100 : 0,
    };
  },

  /**
   * Get top viewed recipes
   */
  async getTopViewedRecipes(timeframe: TimeframeFilter, limit = 10): Promise<TopRecipe[]> {
    const { start, end } = getTimeframeRange(timeframe);

    let query = supabase
      .from('user_events')
      .select('payload')
      .eq('event_type', 'view_recipe');

    if (start) {
      query = query.gte('created_at', formatDate(start));
    }
    query = query.lte('created_at', formatDate(end));

    const { data: events } = await query;

    // Count by recipe
    const recipeCounts: Record<string, { name: string; count: number }> = {};
    events?.forEach(e => {
      const payload = e.payload as { recipe_id?: string; recipe_name?: string };
      if (payload?.recipe_id) {
        if (!recipeCounts[payload.recipe_id]) {
          recipeCounts[payload.recipe_id] = {
            name: payload.recipe_name || 'Unknown',
            count: 0,
          };
        }
        recipeCounts[payload.recipe_id].count++;
      }
    });

    return Object.entries(recipeCounts)
      .map(([id, data]) => ({
        recipeId: id,
        recipeName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  /**
   * Get top cooked recipes
   */
  async getTopCookedRecipes(timeframe: TimeframeFilter, limit = 10): Promise<TopRecipe[]> {
    const { start, end } = getTimeframeRange(timeframe);

    let query = supabase
      .from('user_events')
      .select('payload')
      .eq('event_type', 'cook_complete');

    if (start) {
      query = query.gte('created_at', formatDate(start));
    }
    query = query.lte('created_at', formatDate(end));

    const { data: events } = await query;

    // Count by recipe
    const recipeCounts: Record<string, { name: string; count: number }> = {};
    events?.forEach(e => {
      const payload = e.payload as { recipe_id?: string; recipe_name?: string };
      if (payload?.recipe_id) {
        if (!recipeCounts[payload.recipe_id]) {
          recipeCounts[payload.recipe_id] = {
            name: payload.recipe_name || 'Unknown',
            count: 0,
          };
        }
        recipeCounts[payload.recipe_id].count++;
      }
    });

    return Object.entries(recipeCounts)
      .map(([id, data]) => ({
        recipeId: id,
        recipeName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  /**
   * Get top search queries
   */
  async getTopSearches(timeframe: TimeframeFilter, limit = 10): Promise<TopSearch[]> {
    const { start, end } = getTimeframeRange(timeframe);

    let query = supabase
      .from('user_events')
      .select('payload')
      .eq('event_type', 'search');

    if (start) {
      query = query.gte('created_at', formatDate(start));
    }
    query = query.lte('created_at', formatDate(end));

    const { data: events } = await query;

    // Count by query (case-insensitive)
    const queryCounts: Record<string, number> = {};
    events?.forEach(e => {
      const payload = e.payload as { query?: string };
      if (payload?.query) {
        const normalizedQuery = payload.query.toLowerCase().trim();
        queryCounts[normalizedQuery] = (queryCounts[normalizedQuery] || 0) + 1;
      }
    });

    return Object.entries(queryCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  /**
   * Get AI feature metrics
   */
  async getAIMetrics(): Promise<AIMetrics> {
    // Total users
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // Chat session users
    const { data: chatUsers } = await supabase
      .from('user_chat_sessions')
      .select('user_id');

    const uniqueChatUsers = new Set(chatUsers?.map(s => s.user_id) || []);

    // Voice session users
    const { data: voiceUsers } = await supabase
      .from('ai_voice_sessions')
      .select('user_id');

    const uniqueVoiceUsers = new Set(voiceUsers?.map(s => s.user_id) || []);

    // Combined AI users
    const allAIUsers = new Set([...uniqueChatUsers, ...uniqueVoiceUsers]);

    // Total sessions
    const { count: totalChatSessions } = await supabase
      .from('user_chat_sessions')
      .select('*', { count: 'exact', head: true });

    const { count: totalVoiceSessions } = await supabase
      .from('ai_voice_sessions')
      .select('*', { count: 'exact', head: true });

    // Return users (users with 2+ AI sessions)
    const chatUserSessionCounts: Record<string, number> = {};
    chatUsers?.forEach(s => {
      chatUserSessionCounts[s.user_id] = (chatUserSessionCounts[s.user_id] || 0) + 1;
    });

    const voiceUserSessionCounts: Record<string, number> = {};
    voiceUsers?.forEach(s => {
      voiceUserSessionCounts[s.user_id] = (voiceUserSessionCounts[s.user_id] || 0) + 1;
    });

    // Count users with 2+ sessions (either chat or voice)
    const returnUsers = new Set<string>();
    [...uniqueChatUsers, ...uniqueVoiceUsers].forEach(userId => {
      const chatCount = chatUserSessionCounts[userId] || 0;
      const voiceCount = voiceUserSessionCounts[userId] || 0;
      if (chatCount + voiceCount >= 2) {
        returnUsers.add(userId);
      }
    });

    const aiAdoptionRate = totalUsers && totalUsers > 0
      ? (allAIUsers.size / totalUsers) * 100
      : 0;

    return {
      aiAdoptionRate,
      totalChatSessions: totalChatSessions || 0,
      totalVoiceSessions: totalVoiceSessions || 0,
      aiUserCount: allAIUsers.size,
      returnAIUsers: returnUsers.size,
    };
  },

  /**
   * Get pattern metrics (cooking time of day, language split)
   */
  async getPatternMetrics(): Promise<PatternMetrics> {
    // Cooking by hour (from cook_start events)
    const { data: cookEvents } = await supabase
      .from('user_events')
      .select('created_at')
      .eq('event_type', 'cook_start');

    const hourCounts: Record<number, number> = {};
    cookEvents?.forEach(e => {
      const hour = new Date(e.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const cookingByHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourCounts[i] || 0,
    }));

    // Language split
    const { data: languageData } = await supabase
      .from('user_profiles')
      .select('language');

    const languageCounts: Record<string, number> = {};
    languageData?.forEach(p => {
      const lang = p.language || 'en';
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    });

    const languageSplit = Object.entries(languageCounts)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    return {
      cookingByHour,
      languageSplit,
    };
  },

  /**
   * Get retention metrics (Day 1, 7, 30 retention)
   */
  async getRetentionMetrics(): Promise<RetentionMetrics> {
    const now = new Date();

    // Get all users with their signup dates
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, created_at');

    if (!users || users.length === 0) {
      return {
        day1Retention: 0,
        day7Retention: 0,
        day30Retention: 0,
        avgTimeToFirstCook: null,
        weeklyCookRate: 0,
      };
    }

    // Get all user events
    const { data: events } = await supabase
      .from('user_events')
      .select('user_id, created_at, event_type');

    // Group events by user
    const userEvents: Record<string, { dates: Date[]; firstCook: Date | null }> = {};
    events?.forEach(e => {
      if (!userEvents[e.user_id]) {
        userEvents[e.user_id] = { dates: [], firstCook: null };
      }
      const eventDate = new Date(e.created_at);
      userEvents[e.user_id].dates.push(eventDate);

      if (e.event_type === 'cook_complete' && !userEvents[e.user_id].firstCook) {
        userEvents[e.user_id].firstCook = eventDate;
      }
    });

    // Calculate retention for users who signed up at least N days ago
    let day1Eligible = 0, day1Retained = 0;
    let day7Eligible = 0, day7Retained = 0;
    let day30Eligible = 0, day30Retained = 0;
    const timeToFirstCooks: number[] = [];

    users.forEach(user => {
      const signupDate = new Date(user.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
      const userEventData = userEvents[user.id];

      // Day 1 retention (users who signed up at least 1 day ago)
      if (daysSinceSignup >= 1) {
        day1Eligible++;
        if (userEventData?.dates.some(d => {
          const daysSinceEvent = Math.floor((d.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceEvent >= 1 && daysSinceEvent < 2;
        })) {
          day1Retained++;
        }
      }

      // Day 7 retention
      if (daysSinceSignup >= 7) {
        day7Eligible++;
        if (userEventData?.dates.some(d => {
          const daysSinceEvent = Math.floor((d.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceEvent >= 1 && daysSinceEvent <= 7;
        })) {
          day7Retained++;
        }
      }

      // Day 30 retention
      if (daysSinceSignup >= 30) {
        day30Eligible++;
        if (userEventData?.dates.some(d => {
          const daysSinceEvent = Math.floor((d.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceEvent >= 1 && daysSinceEvent <= 30;
        })) {
          day30Retained++;
        }
      }

      // Time to first cook
      if (userEventData?.firstCook) {
        const daysToFirstCook = Math.floor(
          (userEventData.firstCook.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        timeToFirstCooks.push(daysToFirstCook);
      }
    });

    // Calculate weekly cook rate (avg cook_complete per active user per week)
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: weeklyCompletes } = await supabase
      .from('user_events')
      .select('user_id')
      .eq('event_type', 'cook_complete')
      .gte('created_at', formatDate(oneWeekAgo));

    const weeklyActiveUsers = new Set(weeklyCompletes?.map(e => e.user_id) || []);
    const weeklyCookRate = weeklyActiveUsers.size > 0
      ? (weeklyCompletes?.length || 0) / weeklyActiveUsers.size
      : 0;

    const avgTimeToFirstCook = timeToFirstCooks.length > 0
      ? timeToFirstCooks.reduce((a, b) => a + b, 0) / timeToFirstCooks.length
      : null;

    return {
      day1Retention: day1Eligible > 0 ? (day1Retained / day1Eligible) * 100 : 0,
      day7Retention: day7Eligible > 0 ? (day7Retained / day7Eligible) * 100 : 0,
      day30Retention: day30Eligible > 0 ? (day30Retained / day30Eligible) * 100 : 0,
      avgTimeToFirstCook,
      weeklyCookRate,
    };
  },
};

export default analyticsService;
