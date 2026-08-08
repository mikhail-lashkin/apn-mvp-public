/**
 * @file: login.tsx
 * @description: Экран входа с реальной аутентификацией через authStore (FB-2)
 * @dependencies: expo-router, authStore, expo-linear-gradient
 * @created: 2025-01-27
 * @updated: 2026-06-18
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const authStore = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не короче 6 символов');
      return;
    }

    try {
      await authStore.login(trimmedEmail, password);
      router.replace('/(app)/lobby');
    } catch {
      Alert.alert('Ошибка входа', authStore.error ?? 'Не удалось войти');
    }
  }, [authStore, email, password]);

  const handleRegister = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Ошибка', 'Для регистрации укажите email и пароль');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не короче 6 символов');
      return;
    }

    try {
      await authStore.register(trimmedEmail, password);
      router.replace('/(app)/lobby');
    } catch {
      Alert.alert('Ошибка регистрации', authStore.error ?? 'Не удалось зарегистрироваться');
    }
  }, [authStore, email, password]);

  const handleForgotPassword = useCallback(() => {
    Alert.alert(
      'Восстановление пароля',
      'Функция восстановления пароля будет доступна в следующих версиях.',
      [{ text: 'OK' }]
    );
  }, []);

  const isLoading = authStore.isLoading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#1e293b', '#0f172a']} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 24),
          }}
        >
        <View style={{ paddingVertical: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎯</Text>
            <Text
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: 8,
              }}
            >
              AI Poker Notes
            </Text>
            <Text style={{ fontSize: 16, color: '#94a3b8', textAlign: 'center' }}>
              Войдите в свой аккаунт
            </Text>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 8,
              }}
            >
              Email
            </Text>
            <TextInput
              testID="login-email"
              accessibilityLabel="login-email"
              value={email}
              onChangeText={setEmail}
              placeholder="Введите email"
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              style={{
                backgroundColor: '#374151',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                fontSize: 16,
                color: 'white',
                borderWidth: 1,
                borderColor: '#4b5563',
              }}
            />
          </View>

          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 8,
              }}
            >
              Пароль
            </Text>
            <TextInput
              testID="login-password"
              accessibilityLabel="login-password"
              value={password}
              onChangeText={setPassword}
              placeholder="Введите пароль"
              placeholderTextColor="#6b7280"
              secureTextEntry
              editable={!isLoading}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => {
                void handleLogin();
              }}
              style={{
                backgroundColor: '#374151',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                fontSize: 16,
                color: 'white',
                borderWidth: 1,
                borderColor: '#4b5563',
              }}
            />
          </View>

          <Pressable
            testID="login-submit"
            accessibilityLabel="login-submit"
            accessibilityRole="button"
            accessible
            onPress={handleLogin}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#6b7280' : '#3b82f6',
              paddingVertical: 16,
              borderRadius: 12,
              marginBottom: 16,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </Text>
          </Pressable>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#4b5563' : '#374151',
              paddingVertical: 16,
              borderRadius: 12,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: '#4b5563',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {isLoading ? 'Подождите...' : 'Зарегистрироваться'}
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={isLoading}
              style={{ marginBottom: 16 }}
            >
              <Text style={{ color: '#60a5fa', fontSize: 16 }}>Забыли пароль?</Text>
            </TouchableOpacity>

            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
              Нужен запущенный backend на порту 8000
            </Text>
          </View>
        </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
