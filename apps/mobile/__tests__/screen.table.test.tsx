/**
 * @file: screen.table.test.tsx
 * @description: Тесты для экрана стола (SC-1 / 8-max)
 * @dependencies: TableScreen, SpeedFocusUI_MD3
 * @created: 2025-01-28
 * @updated: 2026-07-15
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TableScreen from '../app/(app)/table/[id]';
import { tableStore } from '../stores/table';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock('../components/TagModal', () => ({
  TagModal: () => null,
}));

jest.mock('../components/QuickNote', () => ({
  QuickNote: () => null,
}));

jest.mock('../components/NewPlayerSheet', () => ({
  NewPlayerSheet: () => null,
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sc1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

describe('TableScreen SC-1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tableStore.selectPlayer(null);
    Object.keys(tableStore.notesByPlayerId).forEach((playerId) => {
      tableStore.notesByPlayerId[playerId] = [];
    });
  });

  it('рендерит шапку с блайндами 1/2', async () => {
    const { getByTestId } = render(<TableScreen />);
    await waitFor(() => {
      expect(getByTestId('table-stakes').props.children).toBe('$1/2');
    });
  });

  it('отображает 8 сидений для sc1 (HERO + 2 игрока + пустые)', async () => {
    const { getByText, getByTestId } = render(<TableScreen />);
    await waitFor(() => {
      expect(getByText('HERO')).toBeTruthy();
      expect(getByText('Иван')).toBeTruthy();
      expect(getByText('Пётр')).toBeTruthy();
    });
    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 3 || i === 4) continue;
      expect(getByTestId(`seat-empty-${i}`)).toBeTruthy();
    }
  });

  it('открывает QuickNote при клике по занятому месту', async () => {
    const { getByText } = render(<TableScreen />);
    await waitFor(() => expect(getByText('Иван')).toBeTruthy());
    fireEvent.press(getByText('Иван'));
    expect(tableStore.selectedPlayerId).toBeTruthy();
  });

  it('не открывает модалку при клике по HERO', async () => {
    const { getByText } = render(<TableScreen />);
    await waitFor(() => expect(getByText('HERO')).toBeTruthy());
    fireEvent.press(getByText('HERO'));
    expect(tableStore.selectedPlayerId).toBeNull();
  });
});
