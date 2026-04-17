import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { FormSection } from '@/components/form/FormSection';
import { FormGroup } from '@/components/form/FormGroup';
import { SelectInput, SelectOption } from '@/components/form/SelectInput';
import { TextInput } from '@/components/form/TextInput';
import {
  AdminRecipe,
  AdminRecipePairing,
  PairingRole,
  pickTranslation,
} from '@/types/recipe.admin.types';
import { PlannerRole } from '@/types/recipe.types';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { COLORS } from '@/constants/design-tokens';
import logger from '@/services/logger';

const PAIRING_ROLES: PairingRole[] = [
  'side',
  'base',
  'veg',
  'dessert',
  'beverage',
  'condiment',
  'leftover_transform',
];

const DIRECT_ROLE_MAP: ReadonlySet<PlannerRole> = new Set<PlannerRole>([
  'side',
  'dessert',
  'beverage',
  'condiment',
]);

const isWeb = Platform.OS === 'web';

interface PairingsSectionProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  displayLocale: string;
}

export function PairingsSection({
  recipe,
  onUpdateRecipe,
  displayLocale,
}: PairingsSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const pairings = recipe.pairings ?? [];

  const roleOptions: SelectOption[] = useMemo(
    () =>
      PAIRING_ROLES.map((role) => ({
        label: i18n.t(`admin.recipes.form.mealPlanning.pairings.roles.${role}`),
        value: role,
      })),
    [],
  );

  const updatePairing = useCallback(
    (index: number, changes: Partial<AdminRecipePairing>) => {
      const next = pairings.map((p, i) => (i === index ? { ...p, ...changes } : p));
      onUpdateRecipe({ pairings: next });
    },
    [pairings, onUpdateRecipe],
  );

  const removePairing = useCallback(
    (index: number) => {
      const next = pairings.filter((_, i) => i !== index);
      onUpdateRecipe({ pairings: next });
    },
    [pairings, onUpdateRecipe],
  );

  const addPairing = useCallback(
    (pick: {
      id: string;
      name: string;
      imageUrl?: string | null;
      plannerRole?: PlannerRole | null;
    }) => {
      const defaultRole: PairingRole | null =
        pick.plannerRole && DIRECT_ROLE_MAP.has(pick.plannerRole)
          ? (pick.plannerRole as PairingRole)
          : null;
      const next: AdminRecipePairing[] = [
        ...pairings,
        {
          sourceRecipeId: recipe.id ?? '',
          targetRecipeId: pick.id,
          pairingRole: defaultRole,
          reason: null,
          targetName: pick.name,
          targetImageUrl: pick.imageUrl ?? null,
          targetPlannerRole: pick.plannerRole ?? null,
        },
      ];
      onUpdateRecipe({ pairings: next });
    },
    [pairings, onUpdateRecipe, recipe.id],
  );

  const sectionTitle = i18n.t('admin.recipes.form.mealPlanning.pairings.title');

  // New recipe (no id yet): render the empty-state CTA.
  if (!recipe.id) {
    return (
      <FormSection title={sectionTitle} headerVariant="prominent">
        <View className="p-lg rounded-xl border border-dashed border-primary-medium bg-primary-lightest">
          <Text preset="body" className="text-text-secondary">
            {i18n.t('admin.recipes.form.mealPlanning.pairings.emptyBeforeSave')}
          </Text>
        </View>
      </FormSection>
    );
  }

  return (
    <FormSection title={sectionTitle} headerVariant="prominent">
      <View className="gap-md">
        {pairings.length === 0 ? (
          <Text preset="bodySmall" className="text-text-secondary">
            {i18n.t('admin.recipes.form.mealPlanning.pairings.noneYet')}
          </Text>
        ) : (
          pairings.map((p, idx) => (
            <PairingCard
              key={p.id ?? `new-${idx}-${p.targetRecipeId}`}
              pairing={p}
              roleOptions={roleOptions}
              onChange={(changes) => updatePairing(idx, changes)}
              onRemove={() => removePairing(idx)}
            />
          ))
        )}

        <Button
          variant="outline"
          size="small"
          onPress={() => setPickerOpen(true)}
          label={i18n.t('admin.recipes.form.mealPlanning.pairings.addCta')}
        />
      </View>

      {pickerOpen ? (
        <PairingPickerModal
          sourceRecipeId={recipe.id}
          existingPairings={pairings}
          displayLocale={displayLocale}
          onPick={(pick) => {
            addPairing(pick);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </FormSection>
  );
}

interface PairingCardProps {
  pairing: AdminRecipePairing;
  roleOptions: SelectOption[];
  onChange: (changes: Partial<AdminRecipePairing>) => void;
  onRemove: () => void;
}

function PairingCard({ pairing, roleOptions, onChange, onRemove }: PairingCardProps) {
  const missingRole = !pairing.pairingRole;
  return (
    <View
      className={`p-md rounded-lg border bg-white ${
        missingRole ? 'border-status-error/50' : 'border-primary-default'
      }`}
    >
      <View className="flex-row items-start gap-md">
        <View className="flex-1">
          <Text preset="body" className="text-text-default font-semibold">
            {pairing.targetName ??
              i18n.t('admin.recipes.form.mealPlanning.pairings.untitledTarget')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={i18n.t(
            'admin.recipes.form.mealPlanning.pairings.removeCta',
          )}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="close" size={22} color={COLORS.text.secondary} />
        </TouchableOpacity>
      </View>

      <View className="mt-lg">
        <FormGroup
          grow={false}
          label={i18n.t('admin.recipes.form.mealPlanning.pairings.roleLabel')}
          required
          error={
            missingRole
              ? i18n.t('admin.recipes.form.mealPlanning.pairings.roleRequired')
              : undefined
          }
        >
          <SelectInput
            options={roleOptions}
            value={pairing.pairingRole ?? ''}
            onValueChange={(value) =>
              onChange({ pairingRole: (value as PairingRole) || null })
            }
            placeholder={i18n.t(
              'admin.recipes.form.mealPlanning.pairings.rolePlaceholder',
            )}
          />
        </FormGroup>
      </View>

      <View className="mt-lg">
        <FormGroup
          grow={false}
          label={i18n.t('admin.recipes.form.mealPlanning.pairings.reasonLabel')}
        >
          <TextInput
            value={pairing.reason ?? ''}
            onChangeText={(text) => onChange({ reason: text || null })}
            placeholder={i18n.t(
              'admin.recipes.form.mealPlanning.pairings.reasonPlaceholder',
            )}
          />
        </FormGroup>
      </View>
    </View>
  );
}

interface PickerCandidate {
  id: string;
  name: string;
  imageUrl?: string | null;
  plannerRole?: PlannerRole | null;
}

interface PairingPickerModalProps {
  sourceRecipeId: string;
  existingPairings: AdminRecipePairing[];
  displayLocale: string;
  onPick: (pick: PickerCandidate) => void;
  onClose: () => void;
}

function PairingPickerModal({
  sourceRecipeId,
  existingPairings,
  displayLocale,
  onPick,
  onClose,
}: PairingPickerModalProps) {
  const [candidates, setCandidates] = useState<PickerCandidate[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminRecipeService
      .getAllRecipesForAdmin()
      .then((recipes) => {
        if (cancelled) return;
        const mapped: PickerCandidate[] = recipes.map((r: any) => {
          const translations = (r.translations ?? []) as {
            locale: string;
            name?: string;
          }[];
          const name: string =
            pickTranslation(translations, displayLocale)?.name
            ?? pickTranslation(translations, 'es')?.name
            ?? pickTranslation(translations, 'en')?.name
            ?? i18n.t('admin.recipes.form.mealPlanning.pairings.untitledTarget');
          return {
            id: r.id,
            name,
            imageUrl: r.imageUrl ?? null,
            plannerRole: (r.plannerRole ?? null) as PlannerRole | null,
          };
        });
        setCandidates(mapped);
      })
      .catch((e) => {
        logger.error('Failed to load pairing candidates:', e);
        if (!cancelled) {
          setError(
            i18n.t('admin.recipes.form.mealPlanning.pairings.loadError'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayLocale]);

  // ESC to close on web
  useEffect(() => {
    if (!isWeb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return undefined;
  }, [onClose]);

  const alreadyPairedIds = useMemo(() => {
    const ids = new Set<string>();
    // Intentionally one role per target in the editor for now. The database
    // stays more permissive so we can revisit multi-role pairings if product
    // finds a real content need later.
    existingPairings.forEach((p) => ids.add(p.targetRecipeId));
    return ids;
  }, [existingPairings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => c.id !== sourceRecipeId && !alreadyPairedIds.has(c.id))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true));
  }, [candidates, query, sourceRecipeId, alreadyPairedIds]);

  const title = i18n.t('admin.recipes.form.mealPlanning.pairings.pickerTitle');

  const WebDialog = (
    <Pressable
      onPress={onClose}
      className="flex-1 items-center justify-center bg-black/50"
      style={{
        position: 'fixed' as unknown as 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      }}
    >
      <Pressable
        onPress={(e) => {
          const anyEvt = e as unknown as { stopPropagation?: () => void };
          anyEvt.stopPropagation?.();
        }}
        className="items-center px-md"
        style={{ width: '100%', maxWidth: 720 }}
      >
        <View
          className="rounded-xl bg-white border border-primary-default shadow-lg overflow-hidden"
          style={{ width: '100%', maxHeight: 640 }}
        >
          <PickerHeader title={title} onClose={onClose} />
          <View className="px-lg pt-md">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={i18n.t(
                'admin.recipes.form.mealPlanning.pairings.searchPlaceholder',
              )}
            />
          </View>
          <PickerBody
            loading={loading}
            error={error}
            items={filtered}
            onPick={onPick}
            maxHeight={420}
          />
        </View>
      </Pressable>
    </Pressable>
  );

  const NativeSheet = (
    <View className="flex-1 justify-end bg-black/50">
      <View
        className="bg-white rounded-t-2xl border-t border-primary-default"
        style={{ maxHeight: '85%' }}
      >
        <PickerHeader title={title} onClose={onClose} />
        <View className="px-lg pt-md">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={i18n.t(
              'admin.recipes.form.mealPlanning.pairings.searchPlaceholder',
            )}
          />
        </View>
        <PickerBody
          loading={loading}
          error={error}
          items={filtered}
          onPick={onPick}
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      {isWeb ? WebDialog : NativeSheet}
    </Modal>
  );
}

function PickerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-lg py-md border-b border-primary-default bg-background-secondary">
      <Button
        variant="secondary"
        size="small"
        onPress={onClose}
        label={i18n.t('common.cancel')}
      />
      <Text preset="subheading" numberOfLines={1} className="flex-1 text-center px-md">
        {title}
      </Text>
      <View style={{ width: 64 }} />
    </View>
  );
}

function PickerBody({
  loading,
  error,
  items,
  onPick,
  maxHeight,
}: {
  loading: boolean;
  error: string | null;
  items: PickerCandidate[];
  onPick: (pick: PickerCandidate) => void;
  maxHeight?: number;
}) {
  if (loading) {
    return (
      <View className="px-lg py-lg">
        <Text preset="caption" className="text-center text-text-secondary">
          {i18n.t('admin.recipes.form.mealPlanning.pairings.loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="px-lg py-lg">
        <Text preset="caption" className="text-center text-status-error">
          {error}
        </Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View className="px-lg py-lg">
        <Text preset="caption" className="text-center text-text-secondary">
          {i18n.t('admin.recipes.form.mealPlanning.pairings.noMatches')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="px-lg py-sm"
      style={maxHeight ? { maxHeight } : undefined}
      contentContainerStyle={{ paddingBottom: 16 }}
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onPick(item)}
          className="flex-row items-center py-md px-md rounded-lg mb-xs web:hover:bg-primary-lightest web:transition-colors web:cursor-pointer"
        >
          <View className="flex-1">
            <Text preset="body" className="text-text-default">
              {item.name}
            </Text>
            {item.plannerRole ? (
              <Text preset="caption" className="text-text-secondary mt-xs">
                {item.plannerRole}
              </Text>
            ) : null}
          </View>
          <Ionicons name="add-circle-outline" size={24} color={COLORS.primary.darkest} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
