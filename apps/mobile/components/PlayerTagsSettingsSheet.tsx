/**
 * @file: PlayerTagsSettingsSheet.tsx
 * @description: UI управления справочником меток (SC-6 шаг 2)
 * @dependencies: playerTagsStore, expo-haptics
 * @created: 2026-07-17
 * @updated: 2026-07-19
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playerTagsStore, usePlayerTagsStore } from '../stores/playerTags';
import { PLAYER_TAG_PALETTE } from '../constants/playerTags';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const PlayerTagsSettingsSheet: React.FC<Props> = ({ isOpen, onClose }) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { tags } = usePlayerTagsStore();
  const sorted = useMemo(
    () => [...tags].sort((a, b) => a.sortOrder - b.sortOrder),
    [tags]
  );

  const [draftLabel, setDraftLabel] = useState('');
  const [draftColor, setDraftColor] = useState<string>(PLAYER_TAG_PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  // Android: KAV behavior выключен — padding снизу + scroll к focused полю
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [focusTarget, setFocusTarget] = useState<'edit' | 'new' | null>(null);
  const rowYRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      setFocusTarget(null);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      setTimeout(() => {
        if (focusTarget === 'new') {
          scrollRef.current?.scrollToEnd({ animated: true });
        } else if (focusTarget === 'edit' && editingId != null) {
          const y = rowYRef.current[editingId] ?? 0;
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
        }
      }, 50);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [isOpen, focusTarget, editingId]);

  const scrollToNewTag = () => {
    setFocusTarget('new');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const resetAdd = () => {
    setDraftLabel('');
    setDraftColor(PLAYER_TAG_PALETTE[0]);
  };

  const handleAdd = async () => {
    const label = draftLabel.trim();
    if (label.length < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await playerTagsStore.createTag(label, draftColor);
    resetAdd();
    setFocusTarget(null);
    Keyboard.dismiss();
  };

  const startEdit = (id: string | number | undefined, label: string) => {
    const key = id != null ? String(id) : null;
    setEditingId(key);
    setEditLabel(label);
    setFocusTarget('edit');
    // SC-10.3: scroll к строке rename, не к «Новая метка»
    requestAnimationFrame(() => {
      if (key == null) return;
      const y = rowYRef.current[key] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    });
  };

  const saveEdit = async (id: string | number | undefined, code: string) => {
    const label = editLabel.trim();
    if (!label) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await playerTagsStore.updateTag(id ?? code, { label });
    setEditingId(null);
    setFocusTarget(null);
  };

  const changeColor = async (id: string | number | undefined, code: string, color: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await playerTagsStore.updateTag(id ?? code, { color });
  };

  const confirmDelete = (id: string | number | undefined, code: string, label: string) => {
    Alert.alert('Удалить метку?', `"${label}" — игроки с этой меткой станут без метки.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void playerTagsStore.deleteTag(id ?? code);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.title}>Метки игроков</Text>
          <TouchableOpacity
            testID="player-tags-settings-close"
            accessibilityLabel="player-tags-settings-close"
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>Готово</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom:
                40 +
                Math.max(insets.bottom, 8) +
                (keyboardHeight > 0 ? keyboardHeight : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.section}>Справочник ColorSystem</Text>

          {sorted.map((tag) => {
            const key = String(tag.id ?? tag.code);
            const isEditing = editingId === key;
            return (
              <View
                key={key}
                style={styles.row}
                onLayout={(e) => {
                  rowYRef.current[key] = e.nativeEvent.layout.y;
                }}
              >
                <View style={[styles.swatch, { backgroundColor: tag.color }]} />
                <View style={styles.rowBody}>
                  {isEditing ? (
                    <TextInput
                      testID={`player-tag-edit-${tag.code}`}
                      style={styles.editInput}
                      value={editLabel}
                      onChangeText={setEditLabel}
                      autoFocus
                      onFocus={() => {
                        setFocusTarget('edit');
                        const y = rowYRef.current[key] ?? 0;
                        scrollRef.current?.scrollTo({
                          y: Math.max(0, y - 16),
                          animated: true,
                        });
                      }}
                      onSubmitEditing={() => void saveEdit(tag.id, tag.code)}
                    />
                  ) : (
                    <Text style={styles.label} numberOfLines={1}>
                      {tag.label}
                    </Text>
                  )}
                  <Text style={styles.code}>{tag.code}</Text>
                  <View style={styles.paletteRow}>
                    {PLAYER_TAG_PALETTE.slice(0, 6).map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.miniSwatch,
                          { backgroundColor: c },
                          tag.color === c && styles.miniSwatchOn,
                        ]}
                        onPress={() => void changeColor(tag.id, tag.code, c)}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    testID={`player-tag-up-${tag.code}`}
                    onPress={() => void playerTagsStore.moveTag(tag.id ?? tag.code, 'up')}
                    style={styles.iconBtn}
                  >
                    <Text style={styles.iconBtnText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`player-tag-down-${tag.code}`}
                    onPress={() => void playerTagsStore.moveTag(tag.id ?? tag.code, 'down')}
                    style={styles.iconBtn}
                  >
                    <Text style={styles.iconBtnText}>↓</Text>
                  </TouchableOpacity>
                  {isEditing ? (
                    <TouchableOpacity
                      onPress={() => void saveEdit(tag.id, tag.code)}
                      style={styles.iconBtn}
                    >
                      <Text style={styles.iconBtnText}>✓</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      testID={`player-tag-rename-${tag.code}`}
                      onPress={() => startEdit(tag.id, tag.label)}
                      style={styles.iconBtn}
                    >
                      <Text style={styles.iconBtnText}>✎</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    testID={`player-tag-delete-${tag.code}`}
                    onPress={() => confirmDelete(tag.id, tag.code, tag.label)}
                    style={styles.iconBtn}
                  >
                    <Text style={[styles.iconBtnText, { color: '#f87171' }]}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <Text style={[styles.section, { marginTop: 20 }]}>Новая метка</Text>
          <TextInput
            testID="player-tag-new-label"
            accessibilityLabel="player-tag-new-label"
            style={styles.textInput}
            placeholder="Название (эмодзи ок)"
            placeholderTextColor="#64748b"
            value={draftLabel}
            onChangeText={setDraftLabel}
            maxLength={80}
            onFocus={scrollToNewTag}
          />
          <View style={styles.paletteRow}>
            {PLAYER_TAG_PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                testID={`player-tag-palette-${c.replace('#', '')}`}
                style={[
                  styles.paletteDot,
                  { backgroundColor: c },
                  draftColor === c && styles.paletteDotOn,
                ]}
                onPress={() => setDraftColor(c)}
              />
            ))}
          </View>
          <TouchableOpacity
            testID="player-tag-add"
            accessibilityLabel="player-tag-add"
            style={[styles.addBtn, draftLabel.trim().length < 1 && styles.addBtnDisabled]}
            disabled={draftLabel.trim().length < 1}
            onPress={() => void handleAdd()}
          >
            <Text style={styles.addBtnText}>Добавить</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 8 },
  closeText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 40 },
  section: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  swatch: { width: 28, height: 28, borderRadius: 8, marginTop: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
  code: { color: '#64748b', fontSize: 11, marginTop: 2 },
  editInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
  },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  miniSwatch: { width: 18, height: 18, borderRadius: 9 },
  miniSwatchOn: { borderWidth: 2, borderColor: '#fff' },
  actions: { gap: 4 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  paletteDot: { width: 28, height: 28, borderRadius: 14 },
  paletteDotOn: { borderWidth: 2, borderColor: '#fff' },
  addBtn: {
    marginTop: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
