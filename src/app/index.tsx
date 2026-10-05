import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useContent } from '../config/remote';
import { useBoot } from '../lib/bootGuard';
import { useApp } from '../store/app';

export default function Index() {
  const onboarded = useApp((s) => s.onboarded);
  const seen = useApp((s) => s.introVersion ?? 1);
  const wanted = Number(useContent('onboarding').reshowVersion) || 1;
  const { ready, safe } = useBoot();
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#F1DCC3' }} />;
  // (In safe mode the intro still shows, just the light version — see onboarding.tsx.)
  void safe;
  return <Redirect href={onboarded && seen >= wanted ? '/home' : '/onboarding'} />;
}
