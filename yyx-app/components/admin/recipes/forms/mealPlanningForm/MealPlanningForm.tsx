import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { findNodeHandle, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import i18n from "@/i18n";
import { Text } from "@/components/common/Text";
import { Button } from "@/components/common/Button";
import { TextInput } from "@/components/form/TextInput";
import { FormGroup } from "@/components/form/FormGroup";
import { FormSection } from "@/components/form/FormSection";
import { SelectInput, SelectOption } from "@/components/form/SelectInput";
import { MultiSelect } from "@/components/form/MultiSelect";
import {
  AdminRecipe,
  AdminRecipeTag,
  pickTranslation,
} from "@/types/recipe.admin.types";
import {
  AlternatePlannerRole,
  CookingLevel,
  EquipmentTag,
  MealComponent,
  PlannerRole,
} from "@/types/recipe.types";
import { adminRecipeTagService } from "@/services/admin/adminRecipeTagService";
import { useAuth } from "@/contexts/AuthContext";
import logger from "@/services/logger";
import { ReadinessBadge, ReadinessAnchor } from "./ReadinessBadge";
import { ToggleCard } from "./ToggleCard";
import { VerificationCard } from "./VerificationCard";
import { PairingsSection } from "./PairingsSection";

// Tag category name convention: meal types are any tags whose categories include this string
// (case-insensitive match against TAG category labels like "Meal Type"/"MEAL_TYPE").
const MEAL_TYPE_CATEGORY_MATCH = /meal\s*type/i;

interface MealPlanningFormProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  displayLocale?: string;
  /**
   * The locale the admin is authoring in. Used to bind translatable fields
   * like scaling_notes to the right row in `recipe.translations`.
   */
  authoringLocale?: string;
  /**
   * Optional ScrollView ref from the wizard host. When provided, ReadinessBadge
   * chips scroll the corresponding field into view.
   */
  scrollViewRef?: React.RefObject<ScrollView | null>;
}

