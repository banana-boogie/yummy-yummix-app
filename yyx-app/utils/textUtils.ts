/** Strip LLM-hallucinated tool XML (e.g. `<tool>generate_custom_recipe</tool>`) from displayed text. */
const TOOL_XML_RE = /<\/?tool[^>]*>/gi;
export function stripToolMarkup(content: string): string {
    return content.replace(TOOL_XML_RE, '').trim();
}
