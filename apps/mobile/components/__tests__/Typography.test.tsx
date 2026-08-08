/**
 * @file: Typography.test.tsx
 * @description: Тесты для компонента Typography
 * @dependencies: @testing-library/react-native, jest
 * @created: 2025-01-27
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MockTypography } from '../../__tests__/test-utils';

describe('Typography Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render children text correctly', () => {
      const testText = 'Test Typography Text';
      render(<MockTypography>{testText}</MockTypography>);
      
      expect(screen.getByText(testText)).toBeTruthy();
    });

    it('should render with default variant (body)', () => {
      const testText = 'Body Text';
      render(<MockTypography>{testText}</MockTypography>);
      
      const textElement = screen.getByText(testText);
      expect(textElement).toBeTruthy();
    });

    it('should render with custom variant', () => {
      const testText = 'Heading Text';
      render(<MockTypography variant="h1">{testText}</MockTypography>);
      
      const textElement = screen.getByText(testText);
      expect(textElement).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should apply h1 variant styles correctly', () => {
      render(<MockTypography variant="h1">Heading 1</MockTypography>);
      
      const textElement = screen.getByText('Heading 1');
      expect(textElement).toBeTruthy();
    });

    it('should apply h2 variant styles correctly', () => {
      render(<MockTypography variant="h2">Heading 2</MockTypography>);
      
      const textElement = screen.getByText('Heading 2');
      expect(textElement).toBeTruthy();
    });

    it('should apply h3 variant styles correctly', () => {
      render(<MockTypography variant="h3">Heading 3</MockTypography>);
      
      const textElement = screen.getByText('Heading 3');
      expect(textElement).toBeTruthy();
    });

    it('should apply body variant styles correctly', () => {
      render(<MockTypography variant="body">Body Text</MockTypography>);
      
      const textElement = screen.getByText('Body Text');
      expect(textElement).toBeTruthy();
    });

    it('should apply caption variant styles correctly', () => {
      render(<MockTypography variant="caption">Caption Text</MockTypography>);
      
      const textElement = screen.getByText('Caption Text');
      expect(textElement).toBeTruthy();
    });
  });

  describe('Props Forwarding', () => {
    it('should forward additional props to Text component', () => {
      const testId = 'typography-test';
      const onPress = jest.fn();
      
      render(
        <MockTypography testID={testId} onPress={onPress}>
          Clickable Text
        </MockTypography>
      );
      
      const textElement = screen.getByTestId(testId);
      expect(textElement).toBeTruthy();
    });

    it('should handle style prop correctly', () => {
      const customStyle = { color: 'red', fontSize: 20 };
      
      render(
        <MockTypography style={customStyle}>
          Styled Text
        </MockTypography>
      );
      
      const textElement = screen.getByText('Styled Text');
      expect(textElement).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      render(<MockTypography></MockTypography>);
      
      const textElement = screen.getByTestId('typography-empty');
      expect(textElement).toBeTruthy();
    });

    it('should handle null children', () => {
      render(<MockTypography>{null}</MockTypography>);
      
      const textElement = screen.getByTestId('typography-null');
      expect(textElement).toBeTruthy();
    });

    it('should handle undefined children', () => {
      render(<MockTypography>{undefined}</MockTypography>);
      
      const textElement = screen.getByTestId('typography-undefined');
      expect(textElement).toBeTruthy();
    });

    it('should handle multiple children', () => {
      render(
        <MockTypography>
          <MockTypography variant="h1">Title</MockTypography>
          <MockTypography variant="body">Description</MockTypography>
        </MockTypography>
      );
      
      expect(screen.getByText('Title')).toBeTruthy();
      expect(screen.getByText('Description')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should support accessibility props', () => {
      render(
        <MockTypography 
          accessible={true}
          accessibilityLabel="Typography component"
          accessibilityRole="text"
        >
          Accessible Text
        </MockTypography>
      );
      
      const textElement = screen.getByText('Accessible Text');
      expect(textElement).toBeTruthy();
    });
  });
});