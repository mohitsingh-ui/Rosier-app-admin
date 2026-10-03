import Tabs from 'expo-router/js-tabs';
import React from 'react';
import { MenuShell } from '../../components/SideMenu';
import { TabBar } from '../../components/TabBar';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <MenuShell>
      <Tabs
        initialRouteName="home"
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg }, animation: 'shift' }}
      >
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="coins" />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="shop" />
        <Tabs.Screen name="cart" />
      </Tabs>
    </MenuShell>
  );
}
