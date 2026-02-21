import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import {
  analyticsService,
  TimeframeFilter,
  OverviewMetrics,
  FunnelMetrics,
  TopRecipe,
  TopSearch,
  AIMetrics,
  AIUsageMetrics,
  AIChatSessionMetrics,
  PatternMetrics,
  RetentionMetrics,
} from '@/services/analyticsService';
import i18n from '@/i18n';

type TabType = 'overview' | 'funnel' | 'recipes' | 'searches' | 'ai' | 'patterns' | 'retention';

const TIMEFRAME_OPTIONS: { value: TimeframeFilter; labelKey: string }[] = [
  { value: 'today', labelKey: 'admin.analytics.timeframes.today' },
  { value: '7_days', labelKey: 'admin.analytics.timeframes.sevenDays' },
  { value: '30_days', labelKey: 'admin.analytics.timeframes.thirtyDays' },
  { value: 'all_time', labelKey: 'admin.analytics.timeframes.allTime' },
];

const TABS: { value: TabType; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'overview', labelKey: 'admin.analytics.tabs.overview', icon: 'stats-chart' },
  { value: 'retention', labelKey: 'admin.analytics.tabs.retention', icon: 'people' },
  { value: 'funnel', labelKey: 'admin.analytics.tabs.funnel', icon: 'funnel' },
  { value: 'recipes', labelKey: 'admin.analytics.tabs.recipes', icon: 'restaurant' },
  { value: 'searches', labelKey: 'admin.analytics.tabs.searches', icon: 'search' },
  { value: 'ai', labelKey: 'admin.analytics.tabs.ai', icon: 'sparkles' },
  { value: 'patterns', labelKey: 'admin.analytics.tabs.patterns', icon: 'time' },
];

