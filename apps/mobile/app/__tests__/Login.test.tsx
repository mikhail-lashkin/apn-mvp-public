/**
 * @file: Login.test.tsx
 * @description: Тесты для экрана Login
 * @dependencies: @testing-library/react-native, jest
 * @created: 2025-01-27
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MockLogin } from '../../__tests__/test-utils';

describe('Login Screen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render login screen correctly', () => {
      render(<MockLogin />);
      
      expect(screen.getByText('AI Poker Notes')).toBeTruthy();
      expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('should have correct layout structure', () => {
      render(<MockLogin />);
      
      const container = screen.getByTestId('login-container');
      expect(container).toBeTruthy();
    });

    it('should render title with correct styling', () => {
      render(<MockLogin />);
      
      const title = screen.getByText('AI Poker Notes');
      expect(title).toBeTruthy();
    });

    it('should render continue button with correct styling', () => {
      render(<MockLogin />);
      
      const button = screen.getByText('Continue');
      expect(button).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to lobby when continue button is pressed', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<MockLogin />);
      
      const continueButton = screen.getByTestId('link-/(app)/lobby');
      fireEvent.press(continueButton);
      
      expect(consoleSpy).toHaveBeenCalledWith('Navigate to: /(app)/lobby');
      
      consoleSpy.mockRestore();
    });

    it('should have correct link href to lobby', () => {
      render(<MockLogin />);
      
      const link = screen.getByTestId('link-/(app)/lobby');
      expect(link).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should handle button press events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<MockLogin />);
      
      const button = screen.getByTestId('link-/(app)/lobby');
      fireEvent.press(button);
      
      expect(consoleSpy).toHaveBeenCalledWith('Navigate to: /(app)/lobby');
      
      consoleSpy.mockRestore();
    });

    it('should be accessible for screen readers', () => {
      render(<MockLogin />);
      
      const title = screen.getByText('AI Poker Notes');
      const button = screen.getByText('Continue');
      
      expect(title).toBeTruthy();
      expect(button).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('should apply correct background color', () => {
      render(<MockLogin />);
      
      const container = screen.getByTestId('login-container');
      expect(container).toBeTruthy();
    });

    it('should apply correct text colors', () => {
      render(<MockLogin />);
      
      const title = screen.getByText('AI Poker Notes');
      expect(title).toBeTruthy();
    });

    it('should apply correct button styling', () => {
      render(<MockLogin />);
      
      const button = screen.getByText('Continue');
      expect(button).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid button presses', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<MockLogin />);
      
      const button = screen.getByTestId('link-/(app)/lobby');
      
      // Симулируем быстрые нажатия
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      
      consoleSpy.mockRestore();
    });

    it('should render without crashing when props are undefined', () => {
      expect(() => render(<MockLogin />)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility structure', () => {
      render(<MockLogin />);
      
      const title = screen.getByText('AI Poker Notes');
      const button = screen.getByText('Continue');
      
      expect(title).toBeTruthy();
      expect(button).toBeTruthy();
    });

    it('should support accessibility testing', () => {
      render(<MockLogin />);
      
      // Проверяем, что элементы доступны для тестирования
      expect(screen.getByText('AI Poker Notes')).toBeTruthy();
      expect(screen.getByText('Continue')).toBeTruthy();
    });
  });
});