/**
 * @file: index.tsx
 * @description: Стартовый редирект по состоянию auth-сессии (FB-3)
 * @dependencies: expo-router, authStore
 * @created: 2025-01-27
 * @updated: 2026-06-18
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth';

export default function Index() {
  const { isAuthenticated, sessionRestored } = useAuthStore();

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

  if (isAuthenticated) {
    return <Redirect href="/(app)/lobby" />;
  }

  return <Redirect href="/(public)/login" />;
}
