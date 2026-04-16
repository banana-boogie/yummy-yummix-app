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

interface MyWeekSetupFormProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  displayLocale?: string;
  /**
   * Optional ScrollView ref from the wizard host. When provided, ReadinessBadge
   * chips scroll the corresponding field into view.
   */
  scrollViewRef?: React.RefObject<ScrollView | null>;
}

export function MyWeekSetupForm({
  recipe,
  onUpdateRecipe,
  displayLocale = "es",
  scrollViewRef,
}: MyWeekSetupFormProps) {
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

  const plannerRoleOptions: SelectOption[] = ALL_PLANNER_ROLES.map((role) => ({
    label: i18n.t(`admin.recipes.form.myWeekSetup.plannerRole.${role}`),
    value: role,
  }));

  // "Also serves as…" — all scheduling roles except the current primary and
  // 'pantry' (pantry is mutually exclusive with scheduling).
  const alternateRoleOptions: SelectOption[] = ALL_PLANNER_ROLES
    .filter((role) => role !== "pantry" && role !== recipe.plannerRole)
    .map((role) => ({
      label: i18n.t(`admin.recipes.form.myWeekSetup.plannerRole.${role}`),
      value: role,
    }));

  const mealComponentOptions = [
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.mealComponents.protein"),
      value: "protein" as MealComponent,
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.mealComponents.carb"),
      value: "carb" as MealComponent,
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.mealComponents.veg"),
      value: "veg" as MealComponent,
    },
  ];

  const equipmentOptions = [
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.equipment.thermomix"),
      value: "thermomix" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.equipment.airFryer"),
      value: "air_fryer" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.equipment.oven"),
      value: "oven" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.equipment.stovetop"),
      value: "stovetop" as EquipmentTag,
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.equipment.none"),
      value: "none" as EquipmentTag,
    },
  ];

  const cookingLevelOptions: SelectOption[] = [
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.cookingLevel.beginner"),
      value: "beginner",
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.cookingLevel.intermediate"),
      value: "intermediate",
    },
    {
      label: i18n.t("admin.recipes.form.myWeekSetup.cookingLevel.experienced"),
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
  //   - meal_components is only required when the role composes into a meal
  //     (main or side). Snacks, desserts, beverages, condiments skip it.
  //   - meal types are required for all non-pantry roles.
  const requiresMealComponents =
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
        "admin.recipes.form.myWeekSetup.eligibility.missing.plannerRole",
      ),
    });
  }
  if (requiresMealComponents && mealComponents.length === 0) {
    missing.push({
      anchor: "mealComponents",
      label: i18n.t(
        "admin.recipes.form.myWeekSetup.eligibility.missing.mealComponents",
      ),
    });
  }
  if (requiresMealType && !hasMealType) {
    missing.push({
      anchor: "mealTypes",
      label: i18n.t(
        "admin.recipes.form.myWeekSetup.eligibility.missing.mealTypes",
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
    <View className="w-full max-w-[720px] self-center gap-2xl">
      <ReadinessBadge
        isReady={isEligible}
        isPantry={isPantry}
        missing={missing}
        onJumpToField={handleRequestScrollTo}
      />

      {/* Role & composition */}
      <FormSection
        title={i18n.t(
          "admin.recipes.form.myWeekSetup.sections.roleComposition",
        )}
        headerVariant="prominent"
      >
        <View className="gap-xl">
          <View ref={plannerRoleRef}>
            <FormGroup
              label={i18n.t("admin.recipes.form.myWeekSetup.plannerRole.label")}
              helperText={i18n.t(
                "admin.recipes.form.myWeekSetup.plannerRole.tooltip",
              )}
              required
            >
              <SelectInput
                value={recipe.plannerRole || ""}
                options={plannerRoleOptions}
                onValueChange={(value) =>
                  onUpdateRecipe({ plannerRole: value as PlannerRole })
                }
                placeholder={i18n.t(
                  "admin.recipes.form.myWeekSetup.plannerRole.placeholder",
                )}
              />
            </FormGroup>
            {recipe.plannerRole === "main" || recipe.plannerRole === "snack" ? (
              <Text
                preset="bodySmall"
                className="text-text-secondary mt-xs"
              >
                {i18n.t(
                  "admin.recipes.form.myWeekSetup.plannerRole.ambiguityHint",
                )}
              </Text>
            ) : null}
          </View>

          {/* Also serves as… — alternate planner roles. Hidden when primary
              role is 'pantry' (mutually exclusive with scheduling) or when
              no primary role is selected yet. */}
          {recipe.plannerRole && recipe.plannerRole !== "pantry" ? (
            <FormGroup
              label={i18n.t(
                "admin.recipes.form.myWeekSetup.alternateRoles.label",
              )}
              helperText={i18n.t(
                "admin.recipes.form.myWeekSetup.alternateRoles.tooltip",
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
                  "admin.recipes.form.myWeekSetup.alternateRoles.placeholder",
                )}
                title={i18n.t(
                  "admin.recipes.form.myWeekSetup.alternateRoles.pickerTitle",
                )}
              />
            </FormGroup>
          ) : null}

          {/* Meal components — only shown when the recipe composes into a meal
              (main or side). Snacks, desserts, beverages, condiments, and
              pantry items don't need a macronutrient answer. */}
          {recipe.plannerRole === "main" || recipe.plannerRole === "side" ? (
            <>
              <View ref={mealComponentsRef}>
                <FormGroup
                  label={i18n.t(
                    "admin.recipes.form.myWeekSetup.mealComponents.label",
                  )}
                  helperText={i18n.t(
                    "admin.recipes.form.myWeekSetup.mealComponents.tooltip",
                  )}
                  required
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
                      "admin.recipes.form.myWeekSetup.mealComponents.placeholder",
                    )}
                    title={i18n.t(
                      "admin.recipes.form.myWeekSetup.mealComponents.pickerTitle",
                    )}
                  />
                </FormGroup>
              </View>
              <ToggleCard
                label={i18n.t(
                  "admin.recipes.form.myWeekSetup.isCompleteMeal.label",
                )}
                helper={i18n.t(
                  "admin.recipes.form.myWeekSetup.isCompleteMeal.tooltip",
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
          "admin.recipes.form.myWeekSetup.sections.equipmentDifficulty",
        )}
        headerVariant="prominent"
      >
        <View className="gap-xl">
          <FormGroup
            label={i18n.t("admin.recipes.form.myWeekSetup.equipment.label")}
            helperText={i18n.t(
              "admin.recipes.form.myWeekSetup.equipment.tooltip",
            )}
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
                "admin.recipes.form.myWeekSetup.equipment.placeholder",
              )}
              title={i18n.t(
                "admin.recipes.form.myWeekSetup.equipment.pickerTitle",
              )}
            />
          </FormGroup>
          <FormGroup
            label={i18n.t("admin.recipes.form.myWeekSetup.cookingLevel.label")}
            helperText={i18n.t(
              "admin.recipes.form.myWeekSetup.cookingLevel.tooltip",
            )}
          >
            <SelectInput
              value={recipe.cookingLevel || ""}
              options={cookingLevelOptions}
              onValueChange={(value) =>
                onUpdateRecipe({ cookingLevel: value as CookingLevel })
              }
              placeholder={i18n.t(
                "admin.recipes.form.myWeekSetup.cookingLevel.placeholder",
              )}
            />
          </FormGroup>
        </View>
      </FormSection>

      {/* Scale & leftovers */}
      <FormSection
        title={i18n.t("admin.recipes.form.myWeekSetup.sections.scaleLeftovers")}
        headerVariant="prominent"
      >
        <View className="gap-xl">
          <View className="gap-md">
            <ToggleCard
              label={i18n.t(
                "admin.recipes.form.myWeekSetup.leftoversFriendly.label",
              )}
              helper={i18n.t(
                "admin.recipes.form.myWeekSetup.leftoversFriendly.tooltip",
              )}
              value={!!recipe.leftoversFriendly}
              onChange={(v) => onUpdateRecipe({ leftoversFriendly: v })}
            />
            <ToggleCard
              label={i18n.t(
                "admin.recipes.form.myWeekSetup.batchFriendly.label",
              )}
              helper={i18n.t(
                "admin.recipes.form.myWeekSetup.batchFriendly.tooltip",
              )}
              value={!!recipe.batchFriendly}
              onChange={(v) => onUpdateRecipe({ batchFriendly: v })}
            />
          </View>
          <View className="max-w-[160px] w-full">
            <FormGroup
              label={i18n.t(
                "admin.recipes.form.myWeekSetup.maxHouseholdSize.label",
              )}
              helperText={i18n.t(
                "admin.recipes.form.myWeekSetup.maxHouseholdSize.tooltip",
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
              />
            </FormGroup>
          </View>
          <FormGroup
            label={i18n.t("admin.recipes.form.myWeekSetup.scalingNotes.label")}
            helperText={i18n.t(
              "admin.recipes.form.myWeekSetup.scalingNotes.tooltip",
            )}
          >
            <TextInput
              value={recipe.requiresMultiBatchNote || ""}
              onChangeText={(text) =>
                onUpdateRecipe({ requiresMultiBatchNote: text || null })
              }
              multiline
              numberOfLines={3}
              className="min-h-[96px] p-md"
              style={{ textAlignVertical: "top" }}
              placeholder={i18n.t(
                "admin.recipes.form.myWeekSetup.scalingNotes.placeholder",
              )}
            />
          </FormGroup>
        </View>
      </FormSection>

      {/* Meal types */}
      <View ref={mealTypesRef}>
        <FormSection
          title={i18n.t("admin.recipes.form.myWeekSetup.sections.mealTypes")}
          headerVariant="prominent"
        >
          {tagsLoadError ? (
            <View className="p-lg rounded-lg border border-dashed border-status-error bg-status-error/10">
              <Text preset="bodySmall" className="text-status-error">
                {i18n.t("admin.recipes.form.myWeekSetup.mealTypes.loadError")}
              </Text>
              <View className="mt-md self-start">
                <Button
                  variant="outline"
                  size="small"
                  onPress={loadTags}
                  label={i18n.t(
                    "admin.recipes.form.myWeekSetup.mealTypes.loadError",
                  )}
                />
              </View>
            </View>
          ) : mealTypeOptions.length > 0 ? (
            <FormGroup
              label={i18n.t("admin.recipes.form.myWeekSetup.mealTypes.label")}
              helperText={i18n.t(
                "admin.recipes.form.myWeekSetup.mealTypes.tooltip",
              )}
              required
            >
              <MultiSelect
                options={mealTypeOptions}
                selectedValues={selectedMealTypeIds}
                onValueChange={handleMealTypesChange}
                placeholder={i18n.t(
                  "admin.recipes.form.myWeekSetup.mealTypes.placeholder",
                )}
                title={i18n.t(
                  "admin.recipes.form.myWeekSetup.mealTypes.pickerTitle",
                )}
              />
            </FormGroup>
          ) : (
            <View className="p-lg rounded-lg border border-dashed border-primary-medium bg-primary-lightest">
              <Text preset="subheading" className="text-text-default">
                {i18n.t("admin.recipes.form.myWeekSetup.mealTypes.emptyTitle")}
              </Text>
              <Text preset="body" className="text-text-secondary mt-xs">
                {i18n.t("admin.recipes.form.myWeekSetup.mealTypes.empty")}
              </Text>
              <View className="mt-md self-start">
                <Button
                  variant="outline"
                  size="small"
                  onPress={() => router.push("/admin/tags")}
                  label={i18n.t(
                    "admin.recipes.form.myWeekSetup.mealTypes.createCta",
                  )}
                />
              </View>
            </View>
          )}
        </FormSection>
      </View>

      {/* Pairings — sits between Meal Types and Verification */}
      <PairingsSection
        recipe={recipe}
        onUpdateRecipe={onUpdateRecipe}
        displayLocale={displayLocale}
      />

      {/* Verification — sits outside FormSection accent */}
      <View className="mt-2xl">
        <Text
          preset="caption"
          className="text-text-secondary uppercase tracking-wider mb-sm"
        >
          {i18n.t("admin.recipes.form.myWeekSetup.verified.sectionEyebrow")}
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
