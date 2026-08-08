/**
 * @file: SetupSheet.tsx
 * @description: Модальное окно настройки нового стола (размер, лимиты, позиция)
 * @dependencies: React Native, expo-linear-gradient
 * @created: 2025-01-28
 * @updated: 2026-07-18
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface TableSetup {
  size: '6-max' | '8-max' | '9-max';
  heroPosition: number;
  location: string;
  stakes: string;
}

interface SetupSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (setup: TableSetup) => void;
  initialSetup?: Partial<TableSetup>;
}

const TABLE_SIZES = [
  { id: '6-max' as const, label: '6-Max', description: '6 игроков' },
  { id: '8-max' as const, label: '8-Max', description: '8 игроков' },
  { id: '9-max' as const, label: '9-Max', description: '9 игроков' },
];

const POSITIONS = [
  { id: 0, label: 'UTG', description: 'Under the Gun' },
  { id: 1, label: 'UTG+1', description: 'UTG+1' },
  { id: 2, label: 'MP', description: 'Middle Position' },
  { id: 3, label: 'MP+1', description: 'MP+1' },
  { id: 4, label: 'CO', description: 'Cutoff' },
  { id: 5, label: 'BTN', description: 'Button' },
  { id: 6, label: 'SB', description: 'Small Blind' },
  { id: 7, label: 'BB', description: 'Big Blind' },
  { id: 8, label: 'BB+1', description: 'BB+1' },
];

const STAKES_OPTIONS = [
  '1/2',
  '2/5',
  '5/10',
  '10/25',
  '25/50',
  '50/100',
  '100/200',
];

export default function SetupSheet({
  visible,
  onClose,
  onSave,
  initialSetup = {},
}: SetupSheetProps) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<TableSetup['size']>(
    initialSetup.size || '8-max'
  );
  const [heroPosition, setHeroPosition] = useState<number>(
    initialSetup.heroPosition ?? 4
  );
  const [stakes, setStakes] = useState<string>(initialSetup.stakes || '1/2');

  const maxSeats = size === '8-max' ? 8 : size === '9-max' ? 9 : 6;
  const availablePositions = POSITIONS.slice(0, maxSeats);

  const handleSave = () => {
    const pos = Math.min(Math.max(0, heroPosition), maxSeats - 1);
    onSave({
      size,
      heroPosition: pos,
      location: initialSetup.location || '',
      stakes,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.root}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            testID="setup-sheet-cancel"
            accessibilityLabel="setup-sheet-cancel"
            onPress={onClose}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Отмена</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Настройка стола</Text>
          <TouchableOpacity
            testID="setup-sheet-save"
            accessibilityLabel="setup-sheet-save"
            onPress={handleSave}
            style={styles.headerBtn}
          >
            <Text style={[styles.headerBtnText, styles.headerBtnBold]}>Сохранить</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Размер стола</Text>
          <View style={styles.row}>
            {TABLE_SIZES.map((tableSize) => {
              const on = size === tableSize.id;
              return (
                <TouchableOpacity
                  key={tableSize.id}
                  testID={`setup-size-${tableSize.id}`}
                  onPress={() => {
                    setSize(tableSize.id);
                    const nextMax =
                      tableSize.id === '8-max' ? 8 : tableSize.id === '9-max' ? 9 : 6;
                    if (heroPosition >= nextMax) {
                      setHeroPosition(Math.floor(nextMax / 2));
                    }
                  }}
                  style={[styles.chip, on && styles.chipOnBlue]}
                >
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{tableSize.label}</Text>
                  <Text style={styles.chipHint}>{tableSize.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>Ваша позиция (HERO)</Text>
          <View style={styles.row}>
            {availablePositions.map((position) => {
              const on = heroPosition === position.id;
              return (
                <TouchableOpacity
                  key={position.id}
                  testID={`setup-hero-${position.id}`}
                  onPress={() => setHeroPosition(position.id)}
                  style={[styles.chip, on && styles.chipOnGreen]}
                >
                  <Text style={[styles.chipLabel, on && styles.chipLabelGreen]}>
                    {position.label}
                  </Text>
                  <Text style={styles.chipHint}>{position.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>Лимиты</Text>
          <View style={styles.row}>
            {STAKES_OPTIONS.map((stake) => {
              const on = stakes === stake;
              return (
                <TouchableOpacity
                  key={stake}
                  testID={`setup-stakes-${stake.replace('/', '-')}`}
                  onPress={() => setStakes(stake)}
                  style={[styles.chip, on && styles.chipOnYellow]}
                >
                  <Text style={[styles.chipLabel, on && styles.chipLabelYellow]}>${stake}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerBtn: { padding: 8, minWidth: 72 },
  headerBtnText: { color: '#60a5fa', fontSize: 16 },
  headerBtnBold: { fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  section: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    minWidth: 88,
  },
  chipOnBlue: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)' },
  chipOnGreen: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.2)' },
  chipOnYellow: { borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.2)' },
  chipLabel: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  chipLabelOn: { color: '#60a5fa' },
  chipLabelGreen: { color: '#4ade80' },
  chipLabelYellow: { color: '#facc15' },
  chipHint: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 2 },
});
