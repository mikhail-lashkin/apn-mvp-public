/**
 * @file: eventLogger.ts
 * @description: Система event-логики для метрик UX
 * @dependencies: AsyncStorage
 * @created: 2025-01-28
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserEvent {
  id: string;
  type: string;
  action: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
  duration?: number;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  events: UserEvent[];
  notesCreated: number;
  tagsApplied: number;
  analysesPerformed: number;
  errorsEncountered: number;
}

export interface DailyMetrics {
  date: string;
  sessions: number;
  totalDuration: number;
  notesCreated: number;
  tagsApplied: number;
  analysesPerformed: number;
  errorsEncountered: number;
  uniqueUsers: number;
}

class EventLogger {
  private readonly EVENTS_KEY = 'user_events';
  private readonly SESSIONS_KEY = 'user_sessions';
  private readonly DAILY_METRICS_KEY = 'daily_metrics';
  
  private events: UserEvent[] = [];
  private currentSession: SessionMetrics | null = null;
  private dailyMetrics: Map<string, DailyMetrics> = new Map();

  /**
   * Инициализация логгера
   */
  async initialize(): Promise<void> {
    await this.loadEvents();
    await this.loadSessions();
    await this.loadDailyMetrics();
    
    // Начинаем новую сессию
    this.startSession();
  }

  /**
   * Начинает новую сессию
   */
  startSession(userId?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      events: [],
      notesCreated: 0,
      tagsApplied: 0,
      analysesPerformed: 0,
      errorsEncountered: 0,
    };

    this.logEvent('session', 'start', { userId });
    
    console.log(`[EventLogger] Started session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Завершает текущую сессию
   */
  endSession(): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

    this.logEvent('session', 'end');
    this.saveSession(this.currentSession);
    
    console.log(`[EventLogger] Ended session: ${this.currentSession.sessionId} (${this.currentSession.duration}ms)`);
    this.currentSession = null;
  }

  /**
   * Логирует событие пользователя
   */
  logEvent(
    type: string,
    action: string,
    metadata?: Record<string, any>,
    duration?: number
  ): void {
    if (!this.currentSession) {
      console.warn('[EventLogger] No active session, starting new one');
      this.startSession();
    }

    const event: UserEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      action,
      timestamp: Date.now(),
      sessionId: this.currentSession!.sessionId,
      metadata,
      duration,
    };

    this.events.push(event);
    this.currentSession!.events.push(event);

    // Обновляем метрики сессии
    this.updateSessionMetrics(event);

    // Сохраняем событие
    this.saveEvent(event);
    
    console.log(`[EventLogger] Logged event: ${type}.${action}`);
  }

  /**
   * Логирует создание заметки
   */
  logNoteCreated(noteType: 'quick' | 'detail', playerName: string, hasTags: boolean): void {
    this.logEvent('note', 'created', {
      noteType,
      playerName,
      hasTags,
    });
  }

  /**
   * Логирует применение тега
   */
  logTagApplied(tag: string, playerName: string, method: 'quick' | 'detail'): void {
    this.logEvent('tag', 'applied', {
      tag,
      playerName,
      method,
    });
  }

  /**
   * Логирует AI анализ
   */
  logAnalysisPerformed(
    analysisType: 'quick' | 'detail',
    playerType: string,
    confidence: number,
    duration: number
  ): void {
    this.logEvent('analysis', 'performed', {
      analysisType,
      playerType,
      confidence,
    }, duration);
  }

  /**
   * Логирует ошибку
   */
  logError(errorType: string, component: string, action: string, errorMessage: string): void {
    this.logEvent('error', 'occurred', {
      errorType,
      component,
      action,
      errorMessage,
    });
  }

  /**
   * Логирует навигацию
   */
  logNavigation(from: string, to: string, duration?: number): void {
    this.logEvent('navigation', 'navigate', {
      from,
      to,
    }, duration);
  }

  /**
   * Логирует взаимодействие с UI
   */
  logUIInteraction(element: string, action: string, metadata?: Record<string, any>): void {
    this.logEvent('ui', action, {
      element,
      ...metadata,
    });
  }

  /**
   * Логирует производительность
   */
  logPerformance(operation: string, duration: number, success: boolean): void {
    this.logEvent('performance', operation, {
      success,
    }, duration);
  }

  /**
   * Получает метрики за день
   */
  getDailyMetrics(date: string): DailyMetrics | null {
    return this.dailyMetrics.get(date) || null;
  }

  /**
   * Получает метрики за период
   */
  getMetricsInRange(startDate: Date, endDate: Date): {
    events: UserEvent[];
    sessions: SessionMetrics[];
    dailyMetrics: DailyMetrics[];
  } {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const eventsInRange = this.events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );

    const sessionsInRange = this.getSessionsInRange(startDate, endDate);

    const dailyMetricsInRange: DailyMetrics[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const metrics = this.dailyMetrics.get(dateStr);
      if (metrics) {
        dailyMetricsInRange.push(metrics);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      events: eventsInRange,
      sessions: sessionsInRange,
      dailyMetrics: dailyMetricsInRange,
    };
  }

  /**
   * Получает статистику использования
   */
  getUsageStats(): {
    totalSessions: number;
    totalEvents: number;
    averageSessionDuration: number;
    mostUsedFeatures: Array<{ feature: string; count: number }>;
    errorRate: number;
  } {
    const sessions = this.getAllSessions();
    const totalSessions = sessions.length;
    const totalEvents = this.events.length;
    
    const averageSessionDuration = sessions.length > 0
      ? sessions.reduce((sum, session) => sum + (session.duration || 0), 0) / sessions.length
      : 0;

    // Подсчитываем использование функций
    const featureUsage = new Map<string, number>();
    this.events.forEach(event => {
      const feature = `${event.type}.${event.action}`;
      featureUsage.set(feature, (featureUsage.get(feature) || 0) + 1);
    });

    const mostUsedFeatures = Array.from(featureUsage.entries())
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const errorEvents = this.events.filter(event => event.type === 'error').length;
    const errorRate = totalEvents > 0 ? errorEvents / totalEvents : 0;

    return {
      totalSessions,
      totalEvents,
      averageSessionDuration,
      mostUsedFeatures,
      errorRate,
    };
  }

  /**
   * Экспортирует данные для аналитики
   */
  exportData(): {
    events: UserEvent[];
    sessions: SessionMetrics[];
    dailyMetrics: DailyMetrics[];
    usageStats: ReturnType<EventLogger['getUsageStats']>;
  } {
    return {
      events: this.events,
      sessions: this.getAllSessions(),
      dailyMetrics: Array.from(this.dailyMetrics.values()),
      usageStats: this.getUsageStats(),
    };
  }

  /**
   * Очищает старые данные (старше 30 дней)
   */
  async cleanupOldData(): Promise<void> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Очищаем старые события
    this.events = this.events.filter(event => event.timestamp > thirtyDaysAgo);
    
    // Очищаем старые сессии
    const sessions = await this.loadSessions();
    const recentSessions = sessions.filter(session => session.startTime > thirtyDaysAgo);
    await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(recentSessions));
    
    // Очищаем старые дневные метрики
    const cutoffDate = new Date(thirtyDaysAgo).toISOString().split('T')[0];
    for (const [date] of this.dailyMetrics) {
      if (date < cutoffDate) {
        this.dailyMetrics.delete(date);
      }
    }
    
    await this.saveDailyMetrics();
  }

  private updateSessionMetrics(event: UserEvent): void {
    if (!this.currentSession) return;

    switch (event.type) {
      case 'note':
        if (event.action === 'created') {
          this.currentSession.notesCreated++;
        }
        break;
      case 'tag':
        if (event.action === 'applied') {
          this.currentSession.tagsApplied++;
        }
        break;
      case 'analysis':
        if (event.action === 'performed') {
          this.currentSession.analysesPerformed++;
        }
        break;
      case 'error':
        this.currentSession.errorsEncountered++;
        break;
    }
  }

  private async saveEvent(event: UserEvent): Promise<void> {
    try {
      await AsyncStorage.setItem(this.EVENTS_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.error('[EventLogger] Failed to save event:', error);
    }
  }

  private async saveSession(session: SessionMetrics): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      sessions.push(session);
      await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('[EventLogger] Failed to save session:', error);
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.EVENTS_KEY);
      if (data) {
        this.events = JSON.parse(data);
      }
    } catch (error) {
      console.error('[EventLogger] Failed to load events:', error);
    }
  }

  private async loadSessions(): Promise<SessionMetrics[]> {
    try {
      const data = await AsyncStorage.getItem(this.SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[EventLogger] Failed to load sessions:', error);
      return [];
    }
  }

  private getAllSessions(): SessionMetrics[] {
    // В реальном приложении здесь должен быть вызов loadSessions()
    return [];
  }

  private getSessionsInRange(startDate: Date, endDate: Date): SessionMetrics[] {
    const sessions = this.getAllSessions();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    return sessions.filter(session => 
      session.startTime >= startTime && session.startTime <= endTime
    );
  }

  private async loadDailyMetrics(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.DAILY_METRICS_KEY);
      if (data) {
        const metrics = JSON.parse(data);
        this.dailyMetrics = new Map(Object.entries(metrics));
      }
    } catch (error) {
      console.error('[EventLogger] Failed to load daily metrics:', error);
    }
  }

  private async saveDailyMetrics(): Promise<void> {
    try {
      const metricsObj = Object.fromEntries(this.dailyMetrics);
      await AsyncStorage.setItem(this.DAILY_METRICS_KEY, JSON.stringify(metricsObj));
    } catch (error) {
      console.error('[EventLogger] Failed to save daily metrics:', error);
    }
  }
}

export const eventLogger = new EventLogger();