function MetricCard({ title, value, subtitle, icon }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="bg-white rounded-lg p-md shadow-sm flex-1 min-w-[140px] m-xs">
      <View className="flex-row items-center mb-xs">
        {icon && (
          <Ionicons name={icon} size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
        )}
        <Text preset="caption" className="text-text-secondary">{title}</Text>
      </View>
      <Text preset="h1" className="text-text-default">{value}</Text>
      {subtitle && (
        <Text preset="caption" className="text-text-secondary mt-xxs">{subtitle}</Text>
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text preset="h2" className="text-text-default mb-md mt-lg">{children}</Text>
  );
}

function ListItem({ rank, label, value }: { rank: number; label: string; value: number }) {
  return (
    <View className="flex-row items-center py-sm px-md bg-white rounded-md mb-xs">
      <Text preset="body" className="text-text-secondary w-[30px]">{rank}.</Text>
      <Text preset="body" className="flex-1 text-text-default" numberOfLines={1}>{label}</Text>
      <Text preset="body" className="text-text-secondary font-semibold">{value}</Text>
    </View>
  );
}

function TimeframeSelector({ value, onChange }: {
  value: TimeframeFilter;
  onChange: (value: TimeframeFilter) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-xs mb-md">
      {TIMEFRAME_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          className={`px-md py-sm rounded-full ${value === option.value ? 'bg-primary-medium' : 'bg-white border border-border-default'
            }`}
          onPress={() => onChange(option.value)}
        >
          <Text
            preset="bodySmall"
            className={value === option.value ? 'text-text-default font-semibold' : 'text-text-secondary'}
          >
            {i18n.t(option.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TabSelector({ value, onChange }: {
  value: TabType;
  onChange: (value: TabType) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-md"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.value}
          className={`flex-row items-center px-md py-sm mr-xs rounded-lg ${value === tab.value ? 'bg-primary-default' : 'bg-white border border-border-default'
            }`}
          onPress={() => onChange(tab.value)}
        >
          <Ionicons
            name={tab.icon}
            size={16}
            color={value === tab.value ? COLORS.text.default : COLORS.text.secondary}
            style={{ marginRight: 4 }}
          />
          <Text
            preset="bodySmall"
            className={value === tab.value ? 'text-text-default font-semibold' : 'text-text-secondary'}
          >
            {i18n.t(tab.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function LoadingState() {
  return (
    <View className="items-center justify-center py-xxl">
      <ActivityIndicator size="large" color={COLORS.primary.DEFAULT} />
      <Text preset="body" className="text-text-secondary mt-md">{i18n.t('admin.analytics.loading')}</Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center justify-center py-xxl">
      <Ionicons name="alert-circle" size={48} color={COLORS.status.error} />
      <Text preset="body" className="text-text-default mt-md">{i18n.t('admin.analytics.error')}</Text>
      <TouchableOpacity
        className="mt-md px-lg py-sm bg-primary-medium rounded-lg"
        onPress={onRetry}
      >
        <Text preset="body" className="text-text-default font-semibold">{i18n.t('admin.analytics.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OverviewSection({ data }: { data: OverviewMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.activeUsers')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.dau')}
          value={data.dau}
          icon="today"
          subtitle={i18n.t('admin.analytics.labels.dailyActive')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.wau')}
          value={data.wau}
          icon="calendar"
          subtitle={i18n.t('admin.analytics.labels.weeklyActive')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.mau')}
          value={data.mau}
          icon="calendar-outline"
          subtitle={i18n.t('admin.analytics.labels.monthlyActive')}
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.users')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.totalSignups')}
          value={data.totalSignups}
          icon="people"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.onboardingRate')}
          value={`${data.onboardingRate.toFixed(1)}%`}
          icon="checkmark-circle"
          subtitle={i18n.t('admin.analytics.labels.onboardingSubtitle')}
        />
      </View>
    </View>
  );
}

function RetentionSection({ data }: { data: RetentionMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.retentionRates')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.day1')}
          value={`${data.day1Retention.toFixed(1)}%`}
          icon="time"
          subtitle={i18n.t('admin.analytics.labels.activeNextDay')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.day7')}
          value={`${data.day7Retention.toFixed(1)}%`}
          icon="calendar"
          subtitle={i18n.t('admin.analytics.labels.activeWithinWeek')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.day30')}
          value={`${data.day30Retention.toFixed(1)}%`}
          icon="calendar-outline"
          subtitle={i18n.t('admin.analytics.labels.activeWithinMonth')}
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.engagement')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.timeToFirstCook')}
          value={data.avgTimeToFirstCook !== null
            ? `${data.avgTimeToFirstCook.toFixed(1)} ${i18n.t('admin.analytics.labels.days')}`
            : i18n.t('admin.analytics.labels.notAvailable')}
          icon="timer"
          subtitle={i18n.t('admin.analytics.labels.average')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.weeklyCookRate')}
          value={data.weeklyCookRate.toFixed(1)}
          icon="flame"
          subtitle={i18n.t('admin.analytics.labels.cooksPerActiveUser')}
        />
      </View>
    </View>
  );
}

function FunnelSection({ data }: { data: FunnelMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.cookingFunnel')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.recipeViews')}
          value={data.totalViews}
          icon="eye"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.cookStarts')}
          value={data.totalStarts}
          icon="play"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.cookCompletes')}
          value={data.totalCompletes}
          icon="checkmark"
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.conversionRates')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.viewToStart')}
          value={`${data.viewToStartRate.toFixed(1)}%`}
          icon="arrow-forward"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.startToComplete')}
          value={`${data.startToCompleteRate.toFixed(1)}%`}
          icon="arrow-forward"
          subtitle={i18n.t('admin.analytics.labels.successRate')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.overall')}
          value={`${data.overallConversionRate.toFixed(1)}%`}
          icon="trending-up"
          subtitle={i18n.t('admin.analytics.labels.viewToComplete')}
        />
      </View>
    </View>
  );
}

function RecipesSection({ viewedRecipes, cookedRecipes }: {
  viewedRecipes: TopRecipe[] | null;
  cookedRecipes: TopRecipe[] | null;
}) {
  if (!viewedRecipes || !cookedRecipes) return <LoadingState />;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.mostViewed')}</SectionTitle>
      {viewedRecipes.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        viewedRecipes.map((recipe, index) => (
          <ListItem
            key={recipe.recipeId}
            rank={index + 1}
            label={recipe.recipeName}
            value={recipe.count}
          />
        ))
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.mostCooked')}</SectionTitle>
      {cookedRecipes.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        cookedRecipes.map((recipe, index) => (
          <ListItem
            key={recipe.recipeId}
            rank={index + 1}
            label={recipe.recipeName}
            value={recipe.count}
          />
        ))
      )}
    </View>
  );
}

function SearchesSection({ data }: { data: TopSearch[] | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.topSearches')}</SectionTitle>
      {data.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noSearchData')}</Text>
      ) : (
        data.map((search, index) => (
          <ListItem
            key={search.query}
            rank={index + 1}
            label={search.query}
            value={search.count}
          />
        ))
      )}
    </View>
  );
}

function AISection({
  adoptionData,
  usageData,
  chatSessionData,
}: {
  adoptionData: AIMetrics | null;
  usageData: AIUsageMetrics | null;
  chatSessionData: AIChatSessionMetrics | null;
}) {
  if (!adoptionData || !usageData) return <LoadingState />;

  const summary = usageData.summary;
  const maxDailyCost = Math.max(
    ...usageData.dailyCost.map((item) => item.cost),
    0.01
  );
  const formatUsd = (value: number) => `$${value.toFixed(2)}`;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.aiAdoption')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.adoptionRate')}
          value={`${adoptionData.aiAdoptionRate.toFixed(1)}%`}
          icon="sparkles"
          subtitle={i18n.t('admin.analytics.labels.usersWhoTriedAi')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.aiUsers')}
          value={adoptionData.aiUserCount}
          icon="people"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.returnUsers')}
          value={adoptionData.returnAIUsers}
          icon="repeat"
          subtitle={i18n.t('admin.analytics.labels.usedAiMultipleTimes')}
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.sessionCounts')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.chatSessions')}
          value={adoptionData.totalChatSessions}
          icon="chatbubbles"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.voiceSessions')}
          value={adoptionData.totalVoiceSessions}
          icon="mic"
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.aiCostsUsage')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.totalCost')}
          value={formatUsd(summary.totalCostUsd)}
          icon="cash"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.textCost')}
          value={formatUsd(summary.textCostUsd)}
          icon="chatbox"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.voiceCost')}
          value={formatUsd(summary.voiceCostUsd)}
          icon="mic-circle"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.totalTokens')}
          value={summary.textTokens.toLocaleString()}
          icon="stats-chart"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgTokensPerRequest')}
          value={summary.avgTokensPerRequest.toFixed(0)}
          icon="analytics"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgCostPerUser')}
          value={formatUsd(summary.avgCostPerUser)}
          icon="person"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgLatency')}
          value={`${summary.avgLatencyMs.toFixed(0)} ms`}
          icon="timer"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.errorRate')}
          value={`${summary.errorRate.toFixed(1)}%`}
          icon="alert-circle"
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.modelBreakdown')}</SectionTitle>
      {usageData.modelBreakdown.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        usageData.modelBreakdown.map((row, index) => (
          <ListItem
            key={`${row.model}:${index}`}
            rank={index + 1}
            label={`${row.model} • ${formatUsd(row.totalCostUsd)}`}
            value={row.requests}
          />
        ))
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.dailyCostTrend')}</SectionTitle>
      {usageData.dailyCost.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        <View className="bg-white rounded-lg p-md">
          {usageData.dailyCost.map((day) => {
            const widthPercent = Math.max((day.cost / maxDailyCost) * 100, 2);
            return (
              <View key={day.date} className="mb-sm">
                <View className="flex-row items-center justify-between mb-xxs">
                  <Text preset="caption" className="text-text-secondary">{day.date}</Text>
                  <Text preset="caption" className="text-text-default">{formatUsd(day.cost)}</Text>
                </View>
                <View className="h-[8px] bg-grey-light rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary-medium"
                    style={{ width: `${widthPercent}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.phaseBreakdown')}</SectionTitle>
      {usageData.phaseBreakdown.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        usageData.phaseBreakdown.map((row, index) => (
          <ListItem
            key={`${row.phase}:${index}`}
            rank={index + 1}
            label={`${row.phase} • ${row.errorRate.toFixed(1)}% ${i18n.t('admin.analytics.labels.errorRate').toLowerCase()}`}
            value={Math.round(row.avgTokens)}
          />
        ))
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.voiceUsage')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.voiceMinutes')}
          value={summary.voiceMinutes.toFixed(1)}
          icon="time"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.voiceSessions')}
          value={summary.voiceSessions}
          icon="mic"
        />
      </View>

      {chatSessionData && (
        <AIChatSessionDepthSection data={chatSessionData} />
      )}
    </View>
  );
}

function AIChatSessionDepthSection({ data }: { data: AIChatSessionMetrics }) {
  const maxDailySessions = Math.max(
    ...data.dailySessions.map((d) => d.sessions),
    1
  );

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.aiChatSessionDepth')}</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgMessagesPerSession')}
          value={data.avgMessagesPerSession}
          icon="chatbubbles"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgUserMessages')}
          value={data.avgUserMessagesPerSession}
          icon="person"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgAssistantMessages')}
          value={data.avgAssistantMessagesPerSession}
          icon="sparkles"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgSessionDuration')}
          value={`${data.avgSessionDurationMin} min`}
          icon="timer"
        />
      </View>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.qualifiedSessions')}
          value={data.totalSessions}
          icon="list"
        />
      </View>

      <SectionTitle>{i18n.t('admin.analytics.sections.messageDistribution')}</SectionTitle>
      {data.messageDistribution.map((bucket, index) => (
        <ListItem
          key={bucket.bucket}
          rank={index + 1}
          label={`${bucket.bucket} ${i18n.t('admin.analytics.labels.messages')}`}
          value={bucket.count}
        />
      ))}

      <SectionTitle>{i18n.t('admin.analytics.sections.toolUsage')}</SectionTitle>
      <ListItem rank={1} label={i18n.t('admin.analytics.labels.searchOnly')} value={data.toolUsage.withSearch} />
      <ListItem rank={2} label={i18n.t('admin.analytics.labels.generationOnly')} value={data.toolUsage.withGeneration} />
      <ListItem rank={3} label={i18n.t('admin.analytics.labels.searchAndGeneration')} value={data.toolUsage.withBoth} />
      <ListItem rank={4} label={i18n.t('admin.analytics.labels.chatOnly')} value={data.toolUsage.chatOnly} />

      <SectionTitle>{i18n.t('admin.analytics.sections.dailySessions')}</SectionTitle>
      {data.dailySessions.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        <View className="bg-white rounded-lg p-md">
          {data.dailySessions.map((day) => {
            const widthPercent = Math.max((day.sessions / maxDailySessions) * 100, 2);
            return (
              <View key={day.date} className="mb-sm">
                <View className="flex-row items-center justify-between mb-xxs">
                  <Text preset="caption" className="text-text-secondary">{day.date}</Text>
                  <Text preset="caption" className="text-text-default">{day.sessions}</Text>
                </View>
                <View className="h-[8px] bg-grey-light rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary-medium"
                    style={{ width: `${widthPercent}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.topUsers')}</SectionTitle>
      {data.topUsers.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        data.topUsers.map((user, index) => (
          <View key={user.userId} className="flex-row items-center py-sm px-md bg-white rounded-md mb-xs">
            <Text preset="body" className="text-text-secondary w-[30px]">{index + 1}.</Text>
            <Text preset="body" className="flex-1 text-text-default" numberOfLines={1}>
              {user.userId.substring(0, 8)}… • {user.sessions} {i18n.t('admin.analytics.labels.sessions')}
            </Text>
            <Text preset="body" className="text-text-secondary font-semibold">
              {user.totalMessages} {i18n.t('admin.analytics.labels.messages')}
            </Text>
          </View>
        ))
      )}

      <View className="mt-md px-md py-sm bg-white rounded-md">
        <Text
          preset="body"
          className={data.sessionsExceedingWindow > 0 ? 'text-status-error' : 'text-text-secondary'}
        >
          {data.sessionsExceedingWindow} {i18n.t('admin.analytics.labels.contextWindowExceeded')}
        </Text>
      </View>
    </View>
  );
}

function PatternsSection({ data }: { data: PatternMetrics | null }) {
  if (!data) return <LoadingState />;

  // Find peak cooking hours
  const sortedHours = [...data.cookingByHour].sort((a, b) => b.count - a.count);
  const peakHours = sortedHours.slice(0, 3).filter(h => h.count > 0);

  const formatHour = (hour: number) => {
    if (hour === 0) return `12 ${i18n.t('admin.analytics.labels.am')}`;
    if (hour === 12) return `12 ${i18n.t('admin.analytics.labels.pm')}`;
    if (hour < 12) return `${hour} ${i18n.t('admin.analytics.labels.am')}`;
    return `${hour - 12} ${i18n.t('admin.analytics.labels.pm')}`;
  };

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.peakCookingTimes')}</SectionTitle>
      {peakHours.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noCookingData')}</Text>
      ) : (
        <View className="flex-row flex-wrap">
          {peakHours.map((hour, index) => (
            <MetricCard
              key={hour.hour}
              title={i18n.t('admin.analytics.labels.rank', { rank: index + 1 })}
              value={formatHour(hour.hour)}
              icon="time"
              subtitle={i18n.t('admin.analytics.labels.cooks', { count: hour.count })}
            />
          ))}
        </View>
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.languageDistribution')}</SectionTitle>
      {data.languageSplit.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noUserData')}</Text>
      ) : (
        <View className="flex-row flex-wrap">
          {data.languageSplit.map((lang) => (
            <MetricCard
              key={lang.language}
              title={lang.language.toUpperCase()}
              value={lang.count}
              icon="globe"
              subtitle={i18n.t('admin.analytics.labels.users')}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('7_days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Data states
  const [overviewData, setOverviewData] = useState<OverviewMetrics | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionMetrics | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelMetrics | null>(null);
  const [viewedRecipes, setViewedRecipes] = useState<TopRecipe[] | null>(null);
  const [cookedRecipes, setCookedRecipes] = useState<TopRecipe[] | null>(null);
  const [searches, setSearches] = useState<TopSearch[] | null>(null);
  const [aiData, setAIData] = useState<AIMetrics | null>(null);
  const [aiUsageData, setAIUsageData] = useState<AIUsageMetrics | null>(null);
  const [aiChatSessionData, setAIChatSessionData] = useState<AIChatSessionMetrics | null>(null);
  const [patternsData, setPatternsData] = useState<PatternMetrics | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = () => setRetryKey(k => k + 1);

  // Load data based on active tab and timeframe
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        let result;
        switch (activeTab) {
          case 'overview':
            result = await analyticsService.getOverviewMetrics();
            if (!cancelled) setOverviewData(result);
            break;
          case 'retention':
            result = await analyticsService.getRetentionMetrics();
            if (!cancelled) setRetentionData(result);
            break;
          case 'funnel':
            result = await analyticsService.getFunnelMetrics(timeframe);
            if (!cancelled) setFunnelData(result);
            break;
          case 'recipes':
            const [viewed, cooked] = await Promise.all([
              analyticsService.getTopViewedRecipes(timeframe),
              analyticsService.getTopCookedRecipes(timeframe),
            ]);
            if (!cancelled) {
              setViewedRecipes(viewed);
              setCookedRecipes(cooked);
            }
            break;
          case 'searches':
            result = await analyticsService.getTopSearches(timeframe);
            if (!cancelled) setSearches(result);
            break;
          case 'ai':
            const [adoption, usage, aiChatSessions] = await Promise.all([
              analyticsService.getAIMetrics(timeframe),
              analyticsService.getAIUsageMetrics(timeframe),
              analyticsService.getAIChatSessionMetrics(timeframe),
            ]);
            if (!cancelled) {
              setAIData(adoption);
              setAIUsageData(usage);
              setAIChatSessionData(aiChatSessions);
            }
            break;
          case 'patterns':
            result = await analyticsService.getPatternMetrics();
            if (!cancelled) setPatternsData(result);
            break;
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading analytics:', err);
          setError(err instanceof Error ? err : new Error('Failed to load analytics'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [activeTab, timeframe, retryKey]);

  const showTimeframeFilter = ['funnel', 'recipes', 'searches', 'ai'].includes(activeTab);

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState onRetry={handleRetry} />;

    switch (activeTab) {
      case 'overview':
        return <OverviewSection data={overviewData} />;
      case 'retention':
        return <RetentionSection data={retentionData} />;
      case 'funnel':
        return <FunnelSection data={funnelData} />;
      case 'recipes':
        return <RecipesSection viewedRecipes={viewedRecipes} cookedRecipes={cookedRecipes} />;
      case 'searches':
        return <SearchesSection data={searches} />;
      case 'ai':
        return <AISection adoptionData={aiData} usageData={aiUsageData} chatSessionData={aiChatSessionData} />;
      case 'patterns':
        return <PatternsSection data={patternsData} />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout title={i18n.t('admin.analytics.title')}>
      <ScrollView
        className="flex-1 bg-background-default"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        <TabSelector value={activeTab} onChange={setActiveTab} />

        {showTimeframeFilter && (
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        )}

        {renderContent()}
      </ScrollView>
    </AdminLayout>
  );
}
