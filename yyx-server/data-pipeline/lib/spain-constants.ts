/**
 * Spain Spanish Constants
 *
 * Shared vocabulary swap list used by both spain-adapter.ts and
 * translation-backfill.ts for MX → ES-ES adaptation prompts.
 */

/** Common MX → ES word swaps for recipe content */
export const SPAIN_SWAP_LIST =
  'jitomate→tomate, ejotes→judías verdes, chícharos→guisantes, papa→patata, durazno→melocotón, elote→maíz, betabel→remolacha, aguacate→aguacate (same), frijoles→alubias, chile→pimiento/guindilla, crema→nata, popote→pajita, refrigerador→frigorífico, estufa→cocina/fogón, sartén→sartén (same), vaso (Thermomix)→vaso (same)';

/** Shared rules block for MX → ES-ES adaptation prompts */
export const SPAIN_ADAPT_RULES = `- ONLY change words/phrases that differ between Mexican and Spain Spanish
- Common swaps: ${SPAIN_SWAP_LIST}
- Keep Thermomix-specific terms unchanged (vaso, Varoma, vel, giro a la izquierda)
- Keep measurements unchanged (g, ml, min, seg)
- If the text is already neutral Spanish or doesn't need changes, return the EXACT same text
- Do NOT rewrite or rephrase — only swap region-specific words
- Return valid JSON matching the requested schema`;
