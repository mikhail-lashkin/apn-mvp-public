/**
 * @file: mindset.ts
 * @description: Стор для управления состоянием Mindset Helper (Tilt, Focus, Review)
 * @dependencies: AsyncStorage
 * @created: 2025-01-28
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Типы согласно ТЗ
export type TiltLevel = 1 | 2 | 3 | 4 | 5;

export interface TiltRitual {
  id: string;
  title: string;
  done: boolean;
}

export type FocusPhase = 'idle' | 'focus' | 'break' | 'finished';

export interface FocusSession {
  id: string;
  createdAt: string;
  presetMinutes: number;
  focusMinutes: number;
  breakMinutes: number;
  phase: FocusPhase;
  remainingSeconds: number;
}

export interface MiniReview {
  id: string;
  createdAt: string;
  energy: number;
  mainGoal: string;
  trigger: string;
  plan: string;
}

// Начальные ритуалы для тильта
const INITIAL_TILT_RITUALS: TiltRitual[] = [
  { id: 'ritual_1', title: 'Пауза 5 минут без столов', done: false },
  { id: 'ritual_2', title: '3 цикла дыхания 4-4-4', done: false },
  { id: 'ritual_3', title: 'Записать причину тильта в одну строку', done: false },
];

// Состояние Mindset Helper
type MindsetState = {
  // Tilt
  tiltLevel: TiltLevel;
  tiltRituals: TiltRitual[];
  
  // Focus
  focusSession: FocusSession | null;
  
  // Review
  lastReview: MiniReview | null;
};

// Начальное состояние
let currentState: MindsetState = {
  tiltLevel: 1,
  tiltRituals: [...INITIAL_TILT_RITUALS],
  focusSession: null,
  lastReview: null,
};

// Подписчики на изменения
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

// Ключ для AsyncStorage
const STORAGE_KEY = 'mindset_state_v1';

// Загрузка состояния из AsyncStorage
const loadState = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      currentState = {
        tiltLevel: parsed.tiltLevel || 1,
        tiltRituals: parsed.tiltRituals || [...INITIAL_TILT_RITUALS],
        focusSession: parsed.focusSession || null,
        lastReview: parsed.lastReview || null,
      };
      notifySubscribers();
    }
  } catch (error) {
    console.error('[MindsetStore] Failed to load state:', error);
  }
};

// Сохранение состояния в AsyncStorage
const saveState = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  } catch (error) {
    console.error('[MindsetStore] Failed to save state:', error);
  }
};

// Интерфейс стора
export interface MindsetStore {
  // Геттеры
  tiltLevel: TiltLevel;
  tiltRituals: TiltRitual[];
  focusSession: FocusSession | null;
  lastReview: MiniReview | null;
  
  // Tilt методы
  setTiltLevel(level: TiltLevel): void;
  toggleTiltRitual(id: string): void;
  resetTiltRituals(): void;
  completeTiltRitual(): void;
  
  // Focus методы
  startFocus(presetMinutes: number): void;
  pauseFocus(): void;
  resumeFocus(): void;
  resetFocus(): void;
  tickFocus(): void;
  
  // Review методы
  saveReview(data: Omit<MiniReview, 'id' | 'createdAt'>): void;
  
  // Утилиты
  initialize(): Promise<void>;
}

export const mindsetStore: MindsetStore = {
  // Геттеры
  get tiltLevel() { return currentState.tiltLevel; },
  get tiltRituals() { return currentState.tiltRituals; },
  get focusSession() { return currentState.focusSession; },
  get lastReview() { return currentState.lastReview; },
  
  // Инициализация
  async initialize(): Promise<void> {
    await loadState();
  },
  
  // Tilt методы
  setTiltLevel(level: TiltLevel): void {
    currentState = { ...currentState, tiltLevel: level };
    saveState();
    notifySubscribers();
  },
  
  toggleTiltRitual(id: string): void {
    currentState = {
      ...currentState,
      tiltRituals: currentState.tiltRituals.map(ritual =>
        ritual.id === id ? { ...ritual, done: !ritual.done } : ritual
      ),
    };
    saveState();
    notifySubscribers();
  },
  
  resetTiltRituals(): void {
    currentState = {
      ...currentState,
      tiltRituals: INITIAL_TILT_RITUALS.map(ritual => ({ ...ritual, done: false })),
    };
    saveState();
    notifySubscribers();
  },
  
  completeTiltRitual(): number {
    const completedCount = currentState.tiltRituals.filter(r => r.done).length;
    // Сбрасываем ритуалы после завершения
    currentState = {
      ...currentState,
      tiltRituals: INITIAL_TILT_RITUALS.map(ritual => ({ ...ritual, done: false })),
    };
    saveState();
    notifySubscribers();
    return completedCount;
  },
  
  // Focus методы
  startFocus(presetMinutes: number): void {
    const session: FocusSession = {
      id: `focus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      presetMinutes,
      focusMinutes: 0,
      breakMinutes: 0,
      phase: 'focus',
      remainingSeconds: presetMinutes * 60,
    };
    
    currentState = { ...currentState, focusSession: session };
    saveState();
    notifySubscribers();
  },
  
  pauseFocus(): void {
    if (!currentState.focusSession) return;
    
    currentState = {
      ...currentState,
      focusSession: {
        ...currentState.focusSession,
        phase: 'idle',
      },
    };
    saveState();
    notifySubscribers();
  },
  
  resumeFocus(): void {
    if (!currentState.focusSession || currentState.focusSession.phase !== 'idle') return;
    
    // Восстанавливаем предыдущую фазу (focus или break)
    const prevPhase = currentState.focusSession.focusMinutes > 0 ? 'break' : 'focus';
    
    currentState = {
      ...currentState,
      focusSession: {
        ...currentState.focusSession,
        phase: prevPhase,
      },
    };
    saveState();
    notifySubscribers();
  },
  
  resetFocus(): void {
    currentState = { ...currentState, focusSession: null };
    saveState();
    notifySubscribers();
  },
  
  tickFocus(): void {
    if (!currentState.focusSession) return;
    
    const session = currentState.focusSession;
    
    // Если таймер на паузе, не тикаем
    if (session.phase === 'idle' || session.phase === 'finished') return;
    
    if (session.remainingSeconds > 0) {
      // Декремент секунд
      currentState = {
        ...currentState,
        focusSession: {
          ...session,
          remainingSeconds: session.remainingSeconds - 1,
        },
      };
    } else {
      // Переход между фазами
      if (session.phase === 'focus') {
        // Переход в перерыв
        // Для пресета 25/5 перерыв 5 минут, для 45/10 перерыв 10 минут
        const breakMinutes = session.presetMinutes === 25 ? 5 : 10;
        const breakSeconds = breakMinutes * 60;
        currentState = {
          ...currentState,
          focusSession: {
            ...session,
            phase: 'break',
            remainingSeconds: breakSeconds,
            focusMinutes: session.presetMinutes,
          },
        };
      } else if (session.phase === 'break') {
        // Завершение сессии
        const breakMinutes = session.presetMinutes === 25 ? 5 : 10;
        currentState = {
          ...currentState,
          focusSession: {
            ...session,
            phase: 'finished',
            remainingSeconds: 0,
            breakMinutes: breakMinutes,
          },
        };
      }
    }
    
    saveState();
    notifySubscribers();
  },
  
  // Review методы
  saveReview(data: Omit<MiniReview, 'id' | 'createdAt'>): void {
    const review: MiniReview = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      ...data,
    };
    
    currentState = { ...currentState, lastReview: review };
    saveState();
    notifySubscribers();
  },
};

// Система подписки для React компонентов
export const subscribe = (callback: () => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

// Хук для использования стора в React компонентах
export const useMindsetStore = () => {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    return subscribe(forceUpdate);
  }, []);
  
  return mindsetStore;
};

