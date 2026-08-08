/**
 * @file: QuickNote.tsx
 * @description: Модальное окно быстрой заметки — крупный текст, быстрые теги (SC-3)
 * @dependencies: react-native, expo-haptics, PlayerPicker, TagChipPicker, quickNoteTags
 * @created: 2025-01-28
 * @updated: 2026-07-15
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import { tableStore, Player } from '../stores/table';
import { mapNoteSaveError } from '../services/api/errors';
import { isNetworkOnline } from '../services/sync/syncService';
import { logger, EVENTS } from '../services/logger';
import {
  normalizeQuickNoteTag,
} from '../constants/quickNoteTags';
import {
  localRuleRecommendation,
  type LocalRecommendation,
} from '../constants/colorLineMap';
import { recommendationApi } from '../services/api/recommendationApi';
import { useNoteTagsStore } from '../stores/noteTags';
import { PlayerPicker } from './PlayerPicker';
import { TagChipPicker } from './TagChipPicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QuickNoteProps {
  isOpen: boolean;
  onClose: () => void;
  playerName?: string;
  seatNumber?: number;
  tableId: string;
  playerId: string;
  onCreateNewPlayer?: () => void;
}

/** Канон из конфига; неизвестные теги заметки сохраняем как есть (не теряем). */
function normalizeNoteTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = String(item).trim();
    if (!trimmed) continue;
    const known = normalizeQuickNoteTag(trimmed);
    out.push(known ?? trimmed);
  }
  return [...new Set(out)];
}