export function MealPlanningForm({
  recipe,
  onUpdateRecipe,
  displayLocale = "es",
  authoringLocale = "es",
  scrollViewRef,
}: MealPlanningFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [allTags, setAllTags] = useState<AdminRecipeTag[]>([]);
  const [tagsLoadError, setTagsLoadError] = useState(false);

  const plannerRoleRef = useRef<View>(null);
  const mealComponentsRef = useRef<View>(null);
  const mealTypesRef = useRef<View>(null);

  const anchorRefs: Record<ReadinessAnchor, React.RefObject<View | null>> = {
    plannerRole: plannerRoleRef,
    mealComponents: mealComponentsRef,
    mealTypes: mealTypesRef,
  };

  const handleRequestScrollTo = useCallback(
    (anchor: ReadinessAnchor) => {
      const target = anchorRefs[anchor]?.current;
      if (!target) return;

      if (Platform.OS === "web") {
        // On web, the underlying node is a DOM element.
        const node = target as unknown as {
          scrollIntoView?: (opts?: ScrollIntoViewOptions) => void;
        };
        if (typeof node.scrollIntoView === "function") {
          node.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      const scrollView = scrollViewRef?.current;
      if (!scrollView) return;
      const scrollNode = findNodeHandle(scrollView);
      if (scrollNode == null) return;

      target.measureLayout(
        scrollNode,
        (_x: number, y: number) => {
          scrollView.scrollTo({ y: Math.max(0, y - 16), animated: true });
        },
        () => {
          // measurement failed — no-op
        },
      );
    },
    [anchorRefs, scrollViewRef],
  );

  const loadTags = React.useCallback(() => {
    setTagsLoadError(false);
    adminRecipeTagService
      .getAllTags()
      .then(setAllTags)
      .catch((e) => {
        logger.error("Failed to load tags for meal types:", e);
        setTagsLoadError(true);
      });
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const mealTypeTags = useMemo(
    () =>
      allTags.filter((t) =>
        (t.categories || []).some((c) => MEAL_TYPE_CATEGORY_MATCH.test(c)),
      ),
    [allTags],
  );

  const ALL_PLANNER_ROLES: PlannerRole[] = [
    "main",
    "side",
    "snack",
    "dessert",
    "beverage",
    "condiment",
    "pantry",
  ];

  const sortByLabel = <T extends { label: string }>(opts: T[]): T[] =>
    [...opts].sort((a, b) =>
      a.label.localeCompare(b.label, displayLocale, { sensitivity: "base" }),
    );

  const plannerRoleOptions: SelectOption[] = sortByLabel(
    ALL_PLANNER_ROLES.map((role) => ({
      label: i18n.t(`admin.recipes.form.mealPlanning.plannerRole.${role}`),
      value: role,
    })),
  );

  // "Also serves as…" — all scheduling roles except the current primary and
  // 'pantry' (pantry is mutually exclusive with scheduling).
  const alternateRoleOptions: SelectOption[] = sortByLabel(
    ALL_PLANNER_ROLES
      .filter((role) => role !== "pantry" && role !== recipe.plannerRole)
      .map((role) => ({
        label: i18n.t(`admin.recipes.form.mealPlanning.plannerRole.${role}`),
        value: role,
      })),
  );

  const mealComponentOptions = [
    {
      label: i18n.t("admin.recipes.form.mealPlanning.mealComponents.protein"),
      value: "protein" as MealComponent,
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.mealComponents.carb"),
      value: "carb" as MealComponent,
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.mealComponents.veg"),
      value: "veg" as MealComponent,
    },
  ];

  const equipmentOptions = [
    {
      label: i18n.t("admin.recipes.form.mealPlanning.equipment.thermomix"),
      value: "thermomix" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.equipment.airFryer"),
      value: "air_fryer" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.equipment.oven"),
      value: "oven" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.equipment.stovetop"),
      value: "stovetop" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.equipment.none"),
      value: "none" as EquipmentTag,
    },
  ];

  const cookingLevelOptions: SelectOption[] = [
    {
      label: i18n.t("admin.recipes.form.mealPlanning.cookingLevel.beginner"),
      value: "beginner",
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.cookingLevel.intermediate"),
      value: "intermediate",
    },
    {
      label: i18n.t("admin.recipes.form.mealPlanning.cookingLevel.experienced"),
      value: "experienced",
    },
  ];

  const mealTypeOptions = mealTypeTags
    .map((t) => ({
      label:
        pickTranslation(t.translations, displayLocale)?.name ||
        pickTranslation(t.translations, "es")?.name ||
        pickTranslation(t.translations, "en")?.name ||
        "—",
      value: t.id,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, displayLocale, { sensitivity: "base" }),
    );

  const selectedTags = (recipe.tags as AdminRecipeTag[]) || [];
  const selectedMealTypeIds = selectedTags
    .filter((t) => mealTypeTags.some((mt) => mt.id === t.id))
    .map((t) => t.id);

  const handleMealTypesChange = (ids: string[]) => {
    // Keep any non-meal-type tags untouched; replace only meal-type ones
    const nonMealType = selectedTags.filter(
      (t) => !mealTypeTags.some((mt) => mt.id === t.id),
    );
    const newMealTypes = mealTypeTags.filter((mt) => ids.includes(mt.id));
    onUpdateRecipe({ tags: [...nonMealType, ...newMealTypes] });
  };

  const mealComponents = recipe.mealComponents || [];
  const equipmentTags = recipe.equipmentTags || [];
  const hasMealType = selectedMealTypeIds.length > 0;
  // Step-local completion. DB-level planner eligibility additionally requires is_published,
  // but the publish toggle lives on the Review step — keep this badge scoped to this step.
  // Role-dependent eligibility:
  //   - pantry items are intentionally never planner-eligible (Explore only).
  //   - meal_components is only required for 'main' dishes (they MUST own at
  //     least one macro axis for planner ranking). Sides may claim an axis if
  //     they genuinely own one (rice = carb), but it's optional — many sides
  //     (hummus, dips, accompaniments) don't genuinely contribute a macro.
  //   - meal types are required for all non-pantry roles.
  const requiresMealComponents = recipe.plannerRole === "main";
  const showsMealComponents =
    recipe.plannerRole === "main" || recipe.plannerRole === "side";
  const requiresMealType = recipe.plannerRole !== "pantry";

  const isPantry = recipe.plannerRole === "pantry";
  const isEligible =
    Boolean(recipe.plannerRole) &&
    !isPantry &&
    (!requiresMealComponents || mealComponents.length >= 1) &&
    (!requiresMealType || hasMealType);

  const missing: { anchor: ReadinessAnchor; label: string }[] = [];
  if (!recipe.plannerRole) {
    missing.push({
      anchor: "plannerRole",
      label: i18n.t(
        "admin.recipes.form.mealPlanning.eligibility.missing.plannerRole",
      ),
    });
  }
  if (requiresMealComponents && mealComponents.length === 0) {
    missing.push({
      anchor: "mealComponents",
      label: i18n.t(
        "admin.recipes.form.mealPlanning.eligibility.missing.mealComponents",
      ),
    });
  }
  if (requiresMealType && !hasMealType) {
    missing.push({
      anchor: "mealTypes",
      label: i18n.t(
        "admin.recipes.form.mealPlanning.eligibility.missing.mealTypes",
      ),
    });
  }

  const handleMarkVerified = () => {
    // Store user.id for stable attribution (verified_by is TEXT).
    onUpdateRecipe({
      verifiedAt: new Date().toISOString(),
      verifiedBy: user?.id || null,
    });
  };

  const handleUnverify = () => {
    onUpdateRecipe({ verifiedAt: null, verifiedBy: null });
  };

  return (
    <View className="w-full max-w-[720px] self-center gap-xl bg-grey-lightest">
      <ReadinessBadge
        isReady={isEligible}
        isPantry={isPantry}
        missing={missing}
        onJumpToField={handleRequestScrollTo}
      />

      {/* Role & composition */}
      <FormSection
        title={i18n.t(
          "admin.recipes.form.mealPlanning.sections.roleComposition",
        )}
        headerVariant="prominent"
      >
        <View style={{ gap: 40 }}>
          <View ref={plannerRoleRef}>
            <FormGroup
              label={i18n.t("admin.recipes.form.mealPlanning.plannerRole.label")}
              helperText={
                recipe.plannerRole === "main" || recipe.plannerRole === "snack"
                  ? `${i18n.t("admin.recipes.form.mealPlanning.plannerRole.tooltip")}\n\n${i18n.t("admin.recipes.form.mealPlanning.plannerRole.ambiguityHint")}`
                  : i18n.t("admin.recipes.form.mealPlanning.plannerRole.tooltip")
              }
              required
            >
              <SelectInput
                value={recipe.plannerRole || ""}
                options={plannerRoleOptions}
                onValueChange={(value) => {
                  const nextPlannerRole = value as PlannerRole;
                  onUpdateRecipe({
                    plannerRole: nextPlannerRole,
                    alternatePlannerRoles: (
                      recipe.alternatePlannerRoles ?? []
                    ).filter((role) => role !== nextPlannerRole),
                  });
                }}
                placeholder={i18n.t(
                  "admin.recipes.form.mealPlanning.plannerRole.placeholder",
                )}
              />
            </FormGroup>
          </View>

          {/* Also serves as… — alternate planner roles. Hidden when primary
              role is 'pantry' (mutually exclusive with scheduling) or when
              no primary role is selected yet. */}
          {recipe.plannerRole && recipe.plannerRole !== "pantry" ? (
            <FormGroup
              label={i18n.t(
                "admin.recipes.form.mealPlanning.alternateRoles.label",
              )}
              helperText={i18n.t(
                "admin.recipes.form.mealPlanning.alternateRoles.tooltip",
              )}
            >
              <MultiSelect
                options={alternateRoleOptions}
                selectedValues={recipe.alternatePlannerRoles ?? []}
                onValueChange={(values) =>
                  onUpdateRecipe({
                    alternatePlannerRoles: values as AlternatePlannerRole[],
                  })
                }
                placeholder={i18n.t(
                  "admin.recipes.form.mealPlanning.alternateRoles.placeholder",
                )}
                title={i18n.t(
                  "admin.recipes.form.mealPlanning.alternateRoles.pickerTitle",
                )}
              />
            </FormGroup>
          ) : null}

          {/* Meal components — shown when the recipe composes into a meal
              (main or side). Required for 'main' (dishes must own a macro
              axis). Optional for 'side' — many sides don't genuinely own a
              macro axis (dips, accompaniments). */}
          {showsMealComponents ? (
            <>
              <View ref={mealComponentsRef}>
                <FormGroup
                  label={i18n.t(
                    "admin.recipes.form.mealPlanning.mealComponents.label",
                  )}
                  helperText={i18n.t(
                    "admin.recipes.form.mealPlanning.mealComponents.tooltip",
                  )}
                  required={requiresMealComponents}
                >
                  <MultiSelect
                    options={mealComponentOptions.map((o) => ({
                      label: o.label,
                      value: o.value,
                    }))}
                    selectedValues={mealComponents}
                    onValueChange={(values) =>
                      onUpdateRecipe({ mealComponents: values as MealComponent[] })
                    }
                    placeholder={i18n.t(
                      "admin.recipes.form.mealPlanning.mealComponents.placeholder",
                    )}
                    title={i18n.t(
                      "admin.recipes.form.mealPlanning.mealComponents.pickerTitle",
                    )}
                  />
                </FormGroup>
              </View>
              <ToggleCard
                label={i18n.t(
                  "admin.recipes.form.mealPlanning.isCompleteMeal.label",
                )}
                helper={i18n.t(
                  "admin.recipes.form.mealPlanning.isCompleteMeal.tooltip",
                )}
                value={!!recipe.isCompleteMeal}
                onChange={(v) => onUpdateRecipe({ isCompleteMeal: v })}
              />
            </>
          ) : null}
        </View>
      </FormSection>

      {/* Equipment & difficulty */}
      <FormSection
        title={i18n.t(
          "admin.recipes.form.mealPlanning.sections.equipmentDifficulty",
        )}
        headerVariant="prominent"
      >
        <View className="gap-xl">
          <FormGroup
            label={i18n.t("admin.recipes.form.mealPlanning.equipment.label")}
          >
            <MultiSelect
              options={equipmentOptions.map((o) => ({
                label: o.label,
                value: o.value,
              }))}
              selectedValues={equipmentTags}
              onValueChange={(values) =>
                onUpdateRecipe({ equipmentTags: values as EquipmentTag[] })
              }
              placeholder={i18n.t(
                "admin.recipes.form.mealPlanning.equipment.placeholder",
              )}
              title={i18n.t(
                "admin.recipes.form.mealPlanning.equipment.pickerTitle",
              )}
            />
          </FormGroup>
          <FormGroup
            label={i18n.t("admin.recipes.form.mealPlanning.cookingLevel.label")}
            helperText={i18n.t(
              "admin.recipes.form.mealPlanning.cookingLevel.tooltip",
            )}
          >
            <SelectInput
              value={recipe.cookingLevel || ""}
              options={cookingLevelOptions}
              onValueChange={(value) =>
                onUpdateRecipe({ cookingLevel: value as CookingLevel })
              }
              placeholder={i18n.t(
                "admin.recipes.form.mealPlanning.cookingLevel.placeholder",
              )}
            />
          </FormGroup>
        </View>
      </FormSection>

      {/* Meal types */}
      <View ref={mealTypesRef}>
        <FormSection
          title={i18n.t("admin.recipes.form.mealPlanning.sections.mealTypes")}
          headerVariant="prominent"
        >
          {tagsLoadError ? (
            <View className="p-lg rounded-lg border border-dashed border-status-error bg-status-error/10">
              <Text preset="bodySmall" className="text-status-error">
                {i18n.t("admin.recipes.form.mealPlanning.mealTypes.loadError")}
              </Text>
              <View className="mt-md self-start">
                <Button
                  variant="outline"
                  size="small"
                  onPress={loadTags}
                  label={i18n.t(
                    "admin.recipes.form.mealPlanning.mealTypes.loadError",
                  )}
                />
              </View>
            </View>
          ) : mealTypeOptions.length > 0 ? (
            <FormGroup
              label={i18n.t("admin.recipes.form.mealPlanning.mealTypes.label")}
              required
            >
              <MultiSelect
                options={mealTypeOptions}
                selectedValues={selectedMealTypeIds}
                onValueChange={handleMealTypesChange}
                placeholder={i18n.t(
                  "admin.recipes.form.mealPlanning.mealTypes.placeholder",
                )}
                title={i18n.t(
                  "admin.recipes.form.mealPlanning.mealTypes.pickerTitle",
                )}
              />
            </FormGroup>
          ) : (
            <View className="p-lg rounded-lg border border-dashed border-primary-medium bg-primary-lightest">
              <Text preset="subheading" className="text-text-default">
                {i18n.t("admin.recipes.form.mealPlanning.mealTypes.emptyTitle")}
              </Text>
              <Text preset="body" className="text-text-secondary mt-xs">
                {i18n.t("admin.recipes.form.mealPlanning.mealTypes.empty")}
              </Text>
              <View className="mt-md self-start">
                <Button
                  variant="outline"
                  size="small"
                  onPress={() => router.push("/admin/tags")}
                  label={i18n.t(
                    "admin.recipes.form.mealPlanning.mealTypes.createCta",
                  )}
                />
              </View>
            </View>
          )}
        </FormSection>
      </View>

      {/* Pairings — sits between Meal Types and Scale & leftovers */}
      <PairingsSection
        recipe={recipe}
        onUpdateRecipe={onUpdateRecipe}
        displayLocale={displayLocale}
      />

      {/* Scale & leftovers — sits just above Verification */}
      <FormSection
        title={i18n.t("admin.recipes.form.mealPlanning.sections.scaleLeftovers")}
        headerVariant="prominent"
      >
        <View className="gap-xl">
          <View className="gap-md">
            <ToggleCard
              label={i18n.t(
                "admin.recipes.form.mealPlanning.leftoversFriendly.label",
              )}
              helper={i18n.t(
                "admin.recipes.form.mealPlanning.leftoversFriendly.tooltip",
              )}
              value={!!recipe.leftoversFriendly}
              onChange={(v) => onUpdateRecipe({ leftoversFriendly: v })}
            />
            <ToggleCard
              label={i18n.t(
                "admin.recipes.form.mealPlanning.batchFriendly.label",
              )}
              helper={i18n.t(
                "admin.recipes.form.mealPlanning.batchFriendly.tooltip",
              )}
              value={!!recipe.batchFriendly}
              onChange={(v) => onUpdateRecipe({ batchFriendly: v })}
            />
          </View>
          <FormGroup
            label={i18n.t(
              "admin.recipes.form.mealPlanning.maxHouseholdSize.label",
            )}
            helperText={i18n.t(
              "admin.recipes.form.mealPlanning.maxHouseholdSize.tooltip",
            )}
          >
            <TextInput
              value={recipe.maxHouseholdSizeSupported?.toString() || ""}
              onChangeText={(text) => {
                const n = parseInt(text);
                onUpdateRecipe({
                  maxHouseholdSizeSupported:
                    Number.isFinite(n) && n > 0 ? n : null,
                });
              }}
              keyboardType="numeric"
              style={{ maxWidth: 220 }}
            />
          </FormGroup>
          <FormGroup
            label={i18n.t("admin.recipes.form.mealPlanning.scalingNotes.label")}
          >
            <TextInput
              value={
                (recipe.translations ?? []).find(
                  (t) => t.locale === authoringLocale,
                )?.scalingNotes ?? ""
              }
              onChangeText={(text) => {
                const translations = recipe.translations ?? [];
                const existing = translations.find(
                  (t) => t.locale === authoringLocale,
                );
                const next = existing
                  ? translations.map((t) =>
                      t.locale === authoringLocale
                        ? { ...t, scalingNotes: text || undefined }
                        : t,
                    )
                  : [
                      ...translations,
                      {
                        locale: authoringLocale,
                        name: "",
                        scalingNotes: text || undefined,
                      },
                    ];
                onUpdateRecipe({ translations: next });
              }}
              multiline
              numberOfLines={3}
              className="min-h-[96px] p-md"
              style={{ textAlignVertical: "top" }}
              placeholder={i18n.t(
                "admin.recipes.form.mealPlanning.scalingNotes.placeholder",
              )}
            />
          </FormGroup>
        </View>
      </FormSection>

      {/* Verification — sits outside FormSection accent */}
      <View className="mt-2xl">
        <Text
          preset="caption"
          className="text-text-secondary uppercase tracking-wider mb-sm"
        >
          {i18n.t("admin.recipes.form.mealPlanning.verified.sectionEyebrow")}
        </Text>
        <VerificationCard
          verifiedAt={recipe.verifiedAt || null}
          verifiedBy={recipe.verifiedBy || null}
          verifiedByDisplay={recipe.verifiedByName ?? null}
          displayLocale={displayLocale}
          onMarkVerified={handleMarkVerified}
          onUnverify={handleUnverify}
        />
      </View>
    </View>
  );
}
