import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

/**
 * Shopify login sends people back to rosier://auth. The login screen already
 * handles the result, so this screen just steps out of the way.
 */
export default function AuthReturn() {
  useEffect(() => {
    const id = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/home')), 0);
    return () => clearTimeout(id);
  }, []);
  return <View style={{ flex: 1, backgroundColor: '#FBEBD8' }} />;
}
