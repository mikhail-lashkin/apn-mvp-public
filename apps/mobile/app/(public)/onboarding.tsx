/**
 * @file: onboarding.tsx
 * @description: Экран онбординга с 3 слайдами
 * @dependencies: expo-router, React Native, LinearGradient
 * @created: 2025-01-28
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: number;
  title: string;
  description: string;
  icon: string;
  gradient: string[];
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    title: 'Добро пожаловать в AI Poker Notes',
    description: 'Умные заметки для покера с использованием AI и NLP технологий',
    icon: '🎯',
    gradient: ['#3b82f6', '#1d4ed8']
  },
  {
    id: 2,
    title: 'Как работает анализ',
    description: 'Автоматическое выявление паттернов поведения и классификация игроков по типажам',
    icon: '🤖',
    gradient: ['#10b981', '#047857']
  },
  {
    id: 3,
    title: 'Интеграции и синхронизация',
    description: 'Импорт/экспорт с Obsidian, TextExpander и другими инструментами',
    icon: '🔗',
    gradient: ['#8b5cf6', '#7c3aed']
  }
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTestMode, setIsTestMode] = useState(true);

  const nextSlide = async () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      try {
        // Для веб-версии используем localStorage как fallback
        if (Platform.OS === 'web') {
          localStorage.setItem('has_seen_onboarding', 'true');
        } else {
          await AsyncStorage.setItem('has_seen_onboarding', 'true');
        }
      } catch (error) {
        console.error('Error saving onboarding status:', error);
      }
      router.replace('/(public)/login');
    }
  };

  const skipOnboarding = () => {
    router.replace('/(public)/login');
  };

  const currentSlideData = slides[currentSlide];

  // Тестовый режим - показываем простой экран
  if (isTestMode) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
          🎯 AI Poker Notes
        </Text>
        <Text style={{ color: 'white', fontSize: 18, marginBottom: 30, textAlign: 'center' }}>
          Тестовый экран онбординга
        </Text>
        <Text style={{ color: 'white', fontSize: 14, marginBottom: 30, textAlign: 'center' }}>
          Платформа: {Platform.OS}
        </Text>
        <TouchableOpacity
          onPress={() => setIsTestMode(false)}
          style={{ backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, marginBottom: 10 }}
        >
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center', fontWeight: '600' }}>
            Показать настоящий онбординг
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/(public)/login')}
          style={{ backgroundColor: '#10b981', padding: 16, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center', fontWeight: '600' }}>
            Перейти к логину
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <LinearGradient
        colors={currentSlideData.gradient}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Skip button */}
        <View
          style={{
            position: 'absolute',
            top: Math.max(insets.top, 12) + 8,
            right: 24,
            zIndex: 10,
          }}
        >
          <TouchableOpacity
            onPress={skipOnboarding}
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
          >
            <Text style={{ color: 'white', fontSize: 14, fontWeight: '500' }}>Пропустить</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          {/* Debug info */}
          <View style={{ position: 'absolute', top: 100, left: 24, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 4 }}>
            <Text style={{ color: 'white', fontSize: 12 }}>Платформа: {Platform.OS}</Text>
            <Text style={{ color: 'white', fontSize: 12 }}>Слайд: {currentSlide + 1}/{slides.length}</Text>
          </View>
          
          {/* Icon */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 64 }}>{currentSlideData.icon}</Text>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 24 }}>
            {currentSlideData.title}
          </Text>

          {/* Description */}
          <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', lineHeight: 24, marginBottom: 48 }}>
            {currentSlideData.description}
          </Text>

          {/* Progress indicators */}
          <View style={{ flexDirection: 'row', marginBottom: 48 }}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: index === currentSlide ? 'white' : 'rgba(255, 255, 255, 0.3)',
                  marginHorizontal: 4
                }}
              />
            ))}
          </View>

          {/* Next button */}
          <TouchableOpacity
            onPress={nextSlide}
            style={{ backgroundColor: 'white', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, width: '100%', maxWidth: 300 }}
          >
            <Text style={{ color: '#1f2937', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
              {currentSlide === slides.length - 1 ? 'Начать' : 'Далее'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}