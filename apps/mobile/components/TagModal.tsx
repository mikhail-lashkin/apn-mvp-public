/**
 * @file: TagModal.tsx
 * @description: Выбор метки игрока из справочника ColorSystem (SC-6)
 * @dependencies: playerTagsStore, expo-haptics
 * @created: 2025-01-28
 * @updated: 2026-07-17
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePlayerTagsStore } from '../stores/playerTags';
import { normalizePlayerTagCode } from '../constants/playerTags';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagSelect: (tag: string) => void;
  currentTag?: string;
  playerName?: string;
}

function slugTestId(code: string): string {
  return `player-tag-${code.toLowerCase().replace(/[^a-z0-9_]+/g, '-')}`;
}

export const TagModal: React.FC<TagModalProps> = ({
  isOpen,
  onClose,
  onTagSelect,
  currentTag,
  playerName,
}) => {
  const { tags } = usePlayerTagsStore();
  const sorted = useMemo(
    () => [...tags].sort((a, b) => a.sortOrder - b.sortOrder),
    [tags]
  );
  const current = currentTag ? normalizePlayerTagCode(currentTag) : undefined;

  const handleTagSelect = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTagSelect(tag);
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {playerName ? `Метка для ${playerName}` : 'Выберите метку'}
            </Text>
            <TouchableOpacity
              testID="close-tag-modal"
              accessibilityLabel="close-tag-modal"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.tagsContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.tagsGrid}>
              {sorted.map((tag) => {
                const tid = slugTestId(tag.code);
                const selected = current === tag.code;
                return (
                  <TouchableOpacity
                    key={tag.code}
                    testID={tid}
                    accessibilityLabel={tid}
                    accessibilityState={{ selected }}
                    onPress={() => handleTagSelect(tag.code)}
                    style={[
                      styles.tagButton,
                      { backgroundColor: tag.color },
                      selected && styles.selectedTag,
                    ]}
                  >
                    <Text style={styles.tagText}>{tag.label}</Text>
                    <Text style={styles.tagCode}>{tag.code}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                testID="player-tag-unknown"
                accessibilityLabel="player-tag-unknown"
                onPress={() => handleTagSelect('unknown')}
                style={[
                  styles.tagButton,
                  styles.clearButton,
                  current === 'unknown' && styles.selectedTag,
                ]}
              >
                <Text style={styles.tagText}>Снять метку</Text>
                <Text style={styles.tagCode}>unknown</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tagsContainer: {
    maxHeight: 400,
  },
  tagsGrid: {
    padding: 20,
    gap: 10,
  },
  tagButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  clearButton: {
    backgroundColor: '#4b5563',
  },
  selectedTag: {
    borderColor: '#F59E0B',
  },
  tagText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  tagCode: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
