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
  PatternMetrics,
  RetentionMetrics,
} from '@/services/analyticsService';

type TabType = 'overview' | 'funnel' | 'recipes' | 'searches' | 'ai' | 'patterns' | 'retention';

const TIMEFRAME_OPTIONS: { value: TimeframeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7_days', label: '7 Days' },
  { value: '30_days', label: '30 Days' },
  { value: 'all_time', label: 'All Time' },
];

const TABS: { value: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'overview', label: 'Overview', icon: 'stats-chart' },
  { value: 'retention', label: 'Retention', icon: 'people' },
  { value: 'funnel', label: 'Funnel', icon: 'funnel' },
  { value: 'recipes', label: 'Recipes', icon: 'restaurant' },
  { value: 'searches', label: 'Searches', icon: 'search' },
  { value: 'ai', label: 'AI', icon: 'sparkles' },
  { value: 'patterns', label: 'Patterns', icon: 'time' },
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
            {option.label}
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
            {tab.label}
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
      <Text preset="body" className="text-text-secondary mt-md">Loading analytics...</Text>
    </View>
  );
}

function OverviewSection({ data }: { data: OverviewMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>Active Users</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard title="DAU" value={data.dau} icon="today" subtitle="Daily Active" />
        <MetricCard title="WAU" value={data.wau} icon="calendar" subtitle="Weekly Active" />
        <MetricCard title="MAU" value={data.mau} icon="calendar-outline" subtitle="Monthly Active" />
      </View>

      <SectionTitle>Users</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard title="Total Signups" value={data.totalSignups} icon="people" />
        <MetricCard
          title="Onboarding Rate"
          value={`${data.onboardingRate.toFixed(1)}%`}
          icon="checkmark-circle"
          subtitle="Completed onboarding"
        />
      </View>
    </View>
  );
}

function RetentionSection({ data }: { data: RetentionMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>Retention Rates</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title="Day 1"
          value={`${data.day1Retention.toFixed(1)}%`}
          icon="time"
          subtitle="Active next day"
        />
        <MetricCard
          title="Day 7"
          value={`${data.day7Retention.toFixed(1)}%`}
          icon="calendar"
          subtitle="Active within week"
        />
        <MetricCard
          title="Day 30"
          value={`${data.day30Retention.toFixed(1)}%`}
          icon="calendar-outline"
          subtitle="Active within month"
        />
      </View>

      <SectionTitle>Engagement</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title="Time to First Cook"
          value={data.avgTimeToFirstCook !== null ? `${data.avgTimeToFirstCook.toFixed(1)} days` : 'N/A'}
          icon="timer"
          subtitle="Average"
        />
        <MetricCard
          title="Weekly Cook Rate"
          value={data.weeklyCookRate.toFixed(1)}
          icon="flame"
          subtitle="Cooks per active user"
        />
      </View>
    </View>
  );
}

