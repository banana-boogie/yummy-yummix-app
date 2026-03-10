import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart, DonutChart } from '@/components/admin/charts';
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
  RetentionMetrics,
  DailySignups,
  DailyActiveUsers,
  DailyAIUsers,
  ContentSourceSplit,
} from '@/services/analyticsService';
import i18n from '@/i18n';

type TabType = 'overview' | 'content' | 'ai' | 'operations';

const TIMEFRAME_OPTIONS: { value: TimeframeFilter; labelKey: string }[] = [
  { value: 'today', labelKey: 'admin.analytics.timeframes.today' },
  { value: '7_days', labelKey: 'admin.analytics.timeframes.sevenDays' },
  { value: '30_days', labelKey: 'admin.analytics.timeframes.thirtyDays' },
  { value: 'all_time', labelKey: 'admin.analytics.timeframes.allTime' },
];

const TABS: { value: TabType; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'overview', labelKey: 'admin.analytics.tabs.overview', icon: 'stats-chart' },
  { value: 'content', labelKey: 'admin.analytics.tabs.content', icon: 'restaurant' },
  { value: 'ai', labelKey: 'admin.analytics.tabs.ai', icon: 'sparkles' },
  { value: 'operations', labelKey: 'admin.analytics.tabs.operations', icon: 'construct' },
];

