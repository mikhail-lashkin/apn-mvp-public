/**
 * @file: simple-test.tsx
 * @description: Простой тест для проверки запуска приложения
 * @created: 2025-01-30
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SimpleTest() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Приложение запущено!</Text>
      <Text style={styles.subtext}>Тест работает</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: '#94a3b8',
  },
});