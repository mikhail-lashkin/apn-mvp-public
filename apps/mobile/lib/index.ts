/**
 * @file: index.ts
 * @description: Базовые утилиты и хелперы
 * @dependencies: -
 * @created: 2025-01-27
 */

// Экспорт утилит будет добавлен по мере необходимости
export const utils = {
  // Утилиты для работы с данными
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  
  // Утилиты для валидации
  isValidEmail: (email: string) => {
    if (typeof email !== 'string' || !email) return false;
    // Валидация email с проверкой на двойные точки и точки в начале/конце
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const parts = email.split('@');
    return emailRegex.test(email) && 
           !email.includes('..') && 
           !email.startsWith('.') && 
           !email.endsWith('.') &&
           email.includes('@') &&
           parts[1] && 
           parts[1].includes('.') &&
           !parts[0].endsWith('.') &&
           !parts[1].startsWith('.');
  },
  
  // Утилиты для форматирования
  formatTime: (timestamp: number) => {
    if (typeof timestamp !== 'number' || isNaN(timestamp)) return 'Invalid Date';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleTimeString();
  },
};
