import { TextStyle, View, ViewStyle, StyleProp } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';

type RecipeTextStyles = {
  textStyle?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
  bulletStyle?: StyleProp<TextStyle>;
  bulletPointStyle?: StyleProp<TextStyle>;
  bulletContainer?: StyleProp<ViewStyle>;
  ingredientStyle?: StyleProp<TextStyle>;
};

type IngredientInfo = {
  name: string;
  pluralName?: string;
};

/**
 * Renders recipe text with special markup for bold text, bullet points, and optional ingredient highlighting
 * Example: "Mix the **eggs** well.|{•}Add salt{/•}"
 * If ingredients are provided, their names will be automatically highlighted in the text
 */
export function renderRecipeText(
  content: string,
  styles: RecipeTextStyles = {},
  ingredients?: IngredientInfo[]
) {
  if (!content) return null;

  const paragraphs = content.split('|');

  return paragraphs.map((paragraph, index) => (
    <Text key={index} preset="handwritten" style={styles.textStyle}>
      {parseRecipeMarkup(paragraph, ingredients).map((segment, i) => renderSegment(segment, i, styles))}
    </Text>
  ));
}

type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'bullet'; content: string }
  | { type: 'ingredient'; content: string };

function parseRecipeMarkup(text: string, ingredients?: IngredientInfo[]): TextSegment[] {
  // First, parse the existing markup (bold and bullets)
  const parts = text.split(/(\{•\}.*?\{\/•\}|\*\*.*?\*\*)/g);

  const segments: TextSegment[] = parts.flatMap(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return { type: 'bold' as const, content: part.slice(2, -2) };
    }
    if (part.startsWith('{•}') && part.endsWith('{/•}')) {
      return { type: 'bullet' as const, content: part.slice(3, -4) };
    }

    // If we have ingredients to highlight, process plain text segments
    if (ingredients && ingredients.length > 0) {
      return highlightIngredients(part, ingredients);
    }

    return { type: 'text' as const, content: part };
  });

  return segments;
}

/**
 * Highlights ingredient names in a text segment
 * Creates ingredient-type segments for matched names
 */
function highlightIngredients(text: string, ingredients: IngredientInfo[]): TextSegment[] {
  if (!text || ingredients.length === 0) {
    return [{ type: 'text', content: text }];
  }

  // Build a regex pattern to match all ingredient names (case-insensitive, word boundaries)
  const names = ingredients.flatMap(ing => [
    ing.name,
    ing.pluralName
  ].filter(Boolean) as string[]);

  // Sort by length (longest first) to avoid partial matches
  names.sort((a, b) => b.length - a.length);

  // Escape special regex characters and create pattern
  const escapedNames = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // Add the ingredient match
    segments.push({ type: 'ingredient', content: match[0] });
    lastIndex = pattern.lastIndex;
  }

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no matches found, return original text
  if (segments.length === 0) {
    return [{ type: 'text', content: text }];
  }

  return segments;
}

function renderSegment(segment: TextSegment, index: number, styles: RecipeTextStyles) {
  switch (segment.type) {
    case 'bold':
      return (
        <Text
          key={index}
          preset="handwritten"
          fontWeight="600"
          className="text-xl"
          style={[
            {
              color: COLORS.primary.darkest,
              textDecorationLine: 'underline',
              textDecorationColor: COLORS.primary.medium,
            },
            styles.boldStyle
          ]}
        >
          {segment.content}
        </Text>
      );

    case 'ingredient':
      return (
        <Text
          key={index}
          preset="handwritten"
          fontWeight="600"
          className="text-xl"
          style={[
            {
              color: COLORS.primary.darkest,
              textDecorationLine: 'underline',
              textDecorationColor: COLORS.primary.medium,
            },
            styles.ingredientStyle
          ]}
        >
          {segment.content}
        </Text>
      );

    case 'bullet':
      return (
        <View key={index} className="flex-row pl-6 relative" style={styles.bulletContainer}>
          <Text
            preset="handwritten"
            className="text-base"
            style={styles.bulletPointStyle}
          >
            •
          </Text>
          <Text
            preset="handwritten"
            className="text-base"
            style={[styles.textStyle, styles.bulletStyle]}
          >
            {segment.content}
          </Text>
        </View>
      );

    default:
      return (
        <Text
          key={index}
          preset="handwritten"
          className="text-base"
          style={styles.textStyle}
        >
          {segment.content}
        </Text>
      );
  }
}