function MetricCard({ title, value, subtitle, icon, tooltip }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tooltip?: string;
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
      {tooltip && (
        <Text preset="caption" className="text-text-secondary mt-xs">{tooltip}</Text>
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

function RecipeListItem({ rank, recipe }: { rank: number; recipe: TopRecipe }) {
  const router = useRouter();
  const isUserRecipe = recipe.source === 'user';
  const route = isUserRecipe
    ? `/admin/user-recipes/${recipe.recipeId}`
    : `/admin/recipes/${recipe.recipeId}`;

  return (
    <TouchableOpacity
      className="flex-row items-center py-sm px-md bg-white rounded-md mb-xs"
      onPress={() => router.push(route as never)}
    >
      <Text preset="body" className="text-text-secondary w-[30px]">{rank}.</Text>
      <View className="flex-1">
        <Text preset="body" className="text-text-default" numberOfLines={1}>{recipe.recipeName}</Text>
        {isUserRecipe && recipe.userName && (
          <Text preset="caption" className="text-text-secondary">
            {i18n.t('admin.analytics.labels.aiGenerated')} • {recipe.userName}
          </Text>
        )}
      </View>
      <View className="flex-row items-center">
        <Text preset="body" className="text-text-secondary font-semibold mr-xs">{recipe.count}</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.text.secondary} />
      </View>
    </TouchableOpacity>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} className="flex-row items-center mt-lg mb-md">
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color={COLORS.text.default}
          style={{ marginRight: 8 }}
        />
        <Text preset="h2">{title}</Text>
      </TouchableOpacity>
      {expanded && children}
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

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <View className="items-center justify-center py-xxl">
      <Ionicons name="alert-circle" size={48} color={COLORS.status.error} />
      <Text preset="body" className="text-text-default mt-md">{i18n.t('admin.analytics.error')}</Text>
      {error?.message && (
        <Text preset="caption" className="text-text-secondary mt-xs px-lg text-center">{error.message}</Text>
      )}
      <TouchableOpacity
        className="mt-md px-lg py-sm bg-primary-medium rounded-lg"
        onPress={onRetry}
      >
        <Text preset="body" className="text-text-default font-semibold">{i18n.t('admin.analytics.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OverviewSection({
  overviewData,
  retentionData,
  dailySignups,
  dailyActiveUsers,
}: {
  overviewData: OverviewMetrics | null;
  retentionData: RetentionMetrics | null;
  dailySignups: DailySignups[] | null;
  dailyActiveUsers: DailyActiveUsers[] | null;
}) {
  if (!overviewData || !retentionData) return <LoadingState />;

  return (
    <View>
      {dailySignups && dailySignups.length > 0 && (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.dailySignups')}</SectionTitle>
          <BarChart
            data={dailySignups.map((d) => ({
              label: d.date.slice(5),
              values: [
                { value: d.signups, color: COLORS.primary.medium },
                { value: d.onboarded, color: COLORS.status.success },
              ],
            }))}
          />
          <View className="flex-row gap-md mt-xs px-md">
            <View className="flex-row items-center gap-xs">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary.medium }} />
              <Text preset="caption" className="text-text-secondary">{i18n.t('admin.analytics.labels.signups')}</Text>
            </View>
            <View className="flex-row items-center gap-xs">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.status.success }} />
              <Text preset="caption" className="text-text-secondary">{i18n.t('admin.analytics.labels.onboarded')}</Text>
            </View>
          </View>
        </>
      )}

      {dailyActiveUsers && dailyActiveUsers.length > 0 && (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.dailyActiveUsers')}</SectionTitle>
          <LineChart
            data={dailyActiveUsers.map((d) => ({
              label: d.date.slice(5),
              value: d.users,
            }))}
          />
        </>
      )}

      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.dau')}
          value={overviewData.dau}
          icon="today"
          subtitle={i18n.t('admin.analytics.labels.dailyActive')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.wau')}
          value={overviewData.wau}
          icon="calendar"
          subtitle={i18n.t('admin.analytics.labels.weeklyActive')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.mau')}
          value={overviewData.mau}
          icon="calendar-outline"
          subtitle={i18n.t('admin.analytics.labels.monthlyActive')}
        />
      </View>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.totalSignups')}
          value={overviewData.totalSignups}
          icon="people"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.onboardingRate')}
          value={`${overviewData.onboardingRate.toFixed(1)}%`}
          icon="checkmark-circle"
          subtitle={i18n.t('admin.analytics.labels.onboardingSubtitle')}
        />
      </View>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.day1')}
          value={`${retentionData.day1Retention.toFixed(1)}%`}
          icon="time"
          subtitle={i18n.t('admin.analytics.labels.activeNextDay')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.day7')}
          value={`${retentionData.day7Retention.toFixed(1)}%`}
          icon="calendar"
          subtitle={i18n.t('admin.analytics.labels.activeWithinWeek')}
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.day30')}
          value={`${retentionData.day30Retention.toFixed(1)}%`}
          icon="calendar-outline"
          subtitle={i18n.t('admin.analytics.labels.activeWithinMonth')}
        />
      </View>
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.timeToFirstCook')}
          value={retentionData.avgTimeToFirstCook !== null
            ? `${retentionData.avgTimeToFirstCook.toFixed(1)} ${i18n.t('admin.analytics.labels.days')}`
            : i18n.t('admin.analytics.labels.notAvailable')}
          icon="timer"
          subtitle={i18n.t('admin.analytics.labels.average')}
        />
      </View>
    </View>
  );
}

function ContentSection({
  funnelData,
  cookedRecipes,
  searches,
  viewedRecipes,
  contentSourceSplit,
}: {
  funnelData: FunnelMetrics | null;
  cookedRecipes: TopRecipe[] | null;
  searches: TopSearch[] | null;
  viewedRecipes: TopRecipe[] | null;
  contentSourceSplit: ContentSourceSplit | null;
}) {
  if (!funnelData || !cookedRecipes || !searches || !viewedRecipes) return <LoadingState />;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.cookingCompletion')}</SectionTitle>
      <BarChart
        horizontal
        data={[
          {
            label: i18n.t('admin.analytics.labels.cookStarts'),
            values: [{ value: funnelData.totalStarts, color: COLORS.primary.medium }],
          },
          {
            label: i18n.t('admin.analytics.labels.cookCompletes'),
            values: [{ value: funnelData.totalCompletes, color: COLORS.status.success }],
          },
        ]}
      />
      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.completionRate')}
          value={`${funnelData.completionRate.toFixed(1)}%`}
          icon="checkmark-circle"
          tooltip={i18n.t('admin.analytics.labels.completionRateTooltip')}
        />
      </View>

      {funnelData.catalogViews > 0 && (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.catalogConversion')}</SectionTitle>
          <View className="flex-row flex-wrap">
            <MetricCard
              title={i18n.t('admin.analytics.labels.catalogViews')}
              value={funnelData.catalogViews}
              icon="eye"
            />
            <MetricCard
              title={i18n.t('admin.analytics.labels.catalogStarts')}
              value={funnelData.catalogStarts}
              icon="play"
            />
            <MetricCard
              title={i18n.t('admin.analytics.labels.catalogConversionRate')}
              value={`${funnelData.catalogConversionRate.toFixed(1)}%`}
              icon="arrow-forward"
              tooltip={i18n.t('admin.analytics.labels.catalogConversionTooltip')}
            />
          </View>
        </>
      )}

      {contentSourceSplit && (contentSourceSplit.catalog > 0 || contentSourceSplit.userGenerated > 0) && (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.catalogVsAi')}</SectionTitle>
          <DonutChart
            data={[
              { label: i18n.t('admin.analytics.labels.catalog'), value: contentSourceSplit.catalog, color: COLORS.primary.medium },
              { label: i18n.t('admin.analytics.labels.userGeneratedRecipes'), value: contentSourceSplit.userGenerated, color: COLORS.status.success },
            ]}
          />
        </>
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.mostCooked')}</SectionTitle>
      {cookedRecipes.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        cookedRecipes.map((recipe, index) => (
          <RecipeListItem key={recipe.recipeId} rank={index + 1} recipe={recipe} />
        ))
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.mostViewed')}</SectionTitle>
      {viewedRecipes.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
      ) : (
        viewedRecipes.map((recipe, index) => (
          <RecipeListItem key={recipe.recipeId} rank={index + 1} recipe={recipe} />
        ))
      )}

      <SectionTitle>{i18n.t('admin.analytics.sections.topSearches')}</SectionTitle>
      {searches.length === 0 ? (
        <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noSearchData')}</Text>
      ) : (
        searches.map((search, index) => (
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
  dailyAIUsers,
}: {
  adoptionData: AIMetrics | null;
  usageData: AIUsageMetrics | null;
  dailyAIUsers: DailyAIUsers[] | null;
}) {
  if (!adoptionData || !usageData) return <LoadingState />;

  const summary = usageData.summary;
  const formatUsd = (value: number) => `$${value.toFixed(2)}`;

  return (
    <View>
      {dailyAIUsers && dailyAIUsers.length > 0 && (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.dailyAiUsers')}</SectionTitle>
          <LineChart
            data={dailyAIUsers.map((d) => ({
              label: d.date.slice(5),
              value: d.users,
            }))}
            lineColor={COLORS.primary.darkest}
            fillColor={COLORS.primary.default}
          />
        </>
      )}

      {(adoptionData.totalChatSessions + adoptionData.totalVoiceSessions) >= 5 ? (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.chatVsVoice')}</SectionTitle>
          <DonutChart
            data={[
              { label: i18n.t('admin.analytics.labels.chatSessions'), value: adoptionData.totalChatSessions, color: COLORS.primary.medium },
              { label: i18n.t('admin.analytics.labels.voiceSessions'), value: adoptionData.totalVoiceSessions, color: COLORS.status.success },
            ]}
          />
        </>
      ) : (
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
      )}

      {(summary.textCostUsd + summary.voiceCostUsd) >= 0.01 ? (
        <>
          <SectionTitle>{i18n.t('admin.analytics.sections.textVsVoiceCost')}</SectionTitle>
          <DonutChart
            data={[
              { label: i18n.t('admin.analytics.labels.textCost'), value: summary.textCostUsd, color: COLORS.primary.medium },
              { label: i18n.t('admin.analytics.labels.voiceCost'), value: summary.voiceCostUsd, color: COLORS.status.success },
            ]}
            valueFormatter={(v) => `$${v.toFixed(2)}`}
          />
        </>
      ) : (
        <View className="flex-row flex-wrap">
          <MetricCard
            title={i18n.t('admin.analytics.labels.textCost')}
            value={`$${summary.textCostUsd.toFixed(2)}`}
            icon="document-text"
          />
          <MetricCard
            title={i18n.t('admin.analytics.labels.voiceCost')}
            value={`$${summary.voiceCostUsd.toFixed(2)}`}
            icon="mic"
          />
        </View>
      )}

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

      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.totalCost')}
          value={formatUsd(summary.totalCostUsd)}
          icon="cash"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgCostPerUser')}
          value={formatUsd(summary.avgCostPerUser)}
          icon="person"
        />
      </View>

      <View className="flex-row flex-wrap">
        <MetricCard
          title={i18n.t('admin.analytics.labels.voiceSessions')}
          value={summary.voiceSessions}
          icon="mic"
        />
        <MetricCard
          title={i18n.t('admin.analytics.labels.voiceMinutes')}
          value={summary.voiceMinutes.toFixed(1)}
          icon="time"
        />
      </View>

      <CollapsibleSection title={i18n.t('admin.analytics.sections.details')}>
        <SectionTitle>{i18n.t('admin.analytics.sections.dailyCostTrend')}</SectionTitle>
        {usageData.dailyCost.length === 0 ? (
          <Text preset="body" className="text-text-secondary">{i18n.t('admin.analytics.labels.noDataYet')}</Text>
        ) : (
          <LineChart
            data={usageData.dailyCost.map((day) => ({
              label: day.date.slice(5),
              value: day.cost,
            }))}
            lineColor={COLORS.status.error}
            fillColor={COLORS.primary.medium}
            valueFormatter={(v) => `$${v.toFixed(2)}`}
          />
        )}
      </CollapsibleSection>
    </View>
  );
}

function OperationsSection({
  usageData,
  chatSessionData,
}: {
  usageData: AIUsageMetrics | null;
  chatSessionData: AIChatSessionMetrics | null;
}) {
  if (!usageData) return <LoadingState />;

  const summary = usageData.summary;
  const formatUsd = (value: number) => `$${value.toFixed(2)}`;

  return (
    <View>
      <SectionTitle>{i18n.t('admin.analytics.sections.operationsHealth')}</SectionTitle>
      <View className="flex-row flex-wrap">
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
        <MetricCard
          title={i18n.t('admin.analytics.labels.avgTokensPerRequest')}
          value={summary.avgTokensPerRequest.toFixed(0)}
          icon="analytics"
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

      {chatSessionData && (
        <CollapsibleSection title={i18n.t('admin.analytics.sections.details')}>
          <AIChatSessionDepthSection data={chatSessionData} />
        </CollapsibleSection>
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
              {user.displayName} ({user.userId.slice(-4)}) • {user.sessions} {i18n.t('admin.analytics.labels.sessions')}
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

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('7_days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Overview tab data
  const [overviewData, setOverviewData] = useState<OverviewMetrics | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionMetrics | null>(null);
  const [dailySignups, setDailySignups] = useState<DailySignups[] | null>(null);
  const [dailyActiveUsers, setDailyActiveUsers] = useState<DailyActiveUsers[] | null>(null);

  // Content tab data
  const [funnelData, setFunnelData] = useState<FunnelMetrics | null>(null);
  const [viewedRecipes, setViewedRecipes] = useState<TopRecipe[] | null>(null);
  const [cookedRecipes, setCookedRecipes] = useState<TopRecipe[] | null>(null);
  const [searches, setSearches] = useState<TopSearch[] | null>(null);
  const [contentSourceSplit, setContentSourceSplit] = useState<ContentSourceSplit | null>(null);

  // AI tab data
  const [aiData, setAIData] = useState<AIMetrics | null>(null);
  const [aiUsageData, setAIUsageData] = useState<AIUsageMetrics | null>(null);
  const [dailyAIUsers, setDailyAIUsers] = useState<DailyAIUsers[] | null>(null);

  // Operations tab data
  const [opsUsageData, setOpsUsageData] = useState<AIUsageMetrics | null>(null);
  const [opsChatSessionData, setOpsChatSessionData] = useState<AIChatSessionMetrics | null>(null);

  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = () => setRetryKey(k => k + 1);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        switch (activeTab) {
          case 'overview': {
            const [overview, retention, signups, dau] = await Promise.all([
              analyticsService.getOverviewMetrics(),
              analyticsService.getRetentionMetrics(),
              analyticsService.getDailySignups(timeframe),
              analyticsService.getDailyActiveUsers(timeframe),
            ]);
            if (!cancelled) {
              setOverviewData(overview);
              setRetentionData(retention);
              setDailySignups(signups);
              setDailyActiveUsers(dau);
            }
            break;
          }
          case 'content': {
            const [funnel, cooked, viewed, searchResults, sourceSplit] = await Promise.all([
              analyticsService.getFunnelMetrics(timeframe),
              analyticsService.getTopCookedRecipes(timeframe),
              analyticsService.getTopViewedRecipes(timeframe),
              analyticsService.getTopSearches(timeframe),
              analyticsService.getContentSourceSplit(timeframe),
            ]);
            if (!cancelled) {
              setFunnelData(funnel);
              setCookedRecipes(cooked);
              setViewedRecipes(viewed);
              setSearches(searchResults);
              setContentSourceSplit(sourceSplit);
            }
            break;
          }
          case 'ai': {
            const [adoption, usage, aiUsers] = await Promise.all([
              analyticsService.getAIMetrics(timeframe),
              analyticsService.getAIUsageMetrics(timeframe),
              analyticsService.getDailyAIUsers(timeframe),
            ]);
            if (!cancelled) {
              setAIData(adoption);
              setAIUsageData(usage);
              setDailyAIUsers(aiUsers);
            }
            break;
          }
          case 'operations': {
            const [usage, chatSessions] = await Promise.all([
              analyticsService.getAIUsageMetrics(timeframe),
              analyticsService.getAIChatSessionMetrics(timeframe),
            ]);
            if (!cancelled) {
              setOpsUsageData(usage);
              setOpsChatSessionData(chatSessions);
            }
            break;
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading analytics:', err);
          const message = err instanceof Error ? err.message : (err as { message?: string })?.message || JSON.stringify(err);
          setError(new Error(message));
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

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={handleRetry} />;

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewSection
            overviewData={overviewData}
            retentionData={retentionData}
            dailySignups={dailySignups}
            dailyActiveUsers={dailyActiveUsers}
          />
        );
      case 'content':
        return (
          <ContentSection
            funnelData={funnelData}
            cookedRecipes={cookedRecipes}
            searches={searches}
            viewedRecipes={viewedRecipes}
            contentSourceSplit={contentSourceSplit}
          />
        );
      case 'ai':
        return (
          <AISection
            adoptionData={aiData}
            usageData={aiUsageData}
            dailyAIUsers={dailyAIUsers}
          />
        );
      case 'operations':
        return (
          <OperationsSection
            usageData={opsUsageData}
            chatSessionData={opsChatSessionData}
          />
        );
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
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        {renderContent()}
      </ScrollView>
    </AdminLayout>
  );
}
