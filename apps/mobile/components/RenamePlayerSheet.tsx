/**
 * @file: RenamePlayerSheet.tsx
 * @description: Переименование игрока за столом (имя можно очистить)
 * @dependencies: react-native, expo-haptics
 * @created: 2026-07-18
 * @updated: 2026-07-19
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type RenamePlayerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
  seatNumber?: number;
};

export const RenamePlayerSheet: React.FC<RenamePlayerSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  seatNumber,
}) => {
  const insets = useSafeAreaInsets();
  const [playerName, setPlayerName] = useState(initialName);
  // Android: KAV behavior выключен (мерцание); поднимаем sheet по IME вручную — как QuickNote
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPlayerName(initialName);
    }
  }, [isOpen, initialName]);

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [isOpen]);

  const handleSave = () => {
    onSave(playerName.trim());
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClose = () => {
    setPlayerName(initialName);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View
          style={[
            styles.sheet,
            {
              // IME поднимает bottom-sheet; иначе поле имени под клавиатурой (S23)
              marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Text style={styles.title}>
            Имя{seatNumber !== undefined ? ` · место ${seatNumber}` : ''}
          </Text>

          <TextInput
            testID="rename-player-name"
            accessibilityLabel="rename-player-name"
            style={styles.textInput}
            placeholder="Необязательно"
            placeholderTextColor="#94a3b8"
            value={playerName}
            onChangeText={setPlayerName}
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              testID="rename-player-cancel"
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="rename-player-save"
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
