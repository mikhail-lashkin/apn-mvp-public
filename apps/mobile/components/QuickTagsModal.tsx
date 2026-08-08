/**
 * @file: QuickTagsModal.tsx
 * @description: Модальное окно быстрых тегов с haptic feedback и автосохранением
 * @dependencies: React Native, expo-haptics, expo-linear-gradient
 * @created: 2025-01-28
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export interface PlayerTag {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface QuickNote {
  playerId: string;
  tag: PlayerTag;
  note: string;
  timestamp: number;
}

interface QuickTagsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (note: QuickNote) => void;
  playerName?: string;
  playerId?: string;
}

const PLAYER_TAGS: PlayerTag[] = [
  {
    id: 'TAG',
    name: 'TAG',
    color: '#3b82f6',
    description: 'Tight-Aggressive',
  },
  {
    id: 'LAG',
    name: 'LAG',
    color: '#ef4444',
    description: 'Loose-Aggressive',
  },
  {
    id: 'NIT',
    name: 'NIT',
    color: '#8b5cf6',
    description: 'Tight-Passive',
  },
  {
    id: 'MANIAC',
    name: 'MANIAC',
    color: '#f97316',
    description: 'Very Aggressive',
  },
  {
    id: 'FISH',
    name: 'FISH',
    color: '#10b981',
    description: 'Weak Player',
  },
  {
    id: 'REG',
    name: 'REG',
    color: '#fbbf24',
    description: 'Regular Player',
  },
  {
    id: 'UNKNOWN',
    name: 'UNKNOWN',
    color: '#6b7280',
    description: 'Unknown',
  },
];

const QUICK_TEMPLATES = [
  'Часто блефует',
  'Слишком тайтовый',
  'Агрессивный на ривере',
  'Слабая игра',
  'Хороший игрок',
  'Много коллов',
];

export default function QuickTagsModal({
  visible,
  onClose,
  onSave,
  playerName = 'Игрок',
  playerId = 'unknown',
}: QuickTagsModalProps) {
  const [selectedTag, setSelectedTag] = useState<PlayerTag | null>(null);
  const [note, setNote] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Автосохранение при изменении заметки
  useEffect(() => {
    if (note.length > 0 && selectedTag) {
      const timer = setTimeout(() => {
        handleAutoSave();
      }, 3000); // Автосохранение через 3 секунды

      return () => clearTimeout(timer);
    }
  }, [note, selectedTag]);

  const handleTagSelect = async (tag: PlayerTag) => {
    setSelectedTag(tag);
    
    // Haptic feedback при выборе тега
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const handleTemplateSelect = (template: string) => {
    setNote(template);
    
    // Haptic feedback при выборе шаблона
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAutoSave = async () => {
    if (!selectedTag || note.length === 0) return;

    setIsAutoSaving(true);
    
    try {
      const quickNote: QuickNote = {
        playerId,
        tag: selectedTag,
        note,
        timestamp: Date.now(),
      };

      onSave(quickNote);
      
      // Haptic feedback при автосохранении
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Показываем краткое уведомление об автосохранении
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 1000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setIsAutoSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!selectedTag) {
      Alert.alert('Ошибка', 'Пожалуйста, выберите тег игрока');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      const quickNote: QuickNote = {
        playerId,
        tag: selectedTag,
        note: note || 'Быстрая заметка',
        timestamp: Date.now(),
      };

      onSave(quickNote);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleClose = () => {
    if (note.length > 0 || selectedTag) {
      Alert.alert(
        'Несохраненные изменения',
        'У вас есть несохраненные изменения. Сохранить?',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Не сохранять', onPress: onClose },
          { text: 'Сохранить', onPress: handleManualSave },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between p-6 border-b border-slate-600">
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-blue-400 text-lg">Отмена</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-white text-lg font-semibold">
              Быстрая заметка
            </Text>
            <Text className="text-slate-400 text-sm">
              {playerName}
            </Text>
          </View>
          <TouchableOpacity onPress={handleManualSave}>
            <Text className="text-blue-400 text-lg font-semibold">Сохранить</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-1 p-6">
          {/* Player Tags */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Тег игрока
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {PLAYER_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => handleTagSelect(tag)}
                  className={`px-4 py-3 rounded-xl border-2 ${
                    selectedTag?.id === tag.id
                      ? 'border-white'
                      : 'border-slate-600'
                  }`}
                  style={{
                    backgroundColor: selectedTag?.id === tag.id ? tag.color : '#374151',
                  }}
                >
                  <Text className="text-white text-center font-semibold">
                    {tag.name}
                  </Text>
                  <Text className="text-white/70 text-xs text-center">
                    {tag.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quick Templates */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Быстрые шаблоны
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {QUICK_TEMPLATES.map((template, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleTemplateSelect(template)}
                  className="bg-slate-700 px-3 py-2 rounded-lg"
                >
                  <Text className="text-slate-300 text-sm">{template}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Note Input */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Заметка
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Введите заметку о игроке..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              className="bg-slate-800 text-white px-4 py-4 rounded-xl border border-slate-600"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* Auto-save indicator */}
          {isAutoSaving && (
            <View className="bg-green-500/20 border border-green-500 rounded-lg p-3 mb-4">
              <Text className="text-green-400 text-sm text-center">
                💾 Автосохранение...
              </Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleManualSave}
            disabled={!selectedTag}
            className={`py-4 rounded-xl ${
              selectedTag ? 'bg-blue-600' : 'bg-slate-600'
            }`}
          >
            <Text className="text-white text-lg font-semibold text-center">
              {selectedTag ? 'Сохранить заметку' : 'Выберите тег'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}
