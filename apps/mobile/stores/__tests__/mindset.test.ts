/**
 * @file: mindset.test.ts
 * @description: Unit-тесты для mindset store
 * @dependencies: mindset store
 * @created: 2025-01-28
 */

import { mindsetStore, TiltLevel } from '../mindset';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Мокаем AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('MindsetStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Сбрасываем состояние
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Tilt методы', () => {
    it('должен устанавливать уровень тильта', () => {
      mindsetStore.setTiltLevel(3);
      expect(mindsetStore.tiltLevel).toBe(3);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('должен переключать состояние ритуала', () => {
      const ritualId = mindsetStore.tiltRituals[0].id;
      const initialDone = mindsetStore.tiltRituals[0].done;
      
      mindsetStore.toggleTiltRitual(ritualId);
      
      const updatedRitual = mindsetStore.tiltRituals.find(r => r.id === ritualId);
      expect(updatedRitual?.done).toBe(!initialDone);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('должен сбрасывать ритуалы', () => {
      // Помечаем все ритуалы как выполненные
      mindsetStore.tiltRituals.forEach(ritual => {
        if (!ritual.done) {
          mindsetStore.toggleTiltRitual(ritual.id);
        }
      });

      mindsetStore.resetTiltRituals();
      
      mindsetStore.tiltRituals.forEach(ritual => {
        expect(ritual.done).toBe(false);
      });
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('должен завершать ритуал и возвращать количество выполненных', () => {
      // Помечаем 2 ритуала как выполненные
      mindsetStore.toggleTiltRitual(mindsetStore.tiltRituals[0].id);
      mindsetStore.toggleTiltRitual(mindsetStore.tiltRituals[1].id);
      
      const completedCount = mindsetStore.completeTiltRitual();
      
      expect(completedCount).toBe(2);
      // Ритуалы должны быть сброшены
      mindsetStore.tiltRituals.forEach(ritual => {
        expect(ritual.done).toBe(false);
      });
    });
  });

  describe('Focus методы', () => {
    it('должен запускать сессию фокуса', () => {
      mindsetStore.startFocus(25);
      
      expect(mindsetStore.focusSession).not.toBeNull();
      expect(mindsetStore.focusSession?.presetMinutes).toBe(25);
      expect(mindsetStore.focusSession?.phase).toBe('focus');
      expect(mindsetStore.focusSession?.remainingSeconds).toBe(25 * 60);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('должен ставить таймер на паузу', () => {
      mindsetStore.startFocus(25);
      mindsetStore.pauseFocus();
      
      expect(mindsetStore.focusSession?.phase).toBe('idle');
    });

    it('должен возобновлять таймер', () => {
      mindsetStore.startFocus(25);
      mindsetStore.pauseFocus();
      mindsetStore.resumeFocus();
      
      expect(mindsetStore.focusSession?.phase).toBe('focus');
    });

    it('должен сбрасывать таймер', () => {
      mindsetStore.startFocus(25);
      mindsetStore.resetFocus();
      
      expect(mindsetStore.focusSession).toBeNull();
    });

    it('должен тикать таймер и уменьшать секунды', () => {
      mindsetStore.startFocus(25);
      const initialSeconds = mindsetStore.focusSession!.remainingSeconds;
      
      mindsetStore.tickFocus();
      
      expect(mindsetStore.focusSession!.remainingSeconds).toBe(initialSeconds - 1);
    });

    it('должен переходить в перерыв после завершения фокуса (25/5)', () => {
      mindsetStore.startFocus(25);
      // Устанавливаем оставшиеся секунды в 0 через прямое изменение состояния
      const session = mindsetStore.focusSession;
      if (session) {
        // Используем внутренний доступ к состоянию для теста
        (mindsetStore as any).focusSession = { ...session, remainingSeconds: 0 };
      }
      
      mindsetStore.tickFocus();
      
      expect(mindsetStore.focusSession?.phase).toBe('break');
      expect(mindsetStore.focusSession?.remainingSeconds).toBe(5 * 60);
      expect(mindsetStore.focusSession?.focusMinutes).toBe(25);
    });

    it('должен переходить в перерыв после завершения фокуса (45/10)', () => {
      mindsetStore.startFocus(45);
      const session = mindsetStore.focusSession;
      if (session) {
        (mindsetStore as any).focusSession = { ...session, remainingSeconds: 0 };
      }
      
      mindsetStore.tickFocus();
      
      expect(mindsetStore.focusSession?.phase).toBe('break');
      expect(mindsetStore.focusSession?.remainingSeconds).toBe(10 * 60);
      expect(mindsetStore.focusSession?.focusMinutes).toBe(45);
    });

    it('должен завершать сессию после перерыва', () => {
      mindsetStore.startFocus(25);
      // Симулируем завершение фокуса и переход в перерыв
      const session = mindsetStore.focusSession;
      if (session) {
        (mindsetStore as any).focusSession = {
          ...session,
          phase: 'break',
          remainingSeconds: 0,
          focusMinutes: 25,
        };
      }
      
      mindsetStore.tickFocus();
      
      expect(mindsetStore.focusSession?.phase).toBe('finished');
      expect(mindsetStore.focusSession?.breakMinutes).toBe(5);
    });
  });

  describe('Review методы', () => {
    it('должен сохранять ревью', () => {
      const reviewData = {
        energy: 4,
        mainGoal: 'Играть дисциплинированно',
        trigger: 'Большие потери',
        plan: 'Сделать паузу',
      };
      
      mindsetStore.saveReview(reviewData);
      
      expect(mindsetStore.lastReview).not.toBeNull();
      expect(mindsetStore.lastReview?.energy).toBe(4);
      expect(mindsetStore.lastReview?.mainGoal).toBe('Играть дисциплинированно');
      expect(mindsetStore.lastReview?.trigger).toBe('Большие потери');
      expect(mindsetStore.lastReview?.plan).toBe('Сделать паузу');
      expect(mindsetStore.lastReview?.id).toBeDefined();
      expect(mindsetStore.lastReview?.createdAt).toBeDefined();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Инициализация', () => {
    it('должен загружать состояние из AsyncStorage', async () => {
      const savedState = {
        tiltLevel: 3,
        tiltRituals: [
          { id: 'ritual_1', title: 'Test', done: true },
        ],
        focusSession: null,
        lastReview: null,
      };
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));
      
      await mindsetStore.initialize();
      
      expect(mindsetStore.tiltLevel).toBe(3);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('mindset_state_v1');
    });

    it('должен использовать начальные значения при отсутствии сохраненного состояния', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      await mindsetStore.initialize();
      
      expect(mindsetStore.tiltLevel).toBe(1);
      expect(mindsetStore.tiltRituals.length).toBeGreaterThan(0);
    });
  });
});

