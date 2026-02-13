import { Redirect } from 'expo-router';

/**
 * Cookbook sharing is intentionally disabled for now.
 * Route access is redirected until the social-sharing rollout is ready.
 */
export default function SharedCookbookScreen() {
  return <Redirect href="/(tabs)/recipes" />;
}
