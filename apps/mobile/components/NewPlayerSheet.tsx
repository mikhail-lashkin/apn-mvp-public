/**
 * @file: NewPlayerSheet.tsx
 * @description: Создание игрока — имя (опционально) + single-select метка ColorSystem (SC-6)
 * @dependencies: react-native, expo-haptics, TagChipPicker, playerTags
 * @created: 2025-01-30
 * @updated: 2026-07-18
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TagChipPicker } from './TagChipPicker';
import { playerTagsStore } from '../stores/playerTags';
import { listPlayerTagOptions } from '../constants/playerTags';

interface NewPlayerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** tags[0] = код метки ColorSystem (или пусто). name может быть пустым. */
  onCreatePlayer: (name: string, tags: string[]) => void;
  seatNumber?: number;
}

export const NewPlayerSheet: React.FC<NewPlayerSheetProps> = ({
  isOpen,
  onClose,
  onCreatePlayer,
  seatNumber,
}) => {
  const insets = useSafeAreaInsets();
  const [playerName, setPlayerName] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const markOptions = useMemo(() => {
    const fromStore = playerTagsStore.options();
    return fromStore.length ? fromStore : listPlayerTagOptions();
  }, [isOpen]);

  const handleCreatePlayer = () => {
    // имя не обязательно — за столом часто сажают «без имени»
    const tags = selectedTags.slice(0, 1);
    onCreatePlayer(playerName.trim(), tags);
    setPlayerName('');
    setSelectedTags([]);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClose = () => {
    setPlayerName('');
    setSelectedTags([]);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.container}
        // Android: behavior=height даёт мерцание при вводе + IME (как в QuickNote)
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 24) + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>
            Новый игрок{seatNumber !== undefined ? ` · место ${seatNumber}` : ''}
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Имя</Text>
            <TextInput
              testID="new-player-name"
              accessibilityLabel="new-player-name"
              style={styles.textInput}
              placeholder="Необязательно"
              placeholderTextColor="#94a3b8"
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={40}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreatePlayer}
            />
            <Text style={styles.hint}>Можно посадить без имени — на месте будет номер</Text>
          </View>

          <View style={styles.section}>
            <TagChipPicker
              options={markOptions}
              selected={selectedTags}
              onChange={setSelectedTags}
              title="Метка"
              testIdPrefix="player-tag"
              singleSelect
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              testID="new-player-cancel"
              accessibilityLabel="new-player-cancel"
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="new-player-create"
              accessibilityLabel="new-player-create"
              style={[styles.button, styles.createButton]}
              onPress={handleCreatePlayer}
            >
              <Text style={styles.createButtonText}>
                {playerName.trim() ? 'Создать' : 'Без имени'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#3b82f6',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
