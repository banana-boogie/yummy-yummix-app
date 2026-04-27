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
    picture_url?: string;
    image_url?: string;
    translations?: IngredientTranslationRow[];
}

interface RawMeasurementUnitJoin {
    id: string;
    type: string;
    system: string;
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

export function mapIngredient(
    ingredient: RawIngredientJoin | null | undefined,
    locale: string,
    fallbackName?: string,
): MappedIngredientFields {
    const t = pickByLocale(ingredient?.translations, locale);
    return {
        name: t?.name ?? fallbackName ?? '',
        pluralName: t?.plural_name ?? undefined,
        pictureUrl: ingredient?.picture_url ?? ingredient?.image_url,
    };
}

export function getLocalizedCategoryName(category: ShoppingCategory): string {
    return i18n.locale === 'es' ? category.nameEs : category.nameEn;
}

export function mapMeasurementUnit(
    unit: RawMeasurementUnitJoin | null | undefined,
    locale: string,
): MeasurementUnit | undefined {
    if (!unit) return undefined;
    const t = pickByLocale(unit.translations, locale);
    return {
        id: unit.id,
        type: unit.type,
        system: unit.system,
        name: t?.name ?? '',
        symbol: t?.symbol ?? '',
    } as MeasurementUnit;
}
