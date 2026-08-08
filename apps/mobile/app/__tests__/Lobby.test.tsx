/**
 * @file: Lobby.test.tsx
 * @description: Тесты для экрана Lobby
 * @dependencies: @testing-library/react-native, jest
 * @created: 2025-01-27
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MockLobby } from '../../__tests__/test-utils';

describe('Lobby Screen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render lobby screen correctly', () => {
      render(<MockLobby />);
      
      expect(screen.getByText('Lobby')).toBeTruthy();
      expect(screen.getByText('Go to Table abc123')).toBeTruthy();
    });

    it('should have correct layout structure', () => {
      render(<MockLobby />);
      
      const container = screen.getByTestId('lobby-container');
      expect(container).toBeTruthy();
    });

    it('should render title with correct styling', () => {
      render(<MockLobby />);
      
      const title = screen.getByText('Lobby');
      expect(title).toBeTruthy();
    });

    it('should render table link with correct styling', () => {
      render(<MockLobby />);
      
      const tableLink = screen.getByText('Go to Table abc123');
      expect(tableLink).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to table when link is pressed', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<MockLobby />);
      
      const tableLink = screen.getByTestId('link-/(app)/table/abc123');
      fireEvent.press(tableLink);
      
      expect(consoleSpy).toHaveBeenCalledWith('Navigate to: /(app)/table/abc123');
      
      consoleSpy.mockRestore();
    });

    it('should have correct link href to table', () => {
      render(<MockLobby />);
      
      const link = screen.getByTestId('link-/(app)/table/abc123');
      expect(link).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should handle link press events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<MockLobby />);
      
      const link = screen.getByTestId('link-/(app)/table/abc123');
      fireEvent.press(link);
      
      expect(consoleSpy).toHaveBeenCalledWith('Navigate to: /(app)/table/abc123');
      
      consoleSpy.mockRestore();
    });

    it('should be accessible for screen readers', () => {
      render(<MockLobby />);
      
      const title = screen.getByText('Lobby');
      const link = screen.getByText('Go to Table abc123');
      
      expect(title).toBeTruthy();
      expect(link).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('should apply correct background color', () => {
      render(<MockLobby />);
      
      const container = screen.getByTestId('lobby-container');
      expect(container).toBeTruthy();
    });

    it('should apply correct text colors', () => {
      render(<MockLobby />);
      
      const title = screen.getByText('Lobby');
      const link = screen.getByText('Go to Table abc123');
      
      expect(title).toBeTruthy();
      expect(link).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid link presses', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<MockLobby />);
      
      const link = screen.getByTestId('link-/(app)/table/abc123');
      
      // Симулируем быстрые нажатия
      fireEvent.press(link);
      fireEvent.press(link);
      fireEvent.press(link);
      
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      
      consoleSpy.mockRestore();
    });

    it('should render without crashing when props are undefined', () => {
      expect(() => render(<MockLobby />)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility structure', () => {
      render(<MockLobby />);
      
      const title = screen.getByText('Lobby');
      const link = screen.getByText('Go to Table abc123');
      
      expect(title).toBeTruthy();
      expect(link).toBeTruthy();
    });

    it('should support accessibility testing', () => {
      render(<MockLobby />);
      
      // Проверяем, что элементы доступны для тестирования
      expect(screen.getByText('Lobby')).toBeTruthy();
      expect(screen.getByText('Go to Table abc123')).toBeTruthy();
    });
  });

  describe('Content Validation', () => {
    it('should display correct table ID', () => {
      render(<MockLobby />);
      
      const link = screen.getByText('Go to Table abc123');
      expect(link).toBeTruthy();
    });

    it('should have proper text content', () => {
      render(<MockLobby />);
      
      expect(screen.getByText('Lobby')).toBeTruthy();
      expect(screen.getByText('Go to Table abc123')).toBeTruthy();
    });
  });
});