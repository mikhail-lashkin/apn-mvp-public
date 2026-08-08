/**
 * @file: component.tagModal.test.tsx
 * @description: TagModal рендерит seed ColorSystem (SC-6)
 * @created: 2026-07-17
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TagModal } from '../components/TagModal';
import { PLAYER_TAG_SEED } from '../constants/playerTags';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

describe('TagModal', () => {
  it('рендерит seed codes и Снять метку', () => {
    const onTagSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <TagModal isOpen onClose={jest.fn()} onTagSelect={onTagSelect} />
    );

    for (const tag of PLAYER_TAG_SEED) {
      expect(getByTestId(`player-tag-${tag.code}`)).toBeTruthy();
    }
    expect(getByTestId('player-tag-unknown')).toBeTruthy();
    expect(getByText('Снять метку')).toBeTruthy();

    fireEvent.press(getByTestId('player-tag-fish'));
    expect(onTagSelect).toHaveBeenCalledWith('fish');
  });
});