export const QuickNote: React.FC<QuickNoteProps> = memo(({
  isOpen,
  onClose,
  playerName,
  seatNumber,
  playerId: initialPlayerId,
  onCreateNewPlayer,
}) => {
  const insets = useSafeAreaInsets();
  const { groups: noteTagGroups } = useNoteTagsStore();
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState(initialPlayerId);
  const [noteCount, setNoteCount] = useState(0);
  const [playerOptions, setPlayerOptions] = useState<Player[]>([]);
  // S23/IME: sheet не выше клавиатуры; иначе height:92% + marginBottom уезжает вверх
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [recLoading, setRecLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<LocalRecommendation | null>(
    null
  );
  const userEditedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const noteSectionYRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setRecommendation(null);
      setRecLoading(false);
    }
  }, [isOpen]);

  const handleFetchRecommendation = useCallback(async () => {
    const player = tableStore.getPlayer(currentPlayerId);
    const tag = player?.tags?.[0] ?? 'unknown';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecLoading(true);
    try {
      const net = await NetInfo.fetch();
      const online = isNetworkOnline(net);
      const backendId = player?.backendId ?? null;

      if (!online || backendId == null) {
        setRecommendation(localRuleRecommendation(tag, noteCount));
        return;
      }

      const remote = await recommendationApi.getForPlayer(backendId, {
        force_refresh: true,
      });
      setRecommendation(remote);
    } catch (err) {
      console.warn('recommendation failed, local rule', err);
      const player2 = tableStore.getPlayer(currentPlayerId);
      setRecommendation(
        localRuleRecommendation(player2?.tags?.[0], noteCount)
      );
    } finally {
      setRecLoading(false);
      // карточка появляется под кнопкой — подтянуть в кадр (Maestro + IME)
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [currentPlayerId, noteCount]);

  const applyLastNoteToForm = useCallback(
    (playerId: string, opts?: { preserveEditedText?: boolean }) => {
      const player = tableStore.getPlayer(playerId);
      const display =
        player?.name?.trim() || playerName?.trim() || undefined;
      const notePlayerId = tableStore.resolvePlayerIdForNotes(playerId, display);

      const lastNote =
        tableStore.getLastNote(notePlayerId) ?? tableStore.getLastNote(playerId);
      const count =
        tableStore.getNoteCount(notePlayerId) ||
        tableStore.getNoteCount(playerId);
      setNoteCount(count);

      // После API-load не затираем набор пользователя — иначе «мерцание» текста
      if (opts?.preserveEditedText && userEditedRef.current) {
        return;
      }

      if (lastNote && (lastNote.text?.trim() || (lastNote.tags?.length ?? 0) > 0)) {
        setText(lastNote.text?.trim() ? lastNote.text : '');
        setSelectedTags(normalizeNoteTags(lastNote.tags ?? []));
      } else {
        setText('');
        // Метка игрока ≠ теги заметки (SC-3 / SC-6) — форму не префиллим из player.tags
        setSelectedTags([]);
      }
    },
    [playerName]
  );

  const handleTextChange = useCallback((value: string) => {
    userEditedRef.current = true;
    setText(value);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      userEditedRef.current = false;
      setText('');
      setSelectedTags([]);
      setIsSaving(false);
      setNoteCount(0);
      setPlayerOptions([]);
      setRecommendation(null);
      setRecLoading(false);
      return;
    }

    userEditedRef.current = false;
    setIsSaving(false);
    setCurrentPlayerId(initialPlayerId);
    // Именованные + текущий (в т.ч. безымянный) — иначе picker пустой / «Игрок...»
    const all = tableStore.listPlayers();
    const named = all.filter((p) => Boolean(p.name?.trim()));
    const current = all.find((p) => p.id === initialPlayerId);
    const options =
      current && !named.some((p) => p.id === current.id)
        ? [current, ...named]
        : named;
    setPlayerOptions(options);
    applyLastNoteToForm(initialPlayerId);
    const generation = ++loadGenerationRef.current;

    const load = async () => {
      try {
        const net = await NetInfo.fetch();
        if (!isNetworkOnline(net)) {
          return;
        }

        await tableStore.loadLastNoteFromApi(initialPlayerId);
        if (generation !== loadGenerationRef.current) {
          return;
        }

        applyLastNoteToForm(initialPlayerId, { preserveEditedText: true });
      } catch {
        // локальная форма
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPlayerId]);

  const handlePlayerChange = async (newPlayerId: string) => {
    if (newPlayerId === currentPlayerId) return;

    if (text.trim() && userEditedRef.current) {
      logger.logEvent(EVENTS.NOTE_AUTOSAVE, {
        playerId: currentPlayerId,
        via: 'player_switch',
      });
      const saved = await persistNote();
      if (!saved) {
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentPlayerId(newPlayerId);
    userEditedRef.current = false;
    applyLastNoteToForm(newPlayerId);

    try {
      const net = await NetInfo.fetch();
      if (!isNetworkOnline(net)) {
        return;
      }
      await tableStore.loadLastNoteFromApi(newPlayerId);
      if (!userEditedRef.current) {
        applyLastNoteToForm(newPlayerId);
      }
    } catch {
      // локальная форма
    }
  };

  const hasContent = text.trim().length > 0 || selectedTags.length > 0;
  const canSave = hasContent && !isSaving;

  const persistNote = async (): Promise<boolean> => {
    if (!hasContent || isSaving) {
      return true;
    }

    try {
      setIsSaving(true);
      await tableStore.saveNote(currentPlayerId, {
        text: text.trim(),
        tags: selectedTags,
      });
      return true;
    } catch (error) {
      console.error('Ошибка сохранения заметки:', error);
      Alert.alert('Ошибка сохранения', mapNoteSaveError(error));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(async () => {
    if (hasContent && userEditedRef.current) {
      logger.logEvent(EVENTS.NOTE_AUTOSAVE, {
        playerId: currentPlayerId,
        via: 'close',
      });
      const saved = await persistNote();
      if (!saved) {
        return;
      }
    }
    onClose();
  }, [text, currentPlayerId, isSaving, selectedTags, onClose]);

  const handleSave = async () => {
    if (!canSave) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const saved = await persistNote();
    if (saved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }
  };

  const noteTitle = (() => {
    const name = playerName?.trim();
    if (name) return `Заметка: ${name}`;
    // seatNumber с стола — 0-based
    if (seatNumber != null && seatNumber >= 0) {
      return `Заметка: Без имени · ${seatNumber + 1}`;
    }
    return 'Быстрая заметка';
  })();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={() => {
        void handleClose();
      }}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        // Android: behavior=height даёт мерцание при вводе + IME
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View
          style={[
            styles.modal,
            {
              // Без явной height sheet схлопывается до header+footer
              // (ScrollView flex:1 → 0) — на S23 пропадали текст/теги.
              paddingBottom: Math.max(insets.bottom, 8),
              ...(keyboardHeight > 0
                ? {
                    marginBottom: keyboardHeight,
                    height: Math.max(
                      360,
                      Dimensions.get('window').height - keyboardHeight - 8
                    ),
                    maxHeight:
                      Dimensions.get('window').height - keyboardHeight - 8,
                  }
                : {
                    height: '92%' as const,
                    maxHeight: '92%' as const,
                  }),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.title} numberOfLines={1}>
                {noteTitle}
              </Text>
              {noteCount > 0 ? (
                <Text style={styles.subtitle}>
                  В профиле: {noteCount}{' '}
                  {noteCount === 1 ? 'заметка' : noteCount < 5 ? 'заметки' : 'заметок'}
                </Text>
              ) : (
                <Text style={styles.subtitle}>Новая заметка</Text>
              )}
            </View>
            <TouchableOpacity
              testID="close-player-profile"
              accessibilityLabel="close-player-profile"
              onPress={() => {
                void handleClose();
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            removeClippedSubviews={false}
          >
            <View style={styles.compactSection}>
              <PlayerPicker
                players={playerOptions}
                selectedPlayerId={currentPlayerId}
                onPlayerSelect={handlePlayerChange}
                onCreateNewPlayer={onCreateNewPlayer}
                placeholder="Игрок..."
              />
            </View>

            <View
              style={styles.noteSection}
              onLayout={(e) => {
                noteSectionYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionTitle}>Текст заметки</Text>
              <TextInput
                testID="quick-note-text"
                accessibilityLabel="quick-note-text"
                value={text}
                onChangeText={handleTextChange}
                placeholder="Опиши руки, сайзинг, тенденции… Здесь можно много текста."
                placeholderTextColor="#6b7280"
                multiline
                style={styles.textInput}
                autoFocus={Platform.OS === 'ios'}
                autoCorrect={false}
                spellCheck={false}
                keyboardType="default"
                textAlignVertical="top"
                importantForAutofill="no"
                blurOnSubmit={false}
                onFocus={() => {
                  // SC-10.1: поле ввода остаётся в кадре над IME
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({
                      y: Math.max(0, noteSectionYRef.current - 12),
                      animated: true,
                    });
                  });
                }}
              />
            </View>

            <View style={styles.compactSection}>
              <TagChipPicker
                groups={noteTagGroups()}
                selected={selectedTags}
                onChange={(next) => {
                  userEditedRef.current = true;
                  setSelectedTags(next);
                  // После чипа — убрать IME, чтобы Save/остальные группы были видны
                  Keyboard.dismiss();
                }}
                title="Быстрые теги"
                testIdPrefix="note-tag"
              />
            </View>

            <View style={styles.recSection}>
              <TouchableOpacity
                testID="quick-note-recommendation"
                accessibilityLabel="quick-note-recommendation"
                onPress={() => {
                  void handleFetchRecommendation();
                }}
                style={[styles.recButton, recLoading && styles.disabledButton]}
                disabled={recLoading}
              >
                <Text style={styles.recButtonText}>
                  {recLoading ? 'Анализ…' : 'Рекомендация'}
                </Text>
              </TouchableOpacity>
              {recommendation ? (
                <View style={styles.recCard} testID="quick-note-rec-result" accessibilityLabel="quick-note-rec-result">
                  <Text style={styles.recMeta} testID="quick-note-rec-meta">
                    {recommendation.source === 'llm' ? 'AI' : 'Rule'}
                    {recommendation.provider !== 'none'
                      ? ` · ${recommendation.provider}`
                      : ''}
                    {' · '}
                    {Math.round(recommendation.confidence * 100)}%
                    {recommendation.caution_flags?.length
                      ? ` · ${recommendation.caution_flags[0]}`
                      : ''}
                  </Text>
                  <Text style={styles.recText} testID="quick-note-rec-text">{recommendation.recommendation}</Text>
                  {recommendation.patterns?.length > 0 ? (
                    <Text style={styles.recPatterns}>
                      {recommendation.patterns.slice(0, 3).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.recHint}>
                  По запросу: линия по метке/нотсам (offline → rule map)
                </Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => {
                void handleClose();
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="quick-note-save"
              accessibilityLabel="quick-note-save"
              onPress={handleSave}
              style={[
                styles.saveButton,
                !canSave && styles.disabledButton,
              ]}
              disabled={!canSave}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

QuickNote.displayName = 'QuickNote';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitles: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  compactSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  noteSection: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    // Раньше 280 — с клавиатурой + тегами Save уезжал за IME (S23)
    minHeight: 140,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    flexGrow: 1,
    minHeight: 120,
    maxHeight: 220,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#6b7280',
    opacity: 0.5,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  recSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 10,
  },
  recButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  recButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  recHint: {
    color: '#64748b',
    fontSize: 12,
  },
  recCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  recMeta: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  recText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 21,
  },
  recPatterns: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
});
