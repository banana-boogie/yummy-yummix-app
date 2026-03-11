import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import { TextInput } from '@/components/form/TextInput';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { FormSection } from '@/components/form/FormSection';
import { useActiveLocales, ActiveLocale } from '@/hooks/admin/useActiveLocales';
import { useRecipeTranslation } from '@/hooks/admin/useRecipeTranslation';
import { ExtendedRecipe } from '@/hooks/admin/useAdminRecipeForm';
import {
  AdminRecipeTranslation,
  AdminRecipeStepTranslation,
  AdminRecipeIngredientTranslation,
  AdminRecipeUsefulItemTranslation,
  pickTranslation,
  getTranslatedField,
} from '@/types/recipe.admin.types';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';

interface TranslationStepProps {
  recipe: ExtendedRecipe;
  authoringLocale: string;
  onUpdateRecipe: (updates: Partial<ExtendedRecipe>) => void;
}

type TranslationState = 'ready' | 'translating' | 'done';

export function TranslationStep({ recipe, authoringLocale, onUpdateRecipe }: TranslationStepProps) {
  const { locales } = useActiveLocales();
  const { translating, progress, error, failedLocales, translateAll } = useRecipeTranslation();
  const { isMobile } = useDevice();

  const [state, setState] = useState<TranslationState>('ready');
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [showEnWarning, setShowEnWarning] = useState(false);
  const [targetLocales, setTargetLocales] = useState<string[]>(() =>
    locales.filter(l => l.code !== authoringLocale).map(l => l.code)
  );

  // Ensure targetLocales updates when locales load
  React.useEffect(() => {
    if (locales.length > 0 && targetLocales.length === 0) {
      setTargetLocales(locales.filter(l => l.code !== authoringLocale).map(l => l.code));
    }
  }, [locales, authoringLocale]);

  // Count translatable fields
  const fieldCounts = useMemo(() => {
    const steps = recipe.steps || [];
    const ingredients = recipe.ingredients || [];
    const usefulItems = recipe.usefulItems || [];

    let recipeInfoFields = 0;
    const src = pickTranslation(recipe.translations, authoringLocale) as AdminRecipeTranslation | undefined;
    if (src?.name) recipeInfoFields++;
    if (src?.tipsAndTricks) recipeInfoFields++;

    let stepFields = 0;
    for (const step of steps) {
      const s = pickTranslation(step.translations, authoringLocale) as AdminRecipeStepTranslation | undefined;
      if (s?.instruction) stepFields++;
      if (s?.recipeSection) stepFields++;
      if (s?.tip) stepFields++;
    }

    let ingredientFields = 0;
    for (const ing of ingredients) {
      const s = pickTranslation(ing.translations, authoringLocale) as AdminRecipeIngredientTranslation | undefined;
      if (s?.notes) ingredientFields++;
      if (s?.tip) ingredientFields++;
      if (s?.recipeSection) ingredientFields++;
    }

    let usefulItemFields = 0;
    for (const item of usefulItems) {
      const s = pickTranslation(item.translations, authoringLocale) as AdminRecipeUsefulItemTranslation | undefined;
      if (s?.notes) usefulItemFields++;
    }

    return {
      recipeInfo: recipeInfoFields,
      steps: stepFields,
      ingredients: ingredientFields,
      usefulItems: usefulItemFields,
      total: recipeInfoFields + stepFields + ingredientFields + usefulItemFields,
    };
  }, [recipe, authoringLocale]);

  const targetLocaleObjects = locales.filter(l => l.code !== authoringLocale);

  const toggleTarget = (code: string) => {
    if (code === 'en' && targetLocales.includes('en')) {
      setShowEnWarning(true);
      return;
    }
    setTargetLocales(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleTranslateAll = async () => {
    if (targetLocales.length === 0) return;
    setState('translating');
    const updated = await translateAll(recipe, authoringLocale, targetLocales);
    onUpdateRecipe(updated);
    setState('done');
    // Auto-select first target for review
    if (!selectedLocale && targetLocales.length > 0) {
      setSelectedLocale(targetLocales[0]);
    }
  };

  const handleRetranslate = () => {
    setState('ready');
  };

  const sourceLocaleName = locales.find(l => l.code === authoringLocale)?.displayName || authoringLocale;

  // Pre-translation / translating view
  if (state === 'ready' || state === 'translating') {
    return (
      <FormSection title={i18n.t('admin.translate.translationStep')}>
        {/* Summary card */}
        <View className="bg-primary-lightest rounded-lg p-lg mb-lg">
          <View className="flex-row items-center gap-sm mb-md">
            <Ionicons name="language-outline" size={24} color={COLORS.primary.dark} />
            <Text preset="h3">{i18n.t('admin.translate.summary')}</Text>
          </View>

          <View className="flex-col gap-xs">
            <SummaryRow icon="document-text-outline" label={i18n.t('admin.translate.recipeInfo')} count={fieldCounts.recipeInfo} />
            <SummaryRow icon="list-outline" label={i18n.t('admin.translate.steps')} count={fieldCounts.steps} />
            <SummaryRow icon="basket-outline" label={i18n.t('admin.translate.ingredients')} count={fieldCounts.ingredients} />
            <SummaryRow icon="construct-outline" label={i18n.t('admin.translate.usefulItems')} count={fieldCounts.usefulItems} />
          </View>

          <View className="flex-row items-center gap-sm mt-lg">
            <Text preset="bodySmall" className="text-text-secondary">
              {i18n.t('admin.translate.source')}: {sourceLocaleName} → {i18n.t('admin.translate.target')}: {targetLocales.length} {i18n.t('admin.translate.languages')}
            </Text>
          </View>
        </View>

        {/* Target locale selection */}
        <View className="mb-lg">
          <Text preset="subheading" className="mb-sm">{i18n.t('admin.translate.targetLanguages')}</Text>
          <View className="flex-row flex-wrap gap-sm">
            {targetLocaleObjects.map(locale => {
              const isChecked = targetLocales.includes(locale.code);
              return (
                <TouchableOpacity
                  key={locale.code}
                  onPress={() => toggleTarget(locale.code)}
                  className={`flex-row items-center gap-xs px-md py-sm rounded-lg border ${
                    isChecked ? 'bg-primary-lightest border-primary-medium' : 'bg-background-default border-border-default'
                  }`}
                >
                  <Ionicons
                    name={isChecked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isChecked ? COLORS.primary.dark : COLORS.text.secondary}
                  />
                  <Text preset="body">{locale.displayName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Translate button or progress */}
        {state === 'translating' ? (
          <View className="items-center py-xl">
            <View className="w-full max-w-[300px] h-[6px] bg-grey-default rounded-round mt-sm overflow-hidden mb-md">
              <View
                className="h-full bg-primary-medium rounded-round"
                style={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </View>
            <Text preset="body" className="text-text-default">
              {i18n.t('admin.translate.translating')}... {progress ? `${progress.current}/${progress.total}` : ''}
            </Text>
            {progress?.label ? (
              <Text preset="caption" className="text-text-secondary mt-xs">{progress.label}</Text>
            ) : null}
          </View>
        ) : (
          <Button
            variant="primary"
            size="large"
            onPress={handleTranslateAll}
            disabled={targetLocales.length === 0 || fieldCounts.total === 0}
            icon={<Ionicons name="language" size={20} color={COLORS.neutral.WHITE} />}
            className="self-center"
          >
            {i18n.t('admin.translate.translateAll')}
          </Button>
        )}

        {error ? (
          <Text preset="bodySmall" className="text-status-error mt-md text-center">{error}</Text>
        ) : null}

        <AlertModal
          visible={showEnWarning}
          title={i18n.t('admin.translate.warningTitle')}
          message={i18n.t('admin.translate.enWarning')}
          onConfirm={() => {
            setTargetLocales(prev => prev.filter(c => c !== 'en'));
            setShowEnWarning(false);
          }}
          onCancel={() => setShowEnWarning(false)}
          confirmText={i18n.t('admin.translate.skipEnglish')}
          cancelText={i18n.t('admin.translate.keepEnglish')}
        />
      </FormSection>
    );
  }

  // Post-translation review view
  return (
    <FormSection title={i18n.t('admin.translate.translationStep')}>
      {/* Success banner */}
      <View className="flex-row items-center gap-sm bg-status-success/10 p-md rounded-lg mb-lg">
        <Ionicons name="checkmark-circle" size={24} color={COLORS.status.success} />
        <Text preset="body" className="text-status-success flex-1">
          {i18n.t('admin.translate.translationComplete')}
        </Text>
        <Button variant="outline" size="small" onPress={handleRetranslate}>
          {i18n.t('admin.translate.retranslate')}
        </Button>
      </View>

      {/* Partial failure warning */}
      {failedLocales.length > 0 ? (
        <View className="flex-row items-center gap-sm bg-status-error/10 p-md rounded-lg mb-lg">
          <Ionicons name="warning" size={20} color={COLORS.status.error} />
          <Text preset="bodySmall" className="text-status-error flex-1">
            {i18n.t('admin.translate.partialFailure', { locales: failedLocales.join(', ') })}
          </Text>
        </View>
      ) : null}

      {/* Language tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-lg">
        <View className="flex-row gap-xs">
          {targetLocales.map(code => {
            const locale = locales.find(l => l.code === code);
            const isActive = selectedLocale === code;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => setSelectedLocale(code)}
                className={`px-md py-sm rounded-round ${
                  isActive ? 'bg-primary-medium' : 'bg-background-default border border-border-default'
                }`}
              >
                <Text preset="bodySmall" fontWeight={isActive ? '600' : '400'}>
                  {locale?.displayName || code}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Translation review for selected locale */}
      {selectedLocale ? (
        <TranslationReview
          recipe={recipe}
          sourceLocale={authoringLocale}
          targetLocale={selectedLocale}
          onUpdateRecipe={onUpdateRecipe}
          isMobile={isMobile}
        />
      ) : null}
    </FormSection>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SummaryRow({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <View className="flex-row items-center gap-sm">
      <Ionicons name={icon as any} size={18} color={COLORS.text.secondary} />
      <Text preset="body" className="flex-1">{label}</Text>
      <Text preset="bodySmall" className="text-text-secondary">{count} {i18n.t('admin.translate.fields')}</Text>
    </View>
  );
}

function TranslationReview({
  recipe,
  sourceLocale,
  targetLocale,
  onUpdateRecipe,
  isMobile,
}: {
  recipe: ExtendedRecipe;
  sourceLocale: string;
  targetLocale: string;
  onUpdateRecipe: (updates: Partial<ExtendedRecipe>) => void;
  isMobile: boolean;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    recipeInfo: true,
    steps: false,
    ingredients: false,
    usefulItems: false,
  });

  const toggle = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const steps = recipe.steps || [];
  const ingredients = recipe.ingredients || [];
  const usefulItems = recipe.usefulItems || [];

  return (
    <View className="flex-col gap-md">
      {/* Recipe Info */}
      <CollapsibleSection
        title={i18n.t('admin.translate.recipeInfo')}
        isOpen={openSections.recipeInfo}
        onToggle={() => toggle('recipeInfo')}
      >
        <FieldPair
          label={i18n.t('admin.translate.fieldName', { defaultValue: 'Name' })}
          sourceValue={getTranslatedField(recipe.translations, sourceLocale, 'name')}
          targetValue={getTranslatedField(recipe.translations, targetLocale, 'name')}
          onTargetChange={(text) => {
            const updated = (recipe.translations || []).map(t =>
              t.locale === targetLocale ? { ...t, name: text } : t
            );
            onUpdateRecipe({ translations: updated });
          }}
          isMobile={isMobile}
        />
        <FieldPair
          label={i18n.t('admin.translate.fieldTipsAndTricks', { defaultValue: 'Tips & Tricks' })}
          sourceValue={getTranslatedField(recipe.translations, sourceLocale, 'tipsAndTricks')}
          targetValue={getTranslatedField(recipe.translations, targetLocale, 'tipsAndTricks')}
          onTargetChange={(text) => {
            const updated = (recipe.translations || []).map(t =>
              t.locale === targetLocale ? { ...t, tipsAndTricks: text } : t
            );
            onUpdateRecipe({ translations: updated });
          }}
          isMobile={isMobile}
          multiline
        />
      </CollapsibleSection>

      {/* Steps */}
      {steps.length > 0 ? (
        <CollapsibleSection
          title={`${i18n.t('admin.translate.steps')} (${steps.length})`}
          isOpen={openSections.steps}
          onToggle={() => toggle('steps')}
        >
          {steps.map((step, idx) => (
            <View key={step.id || idx} className="mb-md">
              <Text preset="bodySmall" fontWeight="600" className="mb-xs">
                {i18n.t('admin.recipes.form.stepsInfo.step')} {step.order || idx + 1}
              </Text>
              <FieldPair
                label={i18n.t('admin.recipes.form.stepsInfo.instruction')}
                sourceValue={getTranslatedField(step.translations, sourceLocale, 'instruction')}
                targetValue={getTranslatedField(step.translations, targetLocale, 'instruction')}
                onTargetChange={(text) => {
                  const updatedSteps = [...steps];
                  updatedSteps[idx] = {
                    ...step,
                    translations: step.translations.map(t =>
                      t.locale === targetLocale ? { ...t, instruction: text } : t
                    ),
                  };
                  onUpdateRecipe({ steps: updatedSteps });
                }}
                isMobile={isMobile}
                multiline
              />
            </View>
          ))}
        </CollapsibleSection>
      ) : null}

      {/* Ingredients */}
      {ingredients.length > 0 ? (
        <CollapsibleSection
          title={`${i18n.t('admin.translate.ingredients')} (${ingredients.length})`}
          isOpen={openSections.ingredients}
          onToggle={() => toggle('ingredients')}
        >
          {ingredients.map((ing, idx) => {
            const ingName = getTranslatedField(ing.ingredient?.translations, sourceLocale, 'name');
            const hasContent = getTranslatedField(ing.translations, sourceLocale, 'notes') ||
              getTranslatedField(ing.translations, sourceLocale, 'recipeSection');
            if (!hasContent) return null;
            return (
              <View key={ing.id || idx} className="mb-md">
                <Text preset="bodySmall" fontWeight="600" className="mb-xs">{ingName}</Text>
                {getTranslatedField(ing.translations, sourceLocale, 'recipeSection') ? (
                  <FieldPair
                    label={i18n.t('admin.translate.fieldSection', { defaultValue: 'Section' })}
                    sourceValue={getTranslatedField(ing.translations, sourceLocale, 'recipeSection')}
                    targetValue={getTranslatedField(ing.translations, targetLocale, 'recipeSection')}
                    onTargetChange={(text) => {
                      const updatedIngs = [...ingredients];
                      updatedIngs[idx] = {
                        ...ing,
                        translations: ing.translations.map(t =>
                          t.locale === targetLocale ? { ...t, recipeSection: text } : t
                        ),
                      };
                      onUpdateRecipe({ ingredients: updatedIngs });
                    }}
                    isMobile={isMobile}
                  />
                ) : null}
                {getTranslatedField(ing.translations, sourceLocale, 'notes') ? (
                  <FieldPair
                    label={i18n.t('admin.recipes.form.ingredientsInfo.notesTitle')}
                    sourceValue={getTranslatedField(ing.translations, sourceLocale, 'notes')}
                    targetValue={getTranslatedField(ing.translations, targetLocale, 'notes')}
                    onTargetChange={(text) => {
                      const updatedIngs = [...ingredients];
                      updatedIngs[idx] = {
                        ...ing,
                        translations: ing.translations.map(t =>
                          t.locale === targetLocale ? { ...t, notes: text } : t
                        ),
                      };
                      onUpdateRecipe({ ingredients: updatedIngs });
                    }}
                    isMobile={isMobile}
                  />
                ) : null}
              </View>
            );
          })}
        </CollapsibleSection>
      ) : null}

      {/* Useful Items */}
      {usefulItems.length > 0 ? (
        <CollapsibleSection
          title={`${i18n.t('admin.translate.usefulItems')} (${usefulItems.length})`}
          isOpen={openSections.usefulItems}
          onToggle={() => toggle('usefulItems')}
        >
          {usefulItems.map((item, idx) => {
            const itemName = getTranslatedField(item.usefulItem?.translations, sourceLocale, 'name');
            if (!getTranslatedField(item.translations, sourceLocale, 'notes')) return null;
            return (
              <View key={item.id || idx} className="mb-md">
                <Text preset="bodySmall" fontWeight="600" className="mb-xs">{itemName}</Text>
                <FieldPair
                  label={i18n.t('admin.translate.fieldNotes', { defaultValue: 'Notes' })}
                  sourceValue={getTranslatedField(item.translations, sourceLocale, 'notes')}
                  targetValue={getTranslatedField(item.translations, targetLocale, 'notes')}
                  onTargetChange={(text) => {
                    const updatedItems = [...usefulItems];
                    updatedItems[idx] = {
                      ...item,
                      translations: item.translations.map(t =>
                        t.locale === targetLocale ? { ...t, notes: text } : t
                      ),
                    };
                    onUpdateRecipe({ usefulItems: updatedItems });
                  }}
                  isMobile={isMobile}
                />
              </View>
            );
          })}
        </CollapsibleSection>
      ) : null}
    </View>
  );
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="border border-border-default rounded-lg overflow-hidden">
      <TouchableOpacity
        className="flex-row items-center justify-between p-md bg-background-default"
        onPress={onToggle}
      >
        <Text preset="subheading" fontWeight="600">{title}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.text.default} />
      </TouchableOpacity>
      {isOpen ? (
        <View className="p-md border-t border-border-default">{children}</View>
      ) : null}
    </View>
  );
}

function FieldPair({
  label,
  sourceValue,
  targetValue,
  onTargetChange,
  isMobile,
  multiline,
}: {
  label: string;
  sourceValue: string;
  targetValue: string;
  onTargetChange: (text: string) => void;
  isMobile: boolean;
  multiline?: boolean;
}) {
  if (!sourceValue) return null;

  return (
    <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-md mb-sm`}>
      {/* Source (read-only) */}
      <View className="flex-1">
        <Text preset="caption" className="text-text-secondary mb-xxs">{label} (source)</Text>
        <View className="bg-background-secondary rounded-md p-sm min-h-[44px]">
          <Text preset="body">{sourceValue}</Text>
        </View>
      </View>
      {/* Target (editable) */}
      <View className="flex-1">
        <Text preset="caption" className="text-text-secondary mb-xxs">{label}</Text>
        <TextInput
          value={targetValue}
          onChangeText={onTargetChange}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>
    </View>
  );
}
