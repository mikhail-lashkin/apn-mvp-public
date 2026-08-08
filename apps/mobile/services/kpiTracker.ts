/**
 * @file: kpiTracker.ts
 * @description: Система KPI-замеров для критических сценариев
 * @dependencies: AsyncStorage
 * @created: 2025-01-28
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface KPIMeasurement {
  id: string;
  scenario: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface KPISummary {
  scenario: string;
  totalAttempts: number;
  successfulAttempts: number;
  averageDuration: number;
  successRate: number;
  fastestTime: number;
  slowestTime: number;
}

class KPITracker {
  private readonly STORAGE_KEY = 'kpi_measurements';
  private measurements: KPIMeasurement[] = [];
  private activeMeasurements = new Map<string, number>();

  /**
   * Начинает измерение KPI для сценария
   */
  startMeasurement(scenario: string, metadata?: Record<string, any>): string {
    const id = `${scenario}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.activeMeasurements.set(id, startTime);
    
    console.log(`[KPI] Started measurement: ${scenario} (${id})`);
    
    return id;
  }

  /**
   * Завершает измерение KPI
   */
  endMeasurement(
    id: string, 
    success: boolean = true, 
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const startTime = this.activeMeasurements.get(id);
    
    if (!startTime) {
      console.warn(`[KPI] No active measurement found for id: ${id}`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const measurement: KPIMeasurement = {
      id,
      scenario: this.extractScenarioFromId(id),
      startTime,
      endTime,
      duration,
      success,
      error,
      metadata,
    };

    this.measurements.push(measurement);
    this.activeMeasurements.delete(id);
    
    // Сохраняем в AsyncStorage
    this.saveMeasurements();
    
    console.log(`[KPI] Completed measurement: ${measurement.scenario} - ${duration}ms (${success ? 'SUCCESS' : 'FAILED'})`);
  }

  /**
   * Измеряет быструю метку (≤ 10 секунд)
   */
  async measureQuickTag(
    playerName: string,
    tag: string,
    hasNote: boolean = false
  ): Promise<string> {
    const id = this.startMeasurement('quick_tag', {
      playerName,
      tag,
      hasNote,
    });

    // Имитируем выполнение действия
    await this.delay(500 + Math.random() * 1000);

    const success = Math.random() > 0.1; // 90% успешность
    this.endMeasurement(id, success, success ? undefined : 'User cancelled');

    return id;
  }

  /**
   * Измеряет подробную заметку (≤ 30 секунд)
   */
  async measureDetailNote(
    playerName: string,
    noteLength: number,
    tagsCount: number
  ): Promise<string> {
    const id = this.startMeasurement('detail_note', {
      playerName,
      noteLength,
      tagsCount,
    });

    // Имитируем выполнение действия
    await this.delay(2000 + Math.random() * 3000);

    const success = Math.random() > 0.05; // 95% успешность
    this.endMeasurement(id, success, success ? undefined : 'Save failed');

    return id;
  }

  /**
   * Измеряет быстрый анализ (≤ 15 секунд)
   */
  async measureQuickAnalysis(
    noteText: string,
    playerType: string
  ): Promise<string> {
    const id = this.startMeasurement('quick_analysis', {
      noteText: noteText.substring(0, 50) + '...',
      playerType,
    });

    // Имитируем выполнение AI анализа
    await this.delay(1000 + Math.random() * 2000);

    const success = Math.random() > 0.15; // 85% успешность
    this.endMeasurement(id, success, success ? undefined : 'AI service unavailable');

    return id;
  }

  /**
   * Получает сводку по сценарию
   */
  getScenarioSummary(scenario: string): KPISummary | null {
    const scenarioMeasurements = this.measurements.filter(m => m.scenario === scenario);
    
    if (scenarioMeasurements.length === 0) {
      return null;
    }

    const successfulMeasurements = scenarioMeasurements.filter(m => m.success);
    const durations = scenarioMeasurements.map(m => m.duration);
    
    return {
      scenario,
      totalAttempts: scenarioMeasurements.length,
      successfulAttempts: successfulMeasurements.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      successRate: successfulMeasurements.length / scenarioMeasurements.length,
      fastestTime: Math.min(...durations),
      slowestTime: Math.max(...durations),
    };
  }

  /**
   * Получает все измерения
   */
  getAllMeasurements(): KPIMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Получает измерения за период
   */
  getMeasurementsInRange(startDate: Date, endDate: Date): KPIMeasurement[] {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    return this.measurements.filter(m => 
      m.startTime >= startTime && m.endTime <= endTime
    );
  }

  /**
   * Проверяет соответствие KPI требованиям
   */
  checkKPICompliance(): {
    quickTag: boolean;
    detailNote: boolean;
    quickAnalysis: boolean;
    overall: boolean;
  } {
    const quickTagSummary = this.getScenarioSummary('quick_tag');
    const detailNoteSummary = this.getScenarioSummary('detail_note');
    const quickAnalysisSummary = this.getScenarioSummary('quick_analysis');

    const quickTagCompliant = quickTagSummary ? 
      quickTagSummary.averageDuration <= 10000 && quickTagSummary.successRate >= 0.8 : false;
    
    const detailNoteCompliant = detailNoteSummary ? 
      detailNoteSummary.averageDuration <= 30000 && detailNoteSummary.successRate >= 0.9 : false;
    
    const quickAnalysisCompliant = quickAnalysisSummary ? 
      quickAnalysisSummary.averageDuration <= 15000 && quickAnalysisSummary.successRate >= 0.8 : false;

    return {
      quickTag: quickTagCompliant,
      detailNote: detailNoteCompliant,
      quickAnalysis: quickAnalysisCompliant,
      overall: quickTagCompliant && detailNoteCompliant && quickAnalysisCompliant,
    };
  }

  /**
   * Экспортирует данные для аналитики
   */
  exportData(): {
    measurements: KPIMeasurement[];
    summaries: Record<string, KPISummary>;
    compliance: ReturnType<KPITracker['checkKPICompliance']>;
  } {
    const summaries: Record<string, KPISummary> = {};
    const scenarios = [...new Set(this.measurements.map(m => m.scenario))];
    
    scenarios.forEach(scenario => {
      const summary = this.getScenarioSummary(scenario);
      if (summary) {
        summaries[scenario] = summary;
      }
    });

    return {
      measurements: this.getAllMeasurements(),
      summaries,
      compliance: this.checkKPICompliance(),
    };
  }

  /**
   * Очищает старые измерения (старше 30 дней)
   */
  async cleanupOldMeasurements(): Promise<void> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.measurements = this.measurements.filter(m => m.startTime > thirtyDaysAgo);
    await this.saveMeasurements();
  }

  private extractScenarioFromId(id: string): string {
    return id.split('_')[0];
  }

  private async saveMeasurements(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.measurements));
    } catch (error) {
      console.error('[KPI] Failed to save measurements:', error);
    }
  }

  private async loadMeasurements(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (data) {
        this.measurements = JSON.parse(data);
      }
    } catch (error) {
      console.error('[KPI] Failed to load measurements:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Инициализация трекера
   */
  async initialize(): Promise<void> {
    await this.loadMeasurements();
    await this.cleanupOldMeasurements();
  }
}

export const kpiTracker = new KPITracker();
