/**
 * @file: NoteTagsSettingsSheet.tsx
 * @description: UI управления справочником быстрых тегов заметки (SC-7)
 * @dependencies: noteTagsStore, expo-haptics
 * @created: 2026-07-18
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
import { noteTagsStore, useNoteTagsStore } from '../stores/noteTags';
import { NOTE_TAG_GROUP_META } from '../constants/quickNoteTags';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const NoteTagsSettingsSheet: React.FC<Props> = ({ isOpen, onClose }) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { tags } = useNoteTagsStore();
  const sorted = useMemo(
    () => [...tags].sort((a, b) => a.sortOrder - b.sortOrder),
    [tags]
  );

  const [draftLabel, setDraftLabel] = useState('');
  const [draftGroup, setDraftGroup] = useState(NOTE_TAG_GROUP_META[0].id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
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
    setDraftGroup(NOTE_TAG_GROUP_META[0].id);
  };

  const handleAdd = async () => {
    const label = draftLabel.trim();
    if (label.length < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await noteTagsStore.createTag(label, draftGroup);
    resetAdd();
    setFocusTarget(null);
    Keyboard.dismiss();
  };

  const startEdit = (id: string | number | undefined, label: string) => {
    const key = id != null ? String(id) : null;
    setEditingId(key);
    setEditLabel(label);
    setFocusTarget('edit');
    // SC-10.2: не scrollToEnd — иначе rename в середине списка уезжает за IME
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
    await noteTagsStore.updateTag(id ?? code, { label });
    setEditingId(null);
    setFocusTarget(null);
  };

  const changeGroup = async (
    id: string | number | undefined,
    code: string,
    groupId: string
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await noteTagsStore.updateTag(id ?? code, { groupId });
  };

  const confirmDelete = (
    id: string | number | undefined,
    code: string,
    label: string
  ) => {
    Alert.alert(
      'Удалить тег?',
      `"${label}" — будет убран из справочника и из заметок, где уже стоит.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void noteTagsStore.deleteTag(id ?? code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const groupTitle = (gid: string) =>
    NOTE_TAG_GROUP_META.find((g) => g.id === gid)?.title ?? gid;

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.title}>Быстрые теги</Text>
          <TouchableOpacity
            testID="note-tags-settings-close"
            accessibilityLabel="note-tags-settings-close"
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
          <Text style={styles.section}>Справочник SC-3 / SC-7</Text>

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
                <View style={styles.rowBody}>
                  {isEditing ? (
                    <TextInput
                      testID={`note-tag-edit-${tag.code}`}
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
                  <Text style={styles.meta}>
                    {groupTitle(tag.groupId)} · {tag.code}
                  </Text>
                  <View style={styles.groupRow}>
                    {NOTE_TAG_GROUP_META.map((g) => (
                      <TouchableOpacity
                        key={g.id}
                        style={[
                          styles.groupChip,
                          tag.groupId === g.id && styles.groupChipOn,
                        ]}
                        onPress={() => void changeGroup(tag.id, tag.code, g.id)}
                      >
                        <Text
                          style={[
                            styles.groupChipText,
                            tag.groupId === g.id && styles.groupChipTextOn,
                          ]}
                        >
                          {g.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    testID={`note-tag-up-${tag.code}`}
                    onPress={() => void noteTagsStore.moveTag(tag.id ?? tag.code, 'up')}
                    style={styles.iconBtn}
                  >
                    <Text style={styles.iconBtnText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`note-tag-down-${tag.code}`}
                    onPress={() =>
                      void noteTagsStore.moveTag(tag.id ?? tag.code, 'down')
                    }
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
                      testID={`note-tag-rename-${tag.code}`}
                      onPress={() => startEdit(tag.id, tag.label)}
                      style={styles.iconBtn}
                    >
                      <Text style={styles.iconBtnText}>✎</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    testID={`note-tag-delete-${tag.code}`}
                    onPress={() => confirmDelete(tag.id, tag.code, tag.label)}
                    style={styles.iconBtn}
                  >
                    <Text style={[styles.iconBtnText, { color: '#f87171' }]}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <Text style={[styles.section, { marginTop: 20 }]}>Новый тег</Text>
          <TextInput
            testID="note-tag-new-label"
            accessibilityLabel="note-tag-new-label"
            style={styles.textInput}
            placeholder="Название"
            placeholderTextColor="#64748b"
            value={draftLabel}
            onChangeText={setDraftLabel}
            maxLength={80}
            onFocus={scrollToNewTag}
          />
          <View style={styles.groupRow}>
            {NOTE_TAG_GROUP_META.map((g) => (
              <TouchableOpacity
                key={g.id}
                testID={`note-tag-group-${g.id}`}
                style={[
                  styles.groupChip,
                  draftGroup === g.id && styles.groupChipOn,
                ]}
                onPress={() => setDraftGroup(g.id)}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    draftGroup === g.id && styles.groupChipTextOn,
                  ]}
                >
                  {g.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            testID="note-tag-add"
            accessibilityLabel="note-tag-add"
            style={[
              styles.addBtn,
              draftLabel.trim().length < 1 && styles.addBtnDisabled,
            ]}
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
  rowBody: { flex: 1, minWidth: 0 },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  editInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
  },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  groupChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  groupChipOn: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  groupChipText: { color: '#94a3b8', fontSize: 11 },
  groupChipTextOn: { color: '#fff', fontWeight: '600' },
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
