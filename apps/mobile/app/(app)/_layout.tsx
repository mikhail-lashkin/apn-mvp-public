/**
 * @file: _layout.tsx
 * @description: Layout защищённой зоны (app) — auth guard (FB-3)
 * @dependencies: expo-router, authStore
 * @created: 2026-06-18
 */

import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../stores/auth';

export default function AppLayout() {
  const { isAuthenticated, sessionRestored } = useAuthStore();

  if (!sessionRestored) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(public)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
