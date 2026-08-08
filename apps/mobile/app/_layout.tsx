/**
 * @file: _layout.tsx
 * @description: Корневой layout — bootstrap auth-сессии (FB-3)
 * @dependencies: expo-router, authStore, gesture-handler, safe-area
 * @created: 2025-01-27
 * @updated: 2026-07-05
 */

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authStore, useAuthStore } from '../stores/auth';
import { playerTagsStore } from '../stores/playerTags';
import { noteTagsStore } from '../stores/noteTags';
import { tablesStore } from '../stores/tables';
import { syncService } from '../services/sync/syncService';

function AuthSessionBootstrap({ children }: { children: React.ReactNode }) {
  const { sessionRestored, isAuthenticated } = useAuthStore();

  useEffect(() => {
    authStore.setNavigationHandler(() => {
      if (router.canDismiss?.()) {
        router.dismissAll();
      }
      router.replace('/(public)/login');
    });

    void authStore.restoreSession();
    void playerTagsStore.hydrate();
    void noteTagsStore.hydrate();
    void tablesStore.hydrate();
  }, []);

  useEffect(() => {
    if (!sessionRestored) {
      return;
    }
    void syncService.initialize();
  }, [sessionRestored]);

  useEffect(() => {
    if (!sessionRestored || !isAuthenticated) {
      return;
    }
    void syncService.sync();
    void playerTagsStore.refreshFromApi();
    void noteTagsStore.refreshFromApi();
    void tablesStore.refreshFromApi();
  }, [sessionRestored, isAuthenticated]);

  if (!sessionRestored) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0f172a',
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthSessionBootstrap>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthSessionBootstrap>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
