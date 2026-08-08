/**
 * @file: component.noteModal.test.tsx
 * @description: Тесты QuickNote — save-on-close, save, теги
 * @dependencies: QuickNote, tableStore
 * @created: 2025-01-28
 * @updated: 2026-07-15
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QuickNote } from '../components/QuickNote';
import { tableStore, Tag } from '../stores/table';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: false }),
}));

jest.mock('../services/api/notesApi', () => ({
  notesApi: {
    createNote: jest.fn().mockResolvedValue({
      id: 101,
      user_id: 1,
      text: 'mock',
      tags: [],
      created_at: '2026-01-01T00:00:00Z',
    }),
    getNotes: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    }),
  },
}));

jest.mock('../services/api/playersApi', () => ({
  playersApi: {
    getPlayers: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    }),
  },
}));

jest.mock('../services/sync/syncQueue', () => ({
  syncQueue: {
    add: jest.fn().mockResolvedValue('sync_1'),
  },
}));

describe('QuickNote', () => {
  let playerId: string;

  const baseProps = () => ({
    isOpen: true,
    onClose: jest.fn(),
    playerName: 'Тестовый игрок',
    seatNumber: 0,
    tableId: 'abc123',
    playerId,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    tableStore.resetState();
    const player = await tableStore.createPlayer('Тестовый игрок', [Tag.FISH], 0);
    playerId = player.id;
  });

  it('рендерит модалку с заголовком и полем заметки', () => {
    const { getByText, getByTestId } = render(<QuickNote {...baseProps()} />);

    expect(getByText('Заметка: Тестовый игрок')).toBeTruthy();
    expect(getByText('Текст заметки')).toBeTruthy();
    expect(getByTestId('quick-note-text')).toBeTruthy();
  });

  it('загружает существующую заметку при открытии', () => {
    tableStore.upsertNote(playerId, {
      text: 'Существующая заметка',
      tags: ['Fish'],
    });

    const { getByDisplayValue } = render(<QuickNote {...baseProps()} />);

    expect(getByDisplayValue('Существующая заметка')).toBeTruthy();
  });

  it('сохраняет заметку по кнопке Сохранить', async () => {
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <QuickNote {...baseProps()} onClose={onClose} />
    );

    fireEvent.changeText(getByTestId('quick-note-text'), 'Тестовая заметка');
    fireEvent.press(getByText('Сохранить'));

    await waitFor(() => {
      expect(tableStore.getLastNote(playerId)?.text).toBe('Тестовая заметка');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('save-on-close: сохраняет текст при закрытии ✕ без Save', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <QuickNote {...baseProps()} onClose={onClose} />
    );

    fireEvent.changeText(getByTestId('quick-note-text'), 'MAESTRO_AUTOSAVE_001');
    fireEvent.press(getByTestId('close-player-profile'));

    await waitFor(() => {
      expect(tableStore.getLastNote(playerId)?.text).toBe('MAESTRO_AUTOSAVE_001');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('save-on-close: пустой текст — закрывает без сохранения', async () => {
    const saveSpy = jest.spyOn(tableStore, 'saveNote');
    const onClose = jest.fn();
    const { getByTestId } = render(
      <QuickNote {...baseProps()} onClose={onClose} />
    );

    fireEvent.press(getByTestId('close-player-profile'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(saveSpy).not.toHaveBeenCalled();
    saveSpy.mockRestore();
  });

  it('добавляет тег лимп (toggle) и сохраняет', async () => {
    const { getByTestId, getByText } = render(<QuickNote {...baseProps()} />);

    fireEvent.changeText(getByTestId('quick-note-text'), 'Заметка с тегом');
    fireEvent.press(getByTestId('note-tag-лимп'));
    fireEvent.press(getByText('Сохранить'));

    await waitFor(() => {
      const note = tableStore.getLastNote(playerId);
      expect(note?.text).toBe('Заметка с тегом');
      expect(note?.tags).toContain('лимп');
    });
  });

  it('toggle снимает выбранный тег', async () => {
    const { getByTestId, getByText } = render(<QuickNote {...baseProps()} />);

    fireEvent.changeText(getByTestId('quick-note-text'), 'Toggle off');
    fireEvent.press(getByTestId('note-tag-лимп'));
    fireEvent.press(getByTestId('note-tag-лимп'));
    fireEvent.press(getByText('Сохранить'));

    await waitFor(() => {
      const note = tableStore.getLastNote(playerId);
      expect(note?.tags ?? []).not.toContain('лимп');
    });
  });

  it('сохраняет только тег без текста заметки', async () => {
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <QuickNote {...baseProps()} onClose={onClose} />
    );

    fireEvent.press(getByTestId('note-tag-лимп'));
    fireEvent.press(getByText('Сохранить'));

    await waitFor(() => {
      const note = tableStore.getLastNote(playerId);
      expect(note?.text).toBe('');
      expect(note?.tags).toContain('лимп');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('Save серая без текста и без тегов', () => {
    const { getByTestId } = render(<QuickNote {...baseProps()} />);
    expect(getByTestId('quick-note-save').props.disabled).toBe(true);
  });

  it('показывает группы Preflop / Postflop', () => {
    const { getByText } = render(<QuickNote {...baseProps()} />);
    expect(getByText('Preflop')).toBeTruthy();
    expect(getByText('Postflop')).toBeTruthy();
    expect(getByText('лимп')).toBeTruthy();
  });
});
