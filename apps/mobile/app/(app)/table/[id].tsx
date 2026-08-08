/**
 * @file: [id].tsx
 * @description: Экран покерного стола с Speed Focus UI
 * @dependencies: expo-router, SpeedFocusUI_MD3
 * @created: 2025-01-28
 * @updated: 2026-07-15
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SpeedFocusUI_MD3 } from '../../../components/SpeedFocusUI_MD3';
import { StatusBar } from 'expo-status-bar';
import { tablesStore } from '../../../stores/tables';

type SeatConfig = {
  seat: number;
  playerId: string | null;
  displayName: string;
  isActive: boolean;
  tag?: string;
  color?: string;
  noteCount?: number;
};

type TableConfig = {
  maxSeats: number;
  stakes: string;
  heroPosition: number;
  seats: SeatConfig[];
  name?: string;
};

const SC1_MIXED_SEATS: SeatConfig[] = [
  { seat: 0, playerId: 'p1', displayName: 'Иван', isActive: true, noteCount: 0 },
  { seat: 1, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
  { seat: 2, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
  { seat: 3, playerId: 'p4', displayName: 'Пётр', isActive: true, noteCount: 0 },
  { seat: 4, playerId: 'hero', displayName: 'Вы (HERO)', isActive: true, tag: 'HERO', color: '#fbbf24' },
  { seat: 5, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
  { seat: 6, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
  { seat: 7, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
];

const getTableConfig = (
  tableId: string,
  params?: { maxSeats?: string; stakes?: string; heroPosition?: string }
): TableConfig => {
  const saved = tablesStore.getById(tableId);
  if (saved) {
    const maxSeats = saved.size || 8;
    const heroPosition =
      saved.hero_position != null
        ? Math.min(Math.max(0, saved.hero_position), maxSeats - 1)
        : Math.floor(maxSeats / 2);
    return {
      maxSeats,
      stakes: saved.limits || params?.stakes || '1/2',
      heroPosition,
      seats: [],
      name: saved.name,
    };
  }

  if (params?.maxSeats && params?.stakes) {
    const maxSeats = parseInt(params.maxSeats, 10) || 8;
    const heroFromParams =
      params.heroPosition != null ? parseInt(params.heroPosition, 10) : NaN;
    const heroPosition = Number.isFinite(heroFromParams)
      ? Math.min(Math.max(0, heroFromParams), maxSeats - 1)
      : Math.floor(maxSeats / 2);
    return {
      maxSeats,
      stakes: params.stakes,
      heroPosition,
      seats: [],
      name: `Новый стол · ${maxSeats}-max`,
    };
  }

  switch (tableId) {
    case 'sc1':
      return {
        maxSeats: 8,
        stakes: '1/2',
        heroPosition: 4,
        name: 'Сочи · 8-max',
        seats: SC1_MIXED_SEATS,
      };
    case 'abc123':
      return {
        maxSeats: 6,
        stakes: '1/2',
        heroPosition: 3,
        seats: [
          { seat: 0, playerId: '1', displayName: 'Алексей', isActive: true, tag: 'TAG', color: '#3b82f6', noteCount: 2 },
          { seat: 1, playerId: '2', displayName: 'Мария', isActive: true, tag: 'LAG', color: '#ef4444', noteCount: 1 },
          { seat: 2, playerId: '3', displayName: 'Дмитрий', isActive: true, noteCount: 0 },
          { seat: 3, playerId: 'hero', displayName: 'Вы (HERO)', isActive: true, tag: 'HERO', color: '#fbbf24' },
          { seat: 4, playerId: '4', displayName: 'Елена', isActive: true, noteCount: 1 },
          { seat: 5, playerId: '5', displayName: 'Сергей', isActive: true, noteCount: 0 },
        ],
      };
    case 'def456':
      return {
        maxSeats: 9,
        stakes: '2/5',
        heroPosition: 4,
        seats: [
          { seat: 0, playerId: '1', displayName: 'Алексей', isActive: true, tag: 'TAG', color: '#3b82f6', noteCount: 2 },
          { seat: 1, playerId: '2', displayName: 'Мария', isActive: true, tag: 'LAG', color: '#ef4444', noteCount: 1 },
          { seat: 2, playerId: '3', displayName: 'Дмитрий', isActive: true, noteCount: 0 },
          { seat: 3, playerId: '4', displayName: 'Елена', isActive: true, noteCount: 1 },
          { seat: 4, playerId: 'hero', displayName: 'Вы (HERO)', isActive: true, tag: 'HERO', color: '#fbbf24' },
          { seat: 5, playerId: '5', displayName: 'Сергей', isActive: true, noteCount: 0 },
          { seat: 6, playerId: '6', displayName: 'Анна', isActive: true, noteCount: 3 },
          { seat: 7, playerId: '7', displayName: 'Михаил', isActive: false, noteCount: 0 },
          { seat: 8, playerId: '8', displayName: 'Ольга', isActive: false, noteCount: 0 },
        ],
      };
    case 'ghi789':
      return {
        maxSeats: 8,
        stakes: '1/2',
        heroPosition: 4,
        name: '8-max · $1/2',
        seats: [
          { seat: 0, playerId: 'p1', displayName: 'Игрок 1', isActive: true, noteCount: 0 },
          { seat: 1, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
          { seat: 2, playerId: 'p3', displayName: 'Игрок 3', isActive: true, noteCount: 0 },
          { seat: 3, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
          { seat: 4, playerId: 'hero', displayName: 'Вы (HERO)', isActive: true, tag: 'HERO', color: '#fbbf24' },
          { seat: 5, playerId: 'p5', displayName: 'Игрок 5', isActive: true, noteCount: 0 },
          { seat: 6, playerId: null, displayName: 'Пусто', isActive: false, noteCount: 0 },
          { seat: 7, playerId: 'p7', displayName: 'Игрок 7', isActive: true, noteCount: 0 },
        ],
      };
    default:
      return {
        maxSeats: 6,
        stakes: '1/2',
        heroPosition: 3,
        seats: [
          { seat: 0, playerId: '1', displayName: 'Алексей', isActive: true, tag: 'TAG', color: '#3b82f6', noteCount: 2 },
          { seat: 1, playerId: '2', displayName: 'Мария', isActive: true, tag: 'LAG', color: '#ef4444', noteCount: 1 },
          { seat: 2, playerId: '3', displayName: 'Дмитрий', isActive: true, noteCount: 0 },
          { seat: 3, playerId: 'hero', displayName: 'Вы (HERO)', isActive: true, tag: 'HERO', color: '#fbbf24' },
          { seat: 4, playerId: '4', displayName: 'Елена', isActive: true, noteCount: 1 },
          { seat: 5, playerId: '5', displayName: 'Сергей', isActive: true, noteCount: 0 },
        ],
      };
  }
};

export default function TableScreen() {
  const { id, maxSeats, stakes, heroPosition } = useLocalSearchParams<{
    id: string;
    maxSeats?: string;
    stakes?: string;
    heroPosition?: string;
  }>();

  const tableId = id || 'abc123';
  const tableConfig = getTableConfig(tableId, { maxSeats, stakes, heroPosition });

  const mockTable = {
    id: tableId,
    name: tableConfig.name || `Покерный стол ${tableId}`,
    maxSeats: tableConfig.maxSeats,
    stakes: tableConfig.stakes,
    startedAt: new Date().toISOString(),
    heroPosition: tableConfig.heroPosition,
    seats: tableConfig.seats.map((s) => ({
      ...s,
      playerId: s.playerId ?? 'empty',
    })),
  };

  const handleTableUpdate = (updatedTable: typeof mockTable) => {
    console.log('Table updated:', updatedTable);
  };

  const handleNoteCreate = async (note: { text: string; tags: string[]; type: string }) => {
    console.log('Note created:', note);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SpeedFocusUI_MD3
        tableId={tableId}
        initialTable={mockTable}
        onTableUpdate={handleTableUpdate}
        onNoteCreate={handleNoteCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBFE',
  },
});
