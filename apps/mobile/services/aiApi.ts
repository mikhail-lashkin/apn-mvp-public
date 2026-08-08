/**
 * @file: aiApi.ts
 * @description: Mock AI API для анализа покерных заметок
 * @dependencies: None
 * @created: 2025-01-28
 */

export interface AIAnalysis {
  playerType: string;
  confidence: number;
  patterns: string[];
  recommendations: string[];
  reasoning: string;
  timestamp: number;
}

export interface AIAnalysisRequest {
  noteText: string;
  playerTag: string;
  sessionContext?: {
    stakes: string;
    position: string;
    sessionLength: number;
  };
}

class MockAIApi {
  private readonly baseDelay = 2000; // Базовая задержка 2 секунды
  private readonly analysisCache = new Map<string, AIAnalysis>();

  /**
   * Анализирует заметку и возвращает рекомендации
   */
  async analyzeNote(request: AIAnalysisRequest): Promise<AIAnalysis> {
    const cacheKey = this.generateCacheKey(request);
    
    // Проверяем кэш
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    // Имитируем задержку API
    await this.delay(this.baseDelay + Math.random() * 1000);

    // Генерируем mock анализ
    const analysis = this.generateMockAnalysis(request);
    
    // Сохраняем в кэш
    this.analysisCache.set(cacheKey, analysis);
    
    return analysis;
  }

  /**
   * Получает быстрый анализ для критических моментов (≤ 15 секунд)
   */
  async getQuickAnalysis(request: AIAnalysisRequest): Promise<AIAnalysis> {
    const cacheKey = `quick_${this.generateCacheKey(request)}`;
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    // Быстрый анализ - задержка 1-2 секунды
    await this.delay(1000 + Math.random() * 1000);

    const analysis = this.generateQuickAnalysis(request);
    this.analysisCache.set(cacheKey, analysis);
    
    return analysis;
  }

  /**
   * Получает список доступных типажей игроков
   */
  async getPlayerTypes(): Promise<string[]> {
    await this.delay(500);
    
    return [
      'TAG',
      'LAG', 
      'NIT',
      'MANIAC',
      'FISH',
      'REG',
      'UNKNOWN'
    ];
  }

  /**
   * Получает объяснение анализа
   */
  async getAnalysisExplanation(analysisId: string): Promise<string> {
    await this.delay(1000);
    
    return `Детальное объяснение анализа ${analysisId}:\n\n` +
           `Этот анализ основан на машинном обучении и анализе паттернов поведения. ` +
           `Модель учитывает контекст игры, позицию игрока и исторические данные.`;
  }

  private generateMockAnalysis(request: AIAnalysisRequest): AIAnalysis {
    const { noteText, playerTag, sessionContext } = request;
    
    // Простая логика анализа на основе ключевых слов
    const text = noteText.toLowerCase();
    
    let playerType = 'UNKNOWN';
    let confidence = 0.5;
    let patterns: string[] = [];
    let recommendations: string[] = [];
    let reasoning = '';

    // Анализ агрессивности
    if (text.includes('агрессивн') || text.includes('рейз') || text.includes('бет')) {
      patterns.push('Агрессивная игра');
      if (text.includes('часто') || text.includes('много')) {
        playerType = 'LAG';
        confidence = 0.8;
        recommendations.push('Сужать диапазон колла');
        recommendations.push('Использовать контбет чаще');
      } else {
        playerType = 'TAG';
        confidence = 0.7;
        recommendations.push('Анализировать диапазон рейза');
      }
    }

    // Анализ тайтовости
    if (text.includes('тайт') || text.includes('мало') || text.includes('редко')) {
      patterns.push('Тайтовая игра');
      playerType = 'NIT';
      confidence = 0.75;
      recommendations.push('Блефовать чаще');
      recommendations.push('Увеличить размер ставок');
    }

    // Анализ слабости
    if (text.includes('слаб') || text.includes('плох') || text.includes('ошибк')) {
      patterns.push('Слабая игра');
      playerType = 'FISH';
      confidence = 0.85;
      recommendations.push('Эксплуатировать слабости');
      recommendations.push('Играть больше рук против него');
    }

    // Анализ безумия
    if (text.includes('безум') || text.includes('много рейз') || text.includes('всегда')) {
      patterns.push('Очень агрессивная игра');
      playerType = 'MANIAC';
      confidence = 0.9;
      recommendations.push('Ждать сильные руки');
      recommendations.push('Колл с более широким диапазоном');
    }

    // Анализ по позиции
    if (sessionContext?.position) {
      patterns.push(`Игра с позиции ${sessionContext.position}`);
      if (sessionContext.position.includes('BTN') || sessionContext.position.includes('CO')) {
        recommendations.push('Учитывать позиционное преимущество');
      }
    }

    // Генерация объяснения
    reasoning = this.generateReasoning(playerType, patterns, confidence);

    return {
      playerType,
      confidence,
      patterns,
      recommendations,
      reasoning,
      timestamp: Date.now(),
    };
  }

  private generateQuickAnalysis(request: AIAnalysisRequest): AIAnalysis {
    // Упрощенный анализ для быстрых решений
    const analysis = this.generateMockAnalysis(request);
    
    return {
      ...analysis,
      recommendations: analysis.recommendations.slice(0, 2), // Только 2 главные рекомендации
      reasoning: 'Быстрый анализ на основе ключевых паттернов',
    };
  }

  private generateReasoning(playerType: string, patterns: string[], confidence: number): string {
    const baseReasoning = `Анализ показал, что игрок относится к типу ${playerType} ` +
                         `с уверенностью ${Math.round(confidence * 100)}%. `;
    
    const patternText = patterns.length > 0 
      ? `Выявленные паттерны: ${patterns.join(', ')}. `
      : '';
    
    const recommendationText = 'Рекомендации основаны на анализе стиля игры и позиции.';
    
    return baseReasoning + patternText + recommendationText;
  }

  private generateCacheKey(request: AIAnalysisRequest): string {
    return `${request.noteText}_${request.playerTag}_${JSON.stringify(request.sessionContext || {})}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Очищает кэш анализа
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Получает статистику использования API
   */
  getStats(): { cacheSize: number; totalRequests: number } {
    return {
      cacheSize: this.analysisCache.size,
      totalRequests: this.analysisCache.size, // Упрощенная статистика
    };
  }
}

export const aiApi = new MockAIApi();