function FunnelSection({ data }: { data: FunnelMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>Cooking Funnel</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard title="Recipe Views" value={data.totalViews} icon="eye" />
        <MetricCard title="Cook Starts" value={data.totalStarts} icon="play" />
        <MetricCard title="Cook Completes" value={data.totalCompletes} icon="checkmark" />
      </View>

      <SectionTitle>Conversion Rates</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title="View → Start"
          value={`${data.viewToStartRate.toFixed(1)}%`}
          icon="arrow-forward"
        />
        <MetricCard
          title="Start → Complete"
          value={`${data.startToCompleteRate.toFixed(1)}%`}
          icon="arrow-forward"
          subtitle="Success rate"
        />
        <MetricCard
          title="Overall"
          value={`${data.overallConversionRate.toFixed(1)}%`}
          icon="trending-up"
          subtitle="View → Complete"
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
      <SectionTitle>Most Viewed</SectionTitle>
      {viewedRecipes.length === 0 ? (
        <Text preset="body" className="text-text-secondary">No data yet</Text>
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

      <SectionTitle>Most Cooked</SectionTitle>
      {cookedRecipes.length === 0 ? (
        <Text preset="body" className="text-text-secondary">No data yet</Text>
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
      <SectionTitle>Top Searches</SectionTitle>
      {data.length === 0 ? (
        <Text preset="body" className="text-text-secondary">No search data yet</Text>
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

function AISection({ data }: { data: AIMetrics | null }) {
  if (!data) return <LoadingState />;

  return (
    <View>
      <SectionTitle>AI Feature Adoption</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title="Adoption Rate"
          value={`${data.aiAdoptionRate.toFixed(1)}%`}
          icon="sparkles"
          subtitle="Users who tried AI"
        />
        <MetricCard
          title="AI Users"
          value={data.aiUserCount}
          icon="people"
        />
        <MetricCard
          title="Return Users"
          value={data.returnAIUsers}
          icon="repeat"
          subtitle="Used AI 2+ times"
        />
      </View>

      <SectionTitle>Session Counts</SectionTitle>
      <View className="flex-row flex-wrap">
        <MetricCard
          title="Chat Sessions"
          value={data.totalChatSessions}
          icon="chatbubbles"
        />
        <MetricCard
          title="Voice Sessions"
          value={data.totalVoiceSessions}
          icon="mic"
        />
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
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <View>
      <SectionTitle>Peak Cooking Times</SectionTitle>
      {peakHours.length === 0 ? (
        <Text preset="body" className="text-text-secondary">No cooking data yet</Text>
      ) : (
        <View className="flex-row flex-wrap">
          {peakHours.map((hour, index) => (
            <MetricCard
              key={hour.hour}
              title={`#${index + 1}`}
              value={formatHour(hour.hour)}
              icon="time"
              subtitle={`${hour.count} cooks`}
            />
          ))}
        </View>
      )}

      <SectionTitle>Language Distribution</SectionTitle>
      {data.languageSplit.length === 0 ? (
        <Text preset="body" className="text-text-secondary">No user data yet</Text>
      ) : (
        <View className="flex-row flex-wrap">
          {data.languageSplit.map((lang) => (
            <MetricCard
              key={lang.language}
              title={lang.language.toUpperCase()}
              value={lang.count}
              icon="globe"
              subtitle="users"
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

  // Data states
  const [overviewData, setOverviewData] = useState<OverviewMetrics | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionMetrics | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelMetrics | null>(null);
  const [viewedRecipes, setViewedRecipes] = useState<TopRecipe[] | null>(null);
  const [cookedRecipes, setCookedRecipes] = useState<TopRecipe[] | null>(null);
  const [searches, setSearches] = useState<TopSearch[] | null>(null);
  const [aiData, setAIData] = useState<AIMetrics | null>(null);
  const [patternsData, setPatternsData] = useState<PatternMetrics | null>(null);

  // Load data based on active tab and timeframe
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case 'overview':
            const overview = await analyticsService.getOverviewMetrics();
            setOverviewData(overview);
            break;
          case 'retention':
            const retention = await analyticsService.getRetentionMetrics();
            setRetentionData(retention);
            break;
          case 'funnel':
            const funnel = await analyticsService.getFunnelMetrics(timeframe);
            setFunnelData(funnel);
            break;
          case 'recipes':
            const [viewed, cooked] = await Promise.all([
              analyticsService.getTopViewedRecipes(timeframe),
              analyticsService.getTopCookedRecipes(timeframe),
            ]);
            setViewedRecipes(viewed);
            setCookedRecipes(cooked);
            break;
          case 'searches':
            const searchData = await analyticsService.getTopSearches(timeframe);
            setSearches(searchData);
            break;
          case 'ai':
            const ai = await analyticsService.getAIMetrics();
            setAIData(ai);
            break;
          case 'patterns':
            const patterns = await analyticsService.getPatternMetrics();
            setPatternsData(patterns);
            break;
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab, timeframe]);

  const showTimeframeFilter = ['funnel', 'recipes', 'searches'].includes(activeTab);

  const renderContent = () => {
    if (loading) return <LoadingState />;

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
        return <AISection data={aiData} />;
      case 'patterns':
        return <PatternsSection data={patternsData} />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout title="Analytics">
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
