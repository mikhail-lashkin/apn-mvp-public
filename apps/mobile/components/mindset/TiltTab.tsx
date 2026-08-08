/**
 * @file: TiltTab.tsx
 * @description: Таб Tilt Helper с выбором уровня тильта и чек-листом ритуалов
 * @dependencies: mindset store, eventLogger
 * @created: 2025-01-28
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMindsetStore, TiltLevel } from '../../stores/mindset';
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

interface TiltTabProps {
  onComplete?: () => void;
}

export const TiltTab: React.FC<TiltTabProps> = ({ onComplete }) => {
  const store = useMindsetStore();
  const { tiltLevel, tiltRituals } = store;

  const handleLevelSelect = (level: TiltLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.setTiltLevel(level);
    eventLogger.logEvent('tilt', 'level_set', { level });
  };

  const handleRitualToggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.toggleTiltRitual(id);
  };

  const handleComplete = () => {
    const completedCount = store.completeTiltRitual();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    eventLogger.logEvent('tilt', 'ritual_complete', {
      level: tiltLevel,
      completedCount,
    });
    
    if (onComplete) {
      onComplete();
    }
  };

  const completedCount = tiltRituals.filter(r => r.done).length;
  const allCompleted = completedCount === tiltRituals.length;

  return (
    <View style={styles.container}>
      {/* Блок выбора уровня тильта */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Уровень тильта</Text>
        <View style={styles.levelContainer}>
          {[1, 2, 3, 4, 5].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelButton,
                tiltLevel === level && styles.levelButtonActive,
              ]}
              onPress={() => handleLevelSelect(level as TiltLevel)}
            >
              <Text
                style={[
                  styles.levelButtonText,
                  tiltLevel === level && styles.levelButtonTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Блок ритуалов */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ритуалы</Text>
        <View style={styles.ritualsContainer}>
          {tiltRituals.map((ritual) => (
            <TouchableOpacity
              key={ritual.id}
              style={[
                styles.ritualItem,
                ritual.done && styles.ritualItemDone,
              ]}
              onPress={() => handleRitualToggle(ritual.id)}
            >
              <View style={styles.checkbox}>
                {ritual.done && <View style={styles.checkboxChecked} />}
              </View>
              <Text
                style={[
                  styles.ritualText,
                  ritual.done && styles.ritualTextDone,
                ]}
              >
                {ritual.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Кнопка завершения */}
      <TouchableOpacity
        style={[
          styles.completeButton,
          !allCompleted && styles.completeButtonDisabled,
        ]}
        onPress={handleComplete}
        disabled={!allCompleted}
      >
        <Text style={styles.completeButtonText}>Ритуал выполнен</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  levelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  levelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: MD3_COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  levelButtonActive: {
    backgroundColor: MD3_COLORS.primary,
    borderColor: MD3_COLORS.primary,
  },
  levelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: MD3_COLORS.onSurfaceVariant,
  },
  levelButtonTextActive: {
    color: MD3_COLORS.onPrimary,
  },
  ritualsContainer: {
    gap: 12,
  },
  ritualItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: MD3_COLORS.surfaceVariant,
  },
  ritualItemDone: {
    backgroundColor: MD3_COLORS.primaryContainer,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: MD3_COLORS.outline,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: MD3_COLORS.primary,
  },
  ritualText: {
    flex: 1,
    fontSize: 16,
    color: MD3_COLORS.onSurface,
  },
  ritualTextDone: {
    color: MD3_COLORS.onPrimaryContainer,
    textDecorationLine: 'line-through',
  },
  completeButton: {
    marginTop: 'auto',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: MD3_COLORS.primary,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: MD3_COLORS.surfaceVariant,
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: MD3_COLORS.onPrimary,
  },
});

