/**
 * SafeImage
 *
 * A thin wrapper around expo-image's Image that handles null/undefined sources
 * and image load errors gracefully by falling back to a placeholder image.
 *
 * Usage:
 *   <SafeImage source={url} placeholder="ingredient" className="w-20 h-20" />
 */
import React, { useState, useEffect } from 'react';
import { Image, ImageProps } from 'expo-image';
import { PLACEHOLDER_IMAGES, PlaceholderType } from '@/constants/placeholders';

type ImageSource = string | { uri: string } | number | null | undefined;

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  /** The image source — accepts a URL string, { uri } object, require() number, null, or undefined. */
  source: ImageSource;
  /** Which placeholder to show when source is null/undefined or fails to load. Defaults to 'ingredient'. */
  placeholder?: PlaceholderType;
}

/**
 * Normalize various source formats into the shape expo-image expects.
 * Returns null if the source is empty or invalid.
 */
function normalizeSource(source: ImageSource): ImageProps['source'] | null {
  if (source == null) return null;
  if (typeof source === 'number') return source;
  if (typeof source === 'string') {
    return source.trim() ? { uri: source } : null;
  }
  if (typeof source === 'object' && 'uri' in source) {
    return source.uri?.trim() ? source : null;
  }
  return null;
}

export function SafeImage({
  source,
  placeholder = 'ingredient',
  onError,
  ...rest
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when source changes
  useEffect(() => {
    setHasError(false);
  }, [source]);

  const normalized = normalizeSource(source);
  const usePlaceholder = normalized == null || hasError;

  const resolvedSource = usePlaceholder
    ? PLACEHOLDER_IMAGES[placeholder]
    : normalized;

  return (
    <Image
      {...rest}
      source={resolvedSource}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
    />
  );
}
