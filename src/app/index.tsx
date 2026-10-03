import { Redirect } from 'expo-router';
import { useContent } from '../config/remote';
import { useApp } from '../store/app';

export default function Index() {
  const onboarded = useApp((s) => s.onboarded);
  const seen = useApp((s) => s.introVersion ?? 1);
  const wanted = Number(useContent('onboarding').reshowVersion) || 1;
  return <Redirect href={onboarded && seen >= wanted ? '/home' : '/onboarding'} />;
}
