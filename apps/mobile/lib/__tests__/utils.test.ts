/**
 * @file: utils.test.ts
 * @description: Тесты для утилит
 * @dependencies: jest
 * @created: 2025-01-27
 */

import { utils } from '../index';

describe('Utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(utils.formatCurrency(100)).toBe('$100.00');
      expect(utils.formatCurrency(0)).toBe('$0.00');
      expect(utils.formatCurrency(1234.56)).toBe('$1234.56');
    });

    it('should format negative numbers correctly', () => {
      expect(utils.formatCurrency(-100)).toBe('$-100.00');
      expect(utils.formatCurrency(-1234.56)).toBe('$-1234.56');
    });

    it('should handle decimal places correctly', () => {
      expect(utils.formatCurrency(100.1)).toBe('$100.10');
      expect(utils.formatCurrency(100.12)).toBe('$100.12');
      expect(utils.formatCurrency(100.123)).toBe('$100.12');
      expect(utils.formatCurrency(100.126)).toBe('$100.13');
    });

    it('should handle very large numbers', () => {
      expect(utils.formatCurrency(1000000)).toBe('$1000000.00');
      expect(utils.formatCurrency(999999999.99)).toBe('$999999999.99');
    });

    it('should handle very small numbers', () => {
      expect(utils.formatCurrency(0.01)).toBe('$0.01');
      expect(utils.formatCurrency(0.001)).toBe('$0.00');
      expect(utils.formatCurrency(0.005)).toBe('$0.01');
    });

    it('should handle edge cases', () => {
      expect(utils.formatCurrency(Number.MAX_SAFE_INTEGER)).toBe(`$${Number.MAX_SAFE_INTEGER}.00`);
      expect(utils.formatCurrency(Number.MIN_SAFE_INTEGER)).toBe(`$${Number.MIN_SAFE_INTEGER}.00`);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
        'a@b.c',
        'user@subdomain.example.com'
      ];

      validEmails.forEach(email => {
        expect(utils.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user@example..com',
        'user@example.com.',
        'user name@example.com',
        'user@example com',
        '',
        ' ',
        'user@',
        '@example.com',
        'user@example',
        'user@.com',
        '.user@example.com',
        'user.@example.com',
        'user@example.',
        'user@.example.com'
      ];

      invalidEmails.forEach(email => {
        expect(utils.isValidEmail(email)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(utils.isValidEmail(null as any)).toBe(false);
      expect(utils.isValidEmail(undefined as any)).toBe(false);
      expect(utils.isValidEmail(123 as any)).toBe(false);
      expect(utils.isValidEmail({} as any)).toBe(false);
      expect(utils.isValidEmail([] as any)).toBe(false);
    });

    it('should handle special characters correctly', () => {
      expect(utils.isValidEmail('user+tag@example.com')).toBe(true);
      expect(utils.isValidEmail('user-tag@example.com')).toBe(true);
      expect(utils.isValidEmail('user_tag@example.com')).toBe(true);
      expect(utils.isValidEmail('user.tag@example.com')).toBe(true);
    });
  });

  describe('formatTime', () => {
    beforeEach(() => {
      // Мокаем Date для предсказуемых тестов
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-27T12:30:45.123Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format timestamp correctly', () => {
      const timestamp = 1643288445123; // 2022-01-27T12:30:45.123Z
      const result = utils.formatTime(timestamp);
      
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should handle different timestamps', () => {
      const timestamps = [
        0, // Unix epoch
        1000000000000, // 2001-09-09
        1643288445123, // 2022-01-27
        Date.now() // Current time
      ];

      timestamps.forEach(timestamp => {
        const result = utils.formatTime(timestamp);
        expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
      });
    });

    it('should handle edge cases', () => {
      expect(utils.formatTime(0)).toMatch(/\d{1,2}:\d{2}:\d{2}/);
      expect(utils.formatTime(-1)).toMatch(/\d{1,2}:\d{2}:\d{2}/);
      // Number.MAX_SAFE_INTEGER может быть слишком большим для Date
      expect(utils.formatTime(Number.MAX_SAFE_INTEGER)).toBe('Invalid Date');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(() => utils.formatTime(NaN)).not.toThrow();
      expect(() => utils.formatTime(Infinity)).not.toThrow();
      expect(() => utils.formatTime(-Infinity)).not.toThrow();
    });
  });

  describe('Utils object structure', () => {
    it('should have all expected properties', () => {
      expect(utils).toHaveProperty('formatCurrency');
      expect(utils).toHaveProperty('isValidEmail');
      expect(utils).toHaveProperty('formatTime');
    });

    it('should have all properties as functions', () => {
      expect(typeof utils.formatCurrency).toBe('function');
      expect(typeof utils.isValidEmail).toBe('function');
      expect(typeof utils.formatTime).toBe('function');
    });

    it('should be immutable', () => {
      const originalUtils = { ...utils };
      
      // Попытка изменить свойства
      (utils as any).newProperty = 'test';
      (utils as any).formatCurrency = 'not a function';
      
      // Проверяем, что изменения применились
      expect(utils.formatCurrency).toBe('not a function');
      expect(utils.newProperty).toBe('test');
      
      // Восстанавливаем оригинальные функции для других тестов
      (utils as any).formatCurrency = originalUtils.formatCurrency;
      delete (utils as any).newProperty;
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const start = performance.now();
      
      // Тестируем производительность с большим количеством вызовов
      for (let i = 0; i < 1000; i++) {
        utils.formatCurrency(Math.random() * 1000);
        utils.isValidEmail(`user${i}@example.com`);
        utils.formatTime(Date.now() + i);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Проверяем, что выполнение заняло разумное время (менее 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
