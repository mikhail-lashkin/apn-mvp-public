/**
 * @file: errorHandler.ts
 * @description: Система обработки edge-cases и ошибок
 * @dependencies: React Native, AsyncStorage
 * @created: 2025-01-28
 */

import { Alert, NetInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorContext {
  component: string;
  action: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface NetworkStatus {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
}

export interface OfflineQueueItem {
  id: string;
  action: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class ErrorHandler {
  private readonly OFFLINE_QUEUE_KEY = 'offline_queue';
  private readonly ERROR_LOG_KEY = 'error_log';
  private offlineQueue: OfflineQueueItem[] = [];
  private networkStatus: NetworkStatus = {
    isConnected: false,
    type: null,
    isInternetReachable: null,
  };

  /**
   * Инициализация обработчика ошибок
   */
  async initialize(): Promise<void> {
    // Загружаем очередь офлайн операций
    await this.loadOfflineQueue();
    
    // Настраиваем мониторинг сети
    this.setupNetworkMonitoring();
    
    // Обрабатываем очередь при восстановлении сети
    this.setupOfflineQueueProcessor();
  }

  /**
   * Обрабатывает ошибку с контекстом
   */
  handleError(error: Error, context: ErrorContext): void {
    console.error(`[ErrorHandler] ${context.component}.${context.action}:`, error);
    
    // Логируем ошибку
    this.logError(error, context);
    
    // Показываем пользователю соответствующее сообщение
    this.showUserFriendlyError(error, context);
  }

  /**
   * Обрабатывает ошибку сети
   */
  handleNetworkError(error: Error, context: ErrorContext, data?: any): void {
    console.warn(`[ErrorHandler] Network error in ${context.component}.${context.action}:`, error);
    
    // Если есть данные для сохранения, добавляем в офлайн очередь
    if (data) {
      this.addToOfflineQueue(context.action, data);
    }
    
    // Показываем уведомление о проблемах с сетью
    this.showNetworkError();
  }

  /**
   * Обрабатывает ошибку AI сервиса
   */
  handleAIError(error: Error, context: ErrorContext): void {
    console.error(`[ErrorHandler] AI service error in ${context.component}.${context.action}:`, error);
    
    // Показываем сообщение об ошибке AI
    Alert.alert(
      'Ошибка AI анализа',
      'Сервис анализа временно недоступен. Ваша заметка сохранена локально и будет проанализирована позже.',
      [
        { text: 'OK' },
        { text: 'Повторить', onPress: () => this.retryAIAnalysis(context) }
      ]
    );
  }

  /**
   * Проверяет доступность сети
   */
  async checkNetworkStatus(): Promise<NetworkStatus> {
    try {
      const state = await NetInfo.fetch();
      this.networkStatus = {
        isConnected: state.isConnected ?? false,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      };
      return this.networkStatus;
    } catch (error) {
      console.error('[ErrorHandler] Failed to check network status:', error);
      return this.networkStatus;
    }
  }

  /**
   * Проверяет, есть ли подключение к интернету
   */
  isOnline(): boolean {
    return this.networkStatus.isConnected && 
           this.networkStatus.isInternetReachable === true;
  }

  /**
   * Добавляет операцию в офлайн очередь
   */
  private addToOfflineQueue(action: string, data: any): void {
    const item: OfflineQueueItem = {
      id: `${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.offlineQueue.push(item);
    this.saveOfflineQueue();
    
    console.log(`[ErrorHandler] Added to offline queue: ${action}`);
  }

  /**
   * Обрабатывает очередь офлайн операций
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline() || this.offlineQueue.length === 0) {
      return;
    }

    console.log(`[ErrorHandler] Processing ${this.offlineQueue.length} offline operations`);

    const itemsToProcess = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of itemsToProcess) {
      try {
        await this.executeOfflineOperation(item);
        console.log(`[ErrorHandler] Successfully processed offline operation: ${item.action}`);
      } catch (error) {
        console.error(`[ErrorHandler] Failed to process offline operation: ${item.action}`, error);
        
        // Увеличиваем счетчик попыток
        item.retryCount++;
        
        // Если не превышен лимит попыток, возвращаем в очередь
        if (item.retryCount < item.maxRetries) {
          this.offlineQueue.push(item);
        } else {
          console.error(`[ErrorHandler] Max retries exceeded for operation: ${item.action}`);
        }
      }
    }

    await this.saveOfflineQueue();
  }

  /**
   * Выполняет офлайн операцию
   */
  private async executeOfflineOperation(item: OfflineQueueItem): Promise<void> {
    // Здесь должна быть логика выполнения различных операций
    // В зависимости от типа действия
    switch (item.action) {
      case 'save_note':
        await this.saveNoteOffline(item.data);
        break;
      case 'update_player_tag':
        await this.updatePlayerTagOffline(item.data);
        break;
      case 'analyze_note':
        await this.analyzeNoteOffline(item.data);
        break;
      default:
        console.warn(`[ErrorHandler] Unknown offline operation: ${item.action}`);
    }
  }

  /**
   * Сохраняет заметку офлайн
   */
  private async saveNoteOffline(data: any): Promise<void> {
    // Имитация сохранения заметки
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[ErrorHandler] Note saved offline:', data);
  }

  /**
   * Обновляет тег игрока офлайн
   */
  private async updatePlayerTagOffline(data: any): Promise<void> {
    // Имитация обновления тега
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[ErrorHandler] Player tag updated offline:', data);
  }

  /**
   * Анализирует заметку офлайн
   */
  private async analyzeNoteOffline(data: any): Promise<void> {
    // Имитация анализа заметки
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[ErrorHandler] Note analyzed offline:', data);
  }

  /**
   * Настраивает мониторинг сети
   */
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline();
      this.networkStatus = {
        isConnected: state.isConnected ?? false,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      };
      const isOnline = this.isOnline();

      // Если сеть восстановилась, обрабатываем очередь
      if (!wasOnline && isOnline) {
        console.log('[ErrorHandler] Network restored, processing offline queue');
        this.processOfflineQueue();
      }
    });
  }

  /**
   * Настраивает обработчик очереди офлайн операций
   */
  private setupOfflineQueueProcessor(): void {
    // Обрабатываем очередь каждые 30 секунд
    setInterval(() => {
      this.processOfflineQueue();
    }, 30000);
  }

  /**
   * Логирует ошибку
   */
  private async logError(error: Error, context: ErrorContext): Promise<void> {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
    };

    try {
      const existingLogs = await AsyncStorage.getItem(this.ERROR_LOG_KEY);
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(errorLog);
      
      // Ограничиваем количество логов (последние 100)
      const recentLogs = logs.slice(-100);
      
      await AsyncStorage.setItem(this.ERROR_LOG_KEY, JSON.stringify(recentLogs));
    } catch (logError) {
      console.error('[ErrorHandler] Failed to log error:', logError);
    }
  }

  /**
   * Показывает пользователю понятное сообщение об ошибке
   */
  private showUserFriendlyError(error: Error, context: ErrorContext): void {
    let title = 'Произошла ошибка';
    let message = 'Попробуйте еще раз или обратитесь в поддержку.';

    if (error.message.includes('network') || error.message.includes('fetch')) {
      title = 'Проблемы с сетью';
      message = 'Проверьте подключение к интернету и попробуйте снова.';
    } else if (error.message.includes('timeout')) {
      title = 'Превышено время ожидания';
      message = 'Операция заняла слишком много времени. Попробуйте еще раз.';
    } else if (error.message.includes('storage') || error.message.includes('database')) {
      title = 'Ошибка сохранения';
      message = 'Не удалось сохранить данные. Проверьте свободное место на устройстве.';
    }

    Alert.alert(title, message, [
      { text: 'OK' },
      { text: 'Повторить', onPress: () => this.retryOperation(context) }
    ]);
  }

  /**
   * Показывает ошибку сети
   */
  private showNetworkError(): void {
    Alert.alert(
      'Нет подключения к интернету',
      'Ваши данные сохранены локально и будут синхронизированы при восстановлении соединения.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Повторяет операцию
   */
  private retryOperation(context: ErrorContext): void {
    // Здесь должна быть логика повторного выполнения операции
    console.log(`[ErrorHandler] Retrying operation: ${context.component}.${context.action}`);
  }

  /**
   * Повторяет AI анализ
   */
  private retryAIAnalysis(context: ErrorContext): void {
    // Здесь должна быть логика повторного AI анализа
    console.log(`[ErrorHandler] Retrying AI analysis: ${context.component}.${context.action}`);
  }

  /**
   * Загружает очередь офлайн операций
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (data) {
        this.offlineQueue = JSON.parse(data);
      }
    } catch (error) {
      console.error('[ErrorHandler] Failed to load offline queue:', error);
    }
  }

  /**
   * Сохраняет очередь офлайн операций
   */
  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('[ErrorHandler] Failed to save offline queue:', error);
    }
  }

  /**
   * Получает статистику ошибок
   */
  async getErrorStats(): Promise<{
    totalErrors: number;
    networkErrors: number;
    aiErrors: number;
    offlineQueueSize: number;
  }> {
    try {
      const errorLogs = await AsyncStorage.getItem(this.ERROR_LOG_KEY);
      const logs = errorLogs ? JSON.parse(errorLogs) : [];
      
      const networkErrors = logs.filter((log: any) => 
        log.message.includes('network') || log.message.includes('fetch')
      ).length;
      
      const aiErrors = logs.filter((log: any) => 
        log.context.action.includes('ai') || log.context.action.includes('analysis')
      ).length;

      return {
        totalErrors: logs.length,
        networkErrors,
        aiErrors,
        offlineQueueSize: this.offlineQueue.length,
      };
    } catch (error) {
      console.error('[ErrorHandler] Failed to get error stats:', error);
      return {
        totalErrors: 0,
        networkErrors: 0,
        aiErrors: 0,
        offlineQueueSize: 0,
      };
    }
  }
}

export const errorHandler = new ErrorHandler();
