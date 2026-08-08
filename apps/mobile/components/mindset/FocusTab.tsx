/**
 * @file: FocusTab.tsx
 * @description: Таб Focus Helper (Poker Pomodoro) с таймером и пресетами
 * @dependencies: mindset store, eventLogger
 * @created: 2025-01-28
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

export const FocusTab: React.FC = () => {
  const store = useMindsetStore();
  const { focusSession } = store;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Запуск/остановка таймера
  useEffect(() => {
    if (focusSession && (focusSession.phase === 'focus' || focusSession.phase === 'break')) {
      // Запускаем таймер
      intervalRef.current = setInterval(() => {
        store.tickFocus();
      }, 1000);
    } else {
      // Останавливаем таймер
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [focusSession?.phase, focusSession?.remainingSeconds]);

  // Обработка завершения сессии
  useEffect(() => {
    if (focusSession?.phase === 'finished') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      eventLogger.logEvent('focus', 'finish', {
        presetMinutes: focusSession.presetMinutes,
        focusMinutes: focusSession.focusMinutes,
        breakMinutes: focusSession.breakMinutes,
      });
    }
  }, [focusSession?.phase]);

  const handlePresetSelect = (presetMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    store.startFocus(presetMinutes);
    eventLogger.logEvent('focus', 'start', { presetMinutes });
  };

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.pauseFocus();
  };

  const handleResume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.resumeFocus();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    store.resetFocus();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseLabel = (): string => {
    if (!focusSession) return 'Не запущено';
    switch (focusSession.phase) {
      case 'focus':
        return 'Фокус';
      case 'break':
        return 'Перерыв';
      case 'finished':
        return 'Завершено';
      case 'idle':
        return 'На паузе';
      default:
        return 'Не запущено';
    }
  };

  const getPhaseColor = (): string => {
    if (!focusSession) return MD3_COLORS.surfaceVariant;
    switch (focusSession.phase) {
      case 'focus':
        return MD3_COLORS.primary;
      case 'break':
        return MD3_COLORS.secondaryContainer;
      case 'finished':
        return MD3_COLORS.tertiaryContainer;
      case 'idle':
        return MD3_COLORS.outlineVariant;
      default:
        return MD3_COLORS.surfaceVariant;
    }
  };

  return (
    <View style={styles.container}>
      {/* Блок выбора пресета */}
      {!focusSession && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Выберите пресет</Text>
          <View style={styles.presetContainer}>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => handlePresetSelect(25)}
            >
              <Text style={styles.presetButtonText}>25/5</Text>
              <Text style={styles.presetButtonSubtext}>25 мин фокус / 5 мин перерыв</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => handlePresetSelect(45)}
            >
              <Text style={styles.presetButtonText}>45/10</Text>
              <Text style={styles.presetButtonSubtext}>45 мин фокус / 10 мин перерыв</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Таймер */}
      {focusSession && (
        <View style={styles.section}>
          <View style={[styles.timerContainer, { backgroundColor: getPhaseColor() }]}>
            <Text style={styles.timerLabel}>{getPhaseLabel()}</Text>
            <Text style={styles.timerText}>
              {formatTime(focusSession.remainingSeconds)}
            </Text>
          </View>

          {/* Кнопки управления */}
          <View style={styles.controlsContainer}>
            {focusSession.phase === 'idle' ? (
              <TouchableOpacity
                style={[styles.controlButton, styles.controlButtonPrimary]}
                onPress={handleResume}
              >
                <Text style={styles.controlButtonText}>Продолжить</Text>
              </TouchableOpacity>
            ) : focusSession.phase === 'finished' ? (
              <TouchableOpacity
                style={[styles.controlButton, styles.controlButtonPrimary]}
                onPress={handleReset}
              >
                <Text style={styles.controlButtonText}>Начать заново</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.controlButton, styles.controlButtonSecondary]}
                  onPress={handlePause}
                >
                  <Text style={styles.controlButtonText}>Пауза</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlButton, styles.controlButtonTertiary]}
                  onPress={handleReset}
                >
                  <Text style={styles.controlButtonText}>Сброс</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Статистика */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Фокус</Text>
              <Text style={styles.statValue}>{focusSession.focusMinutes} мин</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Перерыв</Text>
              <Text style={styles.statValue}>{focusSession.breakMinutes} мин</Text>
            </View>
          </View>
        </View>
      )}
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
  presetContainer: {
    gap: 12,
  },
  presetButton: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: MD3_COLORS.primaryContainer,
    alignItems: 'center',
  },
  presetButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: MD3_COLORS.onPrimaryContainer,
    marginBottom: 4,
  },
  presetButtonSubtext: {
    fontSize: 14,
    color: MD3_COLORS.onSurfaceVariant,
  },
  timerContainer: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  timerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: MD3_COLORS.onSurface,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 64,
    fontWeight: '300',
    color: MD3_COLORS.onSurface,
    fontVariant: ['tabular-nums'],
  },
  controlsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  controlButtonPrimary: {
    backgroundColor: MD3_COLORS.primary,
  },
  controlButtonSecondary: {
    backgroundColor: MD3_COLORS.secondaryContainer,
  },
  controlButtonTertiary: {
    backgroundColor: MD3_COLORS.surfaceVariant,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: MD3_COLORS.onSurface,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 12,
    backgroundColor: MD3_COLORS.surfaceVariant,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: MD3_COLORS.onSurfaceVariant,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: MD3_COLORS.onSurface,
  },
});

