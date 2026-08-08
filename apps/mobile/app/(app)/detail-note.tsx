/**
 * @file: detail-note.tsx
 * @description: Экран подробной заметки с тегами и дополнительными полями
 * @dependencies: expo-router, React Native, expo-linear-gradient
 * @created: 2025-01-28
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface DetailNote {
  id: string;
  playerId: string;
  playerName: string;
  tag: string;
  text: string;
  tags: string[];
  session: string;
  stakes: string;
  timestamp: number;
}

const AVAILABLE_TAGS = [
  'агрессия',
  'блеф',
  'тайтовый',
  'лузовый',
  'ривер',
  'флоп',
  'терн',
  'префлоп',
  'позиция',
  'банк',
  'колл',
  'рейз',
  'фолд',
  'чек',
  'бет',
];

export default function DetailNoteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { playerId, playerName, tag, initialText } = params;

  const [note, setNote] = useState<DetailNote>({
    id: Date.now().toString(),
    playerId: (playerId as string) || 'unknown',
    playerName: (playerName as string) || 'Игрок',
    tag: (tag as string) || 'UNKNOWN',
    text: (initialText as string) || '',
    tags: [],
    session: 'Сессия 1',
    stakes: '1/2',
    timestamp: Date.now(),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Отслеживание изменений для автосохранения
  useEffect(() => {
    if (note.text.length > 0) {
      setHasUnsavedChanges(true);
      
      // Автосохранение через 5 секунд после последнего изменения
      const timer = setTimeout(() => {
        handleAutoSave();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [note.text, note.tags]);

  const handleAutoSave = async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    
    try {
      // Имитация сохранения
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasUnsavedChanges(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (note.text.trim().length === 0) {
      Alert.alert('Ошибка', 'Пожалуйста, введите текст заметки');
      return;
    }

    setIsSaving(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Имитация сохранения
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setHasUnsavedChanges(false);
      Alert.alert('Успех', 'Заметка сохранена', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить заметку');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagToggle = async (tag: string) => {
    const newTags = note.tags.includes(tag)
      ? note.tags.filter(t => t !== tag)
      : [...note.tags, tag];
    
    setNote({ ...note, tags: newTags });
    setHasUnsavedChanges(true);
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Несохраненные изменения',
        'У вас есть несохраненные изменения. Сохранить?',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Не сохранять', onPress: () => router.back() },
          { text: 'Сохранить', onPress: handleSave },
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        className="flex-1"
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between p-6 border-b border-slate-600"
          style={{ paddingTop: Math.max(insets.top, 12) + 12 }}
        >
          <TouchableOpacity onPress={handleBack}>
            <Text className="text-blue-400 text-lg">← Назад</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-white text-lg font-semibold">
              Подробная заметка
            </Text>
            <Text className="text-slate-400 text-sm">
              {note.playerName} • {note.tag}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            <Text className={`text-lg font-semibold ${isSaving ? 'text-slate-400' : 'text-blue-400'}`}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-6">
          {/* Player Info */}
          <View className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-600">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white text-lg font-semibold">
                {note.playerName}
              </Text>
              <View className="bg-blue-600 px-3 py-1 rounded-full">
                <Text className="text-white text-sm font-medium">
                  {note.tag}
                </Text>
              </View>
            </View>
            <Text className="text-slate-400 text-sm">
              Сессия: {note.session} • Лимиты: ${note.stakes}
            </Text>
          </View>

          {/* Note Text */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Текст заметки
            </Text>
            <TextInput
              value={note.text}
              onChangeText={(text) => setNote({ ...note, text })}
              placeholder="Опишите поведение игрока, его стиль игры, важные моменты..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={8}
              className="bg-slate-800 text-white px-4 py-4 rounded-xl border border-slate-600"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* Tags */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Теги
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleTagToggle(tag)}
                  className={`px-3 py-2 rounded-lg border ${
                    note.tags.includes(tag)
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-slate-700 border-slate-600'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      note.tags.includes(tag) ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Session Info */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Информация о сессии
            </Text>
            <View className="space-y-4">
              <View>
                <Text className="text-slate-300 text-sm mb-2">Название сессии</Text>
                <TextInput
                  value={note.session}
                  onChangeText={(session) => setNote({ ...note, session })}
                  className="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-600"
                />
              </View>
              <View>
                <Text className="text-slate-300 text-sm mb-2">Лимиты</Text>
                <TextInput
                  value={note.stakes}
                  onChangeText={(stakes) => setNote({ ...note, stakes })}
                  className="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-600"
                />
              </View>
            </View>
          </View>

          {/* Status indicators */}
          {hasUnsavedChanges && (
            <View className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 mb-4">
              <Text className="text-yellow-400 text-sm text-center">
                ⚠️ Есть несохраненные изменения
              </Text>
            </View>
          )}

          {isSaving && (
            <View className="bg-blue-500/20 border border-blue-500 rounded-lg p-3 mb-4">
              <Text className="text-blue-400 text-sm text-center">
                💾 Сохранение...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View className="p-6 border-t border-slate-600">
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving || note.text.trim().length === 0}
            className={`py-4 rounded-xl ${
              isSaving || note.text.trim().length === 0
                ? 'bg-slate-600'
                : 'bg-blue-600'
            }`}
          >
            <Text className="text-white text-lg font-semibold text-center">
              {isSaving ? 'Сохранение...' : 'Сохранить заметку'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
