/**
 * @file: lobby.tsx
 * @description: Экран лобби с доступом к столам и выходом из сессии (FB-3)
 * @dependencies: expo-router, react-native, authStore, tablesStore
 * @created: 2025-01-27
 * @updated: 2026-07-18
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth';
import { tablesStore, useTablesStore } from '../../stores/tables';
import SetupSheet, { TableSetup } from '../../components/SetupSheet';
import { PlayerTagsSettingsSheet } from '../../components/PlayerTagsSettingsSheet';
import { NoteTagsSettingsSheet } from '../../components/NoteTagsSettingsSheet';

export default function Lobby() {
  const insets = useSafeAreaInsets();
  const authStore = useAuthStore();
  const router = useRouter();
  const { items: savedTables } = useTablesStore();
  const [setupVisible, setSetupVisible] = useState(false);
  const [tagsVisible, setTagsVisible] = useState(false);
  const [noteTagsVisible, setNoteTagsVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const isLoading = authStore.isLoading;
  const userEmail = authStore.user?.email;

  useFocusEffect(
    useCallback(() => {
      void tablesStore.refreshFromApi();
    }, [])
  );

  const handleSetupSave = useCallback(
    async (setup: TableSetup) => {
      const maxSeats =
        setup.size === '8-max' ? 8 : setup.size === '9-max' ? 9 : 6;
      setCreating(true);
      try {
        const created = await tablesStore.create({
          name: `${maxSeats}-max · $${setup.stakes}`,
          size: maxSeats,
          hero_position: setup.heroPosition,
          limits: setup.stakes,
        });
        setSetupVisible(false);
        router.push({
          pathname: '/(app)/table/[id]',
          params: {
            id: String(created.id),
            maxSeats: String(created.size),
            stakes: created.limits || setup.stakes,
            heroPosition: String(
              created.hero_position ?? setup.heroPosition
            ),
          },
        });
      } catch {
        Alert.alert('Ошибка', 'Не удалось создать стол');
      } finally {
        setCreating(false);
      }
    },
    [router]
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Выход', 'Выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void authStore.logout();
        },
      },
    ]);
  }, [authStore]);

  const openSavedTable = useCallback(
    (table: { id: number | string; size: number; limits?: string | null; hero_position?: number | null; name: string }) => {
      router.push({
        pathname: '/(app)/table/[id]',
        params: {
          id: String(table.id),
          maxSeats: String(table.size),
          stakes: table.limits || '1/2',
          heroPosition: String(
            table.hero_position ?? Math.floor(table.size / 2)
          ),
        },
      });
    },
    [router]
  );

  return (
    <LinearGradient
      colors={['#1e293b', '#0f172a']}
      style={{ flex: 1 }}
    >
      <ScrollView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 12) + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            {userEmail ? (
              <Text style={{ color: '#94a3b8', fontSize: 14, flex: 1 }} numberOfLines={1}>
                {userEmail}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              testID="lobby-note-tags"
              accessibilityLabel="lobby-note-tags"
              onPress={() => setNoteTagsVisible(true)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#4b5563',
                marginRight: 8,
              }}
            >
              <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '600' }}>
                Теги
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="lobby-player-tags"
              accessibilityLabel="lobby-player-tags"
              onPress={() => setTagsVisible(true)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#4b5563',
                marginRight: 8,
              }}
            >
              <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '600' }}>
                Метки
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              disabled={isLoading}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#4b5563',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#f87171', fontSize: 14, fontWeight: '600' }}>
                {isLoading ? 'Выход...' : 'Выйти'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎯</Text>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 8 }}>
              AI Poker Notes
            </Text>
            <Text style={{ fontSize: 16, color: '#94a3b8', textAlign: 'center' }}>
              Выберите стол для игры
            </Text>
          </View>

          <View style={{ width: '100%', maxWidth: 400 }}>
            <TouchableOpacity
              testID="lobby-new-table"
              accessibilityLabel="lobby-new-table"
              onPress={() => setSetupVisible(true)}
              disabled={creating}
              style={{
                backgroundColor: '#4f46e5',
                padding: 20,
                borderRadius: 12,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: '#6366f1',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                    + Новый стол
                  </Text>
                  <Text style={{ color: '#c7d2fe', fontSize: 14 }}>
                    8-max · $1/2 · пустые слоты
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {savedTables.length > 0 ? (
              <>
                <Text
                  style={{
                    color: 'white',
                    fontSize: 20,
                    fontWeight: '600',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}
                >
                  Мои столы
                </Text>
                {savedTables.map((table, index) => (
                  <TouchableOpacity
                    key={String(table.id)}
                    testID={`lobby-saved-table-${index}`}
                    accessibilityLabel={`lobby-table-${table.id}`}
                    onPress={() => openSavedTable(table)}
                    style={{
                      backgroundColor: '#1e3a5f',
                      padding: 20,
                      borderRadius: 12,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: '#3b82f6',
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 18,
                        fontWeight: '600',
                        marginBottom: 8,
                      }}
                    >
                      {table.name}
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                      {table.size}-max
                      {table.limits ? ` • $${table.limits}` : ''}
                      {typeof table.id === 'string' ? ' • офлайн' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            <View
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                padding: 16,
                borderRadius: 12,
                marginTop: 24,
                borderWidth: 1,
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}
            >
              <Text style={{ color: '#60a5fa', fontSize: 14, textAlign: 'center' }}>
                💡 «+ Новый стол» сохраняется в аккаунт и синхронизируется
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <SetupSheet
        visible={setupVisible}
        onClose={() => setSetupVisible(false)}
        onSave={(setup) => {
          void handleSetupSave(setup);
        }}
        initialSetup={{ size: '8-max', stakes: '1/2', heroPosition: 4 }}
      />
      <PlayerTagsSettingsSheet
        isOpen={tagsVisible}
        onClose={() => setTagsVisible(false)}
      />
      <NoteTagsSettingsSheet
        isOpen={noteTagsVisible}
        onClose={() => setNoteTagsVisible(false)}
      />
    </LinearGradient>
  );
}
