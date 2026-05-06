import i18n from '@/i18n';
import { MeasurementUnit } from '@/types/recipe.types';
import { ShoppingCategory } from '@/types/shopping-list.types';

interface IngredientTranslationRow {
    locale: string;
    name: string;
    plural_name?: string | null;
}

interface MeasurementUnitTranslationRow {
    locale: string;
    name: string;
    name_plural?: string | null;
    symbol: string;
    symbol_plural?: string | null;
}

interface RawIngredientJoin {
    id: string;
    image_url?: string;
    translations?: IngredientTranslationRow[];
}

interface RawMeasurementUnitJoin {
    id: string;
    type: string;
    system: string;
    base_factor?: number | string | null;
    translations?: MeasurementUnitTranslationRow[];
}

export interface MappedIngredientFields {
    name: string;
    pluralName?: string;
    pictureUrl?: string;
}

function pickByLocale<T extends { locale: string }>(
    rows: T[] | undefined,
    locale: string,
): T | undefined {
    if (!rows || rows.length === 0) return undefined;
    return rows.find(r => r.locale === locale) ?? rows.find(r => r.locale === locale.split('-')[0]);
}

export function getCurrentLocale(): string {
    return i18n.locale;
}

/**
 * Returns the language-only base locale (e.g. "en-US" → "en").
 * Use when querying tables that only store base-language rows so a
 * regional locale doesn't fall through to zero results.
 */
export function getBaseLocale(): string {
    return (i18n.locale ?? 'en').split('-')[0] || 'en';
}

export function mapIngredient(
    ingredient: RawIngredientJoin | null | undefined,
    locale: string,
    fallbackName?: string,
): MappedIngredientFields {
    const t = pickByLocale(ingredient?.translations, locale);
    // Prefer a non-empty fallbackName (the row's name_custom on shopping/pantry
    // items) over the canonical translation. Otherwise an edit to a canonical
    // ingredient's name reverts on refetch.
    const overrideName = fallbackName && fallbackName.trim().length > 0 ? fallbackName : undefined;
    const rawName = overrideName ?? t?.name ?? '';
    return {
        name: toDisplayName(rawName),
        pluralName: t?.plural_name ? toDisplayName(t.plural_name) : undefined,
        pictureUrl: ingredient?.image_url,
    };
}

export function getLocalizedCategoryName(category: ShoppingCategory): string {
    return i18n.locale === 'es' ? category.nameEs : category.nameEn;
}

/**
 * Display-layer normalization for ingredient names.
 *
 * The DB convention is sentence case ("Olive oil") but admin/import data
 * occasionally lands lowercase. This is a defensive shim — we don't want
 * the UI to look broken just because one row is "olive oil" while every
 * other row is "Olive oil".
 *
 * Behavior: if the first character is lowercase, capitalize it. Otherwise
 * leave the string untouched — preserves "Granny Smith apple" and proper
 * nouns. Doesn't try to handle ALL CAPS (rare; not the reported issue).
 */
export function toDisplayName(name: string | undefined | null): string {
    if (!name) return '';
    const first = name.charAt(0);
    const upper = first.toUpperCase();
    if (first === upper) return name;
    return upper + name.slice(1);
}

export function mapMeasurementUnit(
    unit: RawMeasurementUnitJoin | null | undefined,
    locale: string,
): MeasurementUnit | undefined {
    if (!unit) return undefined;
    const t = pickByLocale(unit.translations, locale);
    // PostgREST returns numeric columns as strings sometimes; normalize.
    const rawFactor = unit.base_factor;
    const baseFactor = rawFactor == null ? undefined :
        typeof rawFactor === 'number' ? rawFactor :
        Number.parseFloat(rawFactor);
    return {
        id: unit.id,
        type: unit.type,
        system: unit.system,
        name: t?.name ?? '',
        symbol: t?.symbol ?? '',
        baseFactor: Number.isFinite(baseFactor) ? baseFactor : undefined,
    } as MeasurementUnit;
}
