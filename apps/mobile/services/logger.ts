/**
 * @file: logger.ts
 * @description: Сервис логирования событий и метрик для аналитики
 * @dependencies: -
 * @created: 2025-01-30
 */

interface LogEvent {
  eventName: string;
  timestamp: string;
  params?: Record<string, any>;
  sessionId?: string;
}

interface Metric {
  name: string;
  value: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

class Logger {
  private sessionId: string;
  private startTimes: Map<string, number> = new Map();

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Логирование события
   */
  logEvent(eventName: string, params?: Record<string, any>): void {
    const event: LogEvent = {
      eventName,
      timestamp: new Date().toISOString(),
      params,
      sessionId: this.sessionId,
    };

    // Структурированный лог для будущей интеграции с аналитикой
    console.log('[ANALYTICS_EVENT]', JSON.stringify(event, null, 2));
  }

  /**
   * Логирование метрики
   */
  logMetric(name: string, value: number, metadata?: Record<string, any>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date().toISOString(),
      metadata,
    };

    console.log('[ANALYTICS_METRIC]', JSON.stringify(metric, null, 2));
  }

  /**
   * Начать замер времени для операции
   */
  startTimer(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  /**
   * Завершить замер времени и залогировать метрику
   */
  endTimer(operationId: string, metricName?: string): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`Timer for operation ${operationId} was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);

    const metricNameToUse = metricName || `t_${operationId}`;
    this.logMetric(metricNameToUse, duration);

    return duration;
  }

  /**
   * Логирование ошибки
   */
  logError(error: Error, context?: Record<string, any>): void {
    const errorEvent = {
      eventName: 'error',
      timestamp: new Date().toISOString(),
      params: {
        message: error.message,
        stack: error.stack,
        context,
      },
      sessionId: this.sessionId,
    };

    console.error('[ANALYTICS_ERROR]', JSON.stringify(errorEvent, null, 2));
  }

  /**
   * Получить текущий session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Создаем единственный экземпляр логгера
export const logger = new Logger();

// Предопределенные события для удобства
export const EVENTS = {
  PLAYER_CREATE: 'player_create',
  PLAYER_ASSIGN_SEAT: 'player_assign_seat',
  NOTE_CREATE: 'note_create',
  NOTE_AUTOSAVE: 'note_autosave',
  QUICKNOTE_OPEN: 'quicknote_open',
  PLAYERPICKER_CHANGE: 'playerpicker_change',
  NEWPLAYERSHEET_OPEN: 'newplayersheet_open',
  NEWPLAYERSHEET_CREATE: 'newplayersheet_create',
  TAG_MODAL_OPEN: 'tag_modal_open',
  TAG_SELECT: 'tag_select',
} as const;

// Предопределенные метрики
export const METRICS = {
  CREATE_PLAYER_TO_NOTE_SAVED: 't_create_player_to_note_saved',
  QUICKNOTE_OPEN_TIME: 't_quicknote_open',
  PLAYER_CREATION_TIME: 't_player_creation',
  NOTE_SAVE_TIME: 't_note_save',
  SUCCESS_RATE: 'success_rate',
} as const;

// Хелперы для часто используемых операций
export const logPlayerCreate = (playerName: string, tags: string[], seatIndex?: number) => {
  logger.logEvent(EVENTS.PLAYER_CREATE, {
    playerName,
    tags,
    seatIndex,
  });
};

export const logNoteCreate = (playerId: string, textLength: number, tags: string[]) => {
  logger.logEvent(EVENTS.NOTE_CREATE, {
    playerId,
    textLength,
    tags,
  });
};

export const logPlayerPickerChange = (fromPlayerId: string, toPlayerId: string) => {
  logger.logEvent(EVENTS.PLAYERPICKER_CHANGE, {
    fromPlayerId,
    toPlayerId,
  });
};

export const logQuickNoteOpen = (playerId: string, playerName?: string) => {
  logger.logEvent(EVENTS.QUICKNOTE_OPEN, {
    playerId,
    playerName,
  });
};

export const logNewPlayerSheetOpen = (seatIndex?: number) => {
  logger.logEvent(EVENTS.NEWPLAYERSHEET_OPEN, {
    seatIndex,
  });
};

export const logNewPlayerSheetCreate = (playerName: string, tags: string[], seatIndex?: number) => {
  logger.logEvent(EVENTS.NEWPLAYERSHEET_CREATE, {
    playerName,
    tags,
    seatIndex,
  });
};

export const logTagSelect = (tag: string, playerId: string, playerName?: string) => {
  logger.logEvent(EVENTS.TAG_SELECT, {
    tag,
    playerId,
    playerName,
  });
};

// Хелперы для метрик
export const startCreatePlayerToNoteTimer = () => {
  logger.startTimer('create_player_to_note');
};

export const endCreatePlayerToNoteTimer = () => {
  return logger.endTimer('create_player_to_note', METRICS.CREATE_PLAYER_TO_NOTE_SAVED);
};

export const logSuccessRate = (successful: number, total: number, operation: string) => {
  const rate = total > 0 ? (successful / total) * 100 : 0;
  logger.logMetric(METRICS.SUCCESS_RATE, rate, {
    operation,
    successful,
    total,
  });
};
