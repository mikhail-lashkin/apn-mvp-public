/**
 * @file: ReviewTab.tsx
 * @description: Таб Mini Review / Energy с шкалой энергии и полями для целей/триггеров/плана
 * @dependencies: mindset store, eventLogger
 * @created: 2025-01-28
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMindsetStore } from '../../stores/mindset';
import { eventLogger } from '../../services/eventLogger';

// Material Design 3 цвета
const MD3_COLORS = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  background: '#FFFBFE',
  onBackground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
};

export const ReviewTab: React.FC = () => {
  const store = useMindsetStore();
  const { lastReview } = store;

  const [energy, setEnergy] = useState<number>(3);
  const [mainGoal, setMainGoal] = useState<string>('');
  const [trigger, setTrigger] = useState<string>('');
  const [plan, setPlan] = useState<string>('');

  // Загружаем последнее ревью при монтировании
  useEffect(() => {
    if (lastReview) {
      setEnergy(lastReview.energy);
      setMainGoal(lastReview.mainGoal);
      setTrigger(lastReview.trigger);
      setPlan(lastReview.plan);
    }
  }, []);

  const handleEnergySelect = (level: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnergy(level);
  };

  const handleSave = () => {
    if (!mainGoal.trim() && !trigger.trim() && !plan.trim()) {
      // Можно добавить валидацию, но по ТЗ не обязательно
      return;
    }

    store.saveReview({
      energy,
      mainGoal: mainGoal.trim(),
      trigger: trigger.trim(),
      plan: plan.trim(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    eventLogger.logEvent('review', 'save', { energy });

    // Очищаем поля после сохранения (кроме энергии)
    setMainGoal('');
    setTrigger('');
    setPlan('');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Шкала энергии */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Уровень энергии</Text>
        <View style={styles.energyContainer}>
          {[1, 2, 3, 4, 5].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.energyButton,
                energy === level && styles.energyButtonActive,
              ]}
              onPress={() => handleEnergySelect(level)}
            >
              <Text
                style={[
                  styles.energyButtonText,
                  energy === level && styles.energyButtonTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Поле главной цели */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Главная цель на сегодня</Text>
        <TextInput
          style={styles.input}
          placeholder="Введите цель (1-2 строки)"
          placeholderTextColor={MD3_COLORS.onSurfaceVariant}
          value={mainGoal}
          onChangeText={setMainGoal}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Поле триггеров */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Что меня триггерит?</Text>
        <TextInput
          style={styles.input}
          placeholder="Опишите триггеры (1-2 строки)"
          placeholderTextColor={MD3_COLORS.onSurfaceVariant}
          value={trigger}
          onChangeText={setTrigger}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Поле плана */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>План, если пойду в тильт</Text>
        <TextInput
          style={styles.input}
          placeholder="Опишите план действий (1-2 строки)"
          placeholderTextColor={MD3_COLORS.onSurfaceVariant}
          value={plan}
          onChangeText={setPlan}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Кнопка сохранения */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Сохранить</Text>
      </TouchableOpacity>

      {/* Последнее ревью */}
      {lastReview && (
        <View style={styles.lastReviewContainer}>
          <Text style={styles.lastReviewLabel}>
            Последнее ревью: {formatDate(lastReview.createdAt)}
          </Text>
          <View style={styles.lastReviewContent}>
            <View style={styles.lastReviewItem}>
              <Text style={styles.lastReviewItemLabel}>Энергия:</Text>
              <Text style={styles.lastReviewItemValue}>{lastReview.energy}/5</Text>
            </View>
            {lastReview.mainGoal && (
              <View style={styles.lastReviewItem}>
                <Text style={styles.lastReviewItemLabel}>Цель:</Text>
                <Text style={styles.lastReviewItemValue}>{lastReview.mainGoal}</Text>
              </View>
            )}
            {lastReview.trigger && (
              <View style={styles.lastReviewItem}>
                <Text style={styles.lastReviewItemLabel}>Триггер:</Text>
                <Text style={styles.lastReviewItemValue}>{lastReview.trigger}</Text>
              </View>
            )}
            {lastReview.plan && (
              <View style={styles.lastReviewItem}>
                <Text style={styles.lastReviewItemLabel}>План:</Text>
                <Text style={styles.lastReviewItemValue}>{lastReview.plan}</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: MD3_COLORS.onSurface,
    marginBottom: 12,
  },
  energyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  energyButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: MD3_COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  energyButtonActive: {
    backgroundColor: MD3_COLORS.primary,
    borderColor: MD3_COLORS.primary,
  },
  energyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: MD3_COLORS.onSurfaceVariant,
  },
  energyButtonTextActive: {
    color: MD3_COLORS.onPrimary,
  },
  input: {
    minHeight: 80,
    padding: 12,
    borderRadius: 12,
    backgroundColor: MD3_COLORS.surfaceVariant,
    color: MD3_COLORS.onSurface,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: MD3_COLORS.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: MD3_COLORS.onPrimary,
  },
  lastReviewContainer: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: MD3_COLORS.surfaceVariant,
  },
  lastReviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: MD3_COLORS.onSurfaceVariant,
    marginBottom: 12,
  },
  lastReviewContent: {
    gap: 8,
  },
  lastReviewItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  lastReviewItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: MD3_COLORS.onSurfaceVariant,
    marginRight: 8,
    minWidth: 80,
  },
  lastReviewItemValue: {
    flex: 1,
    fontSize: 14,
    color: MD3_COLORS.onSurface,
  },
});

