/**
 * @file: mindset.tsx
 * @description: Экран Mindset Helper с 3 табами (Tilt, Focus, Review)
 * @dependencies: expo-router, mindset components, eventLogger
 * @created: 2025-01-28
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TiltTab } from '../../components/mindset/TiltTab';
import { FocusTab } from '../../components/mindset/FocusTab';
import { ReviewTab } from '../../components/mindset/ReviewTab';
import { mindsetStore } from '../../stores/mindset';
import { eventLogger } from '../../services/eventLogger';

// Material Design 3 цвета
const MD3_COLORS = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  background: '#FFFBFE',
  onBackground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
};

type TabType = 'tilt' | 'focus' | 'review';

export default function MindsetScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('tilt');

  // Инициализация store при монтировании
  useEffect(() => {
    mindsetStore.initialize();
  }, []);

  // Логирование смены таба
  useEffect(() => {
    eventLogger.logEvent('mindset', 'tab_change', { tab: activeTab });
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleBack = () => {
    router.back();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'tilt':
        return <TiltTab />;
      case 'focus':
        return <FocusTab />;
      case 'review':
        return <ReviewTab />;
      default:
        return <TiltTab />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Заголовок */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Назад к столу</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mindset Helper</Text>
      </View>

      {/* Табы */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tilt' && styles.tabActive]}
          onPress={() => handleTabChange('tilt')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'tilt' && styles.tabTextActive,
            ]}
          >
            Tilt
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'focus' && styles.tabActive]}
          onPress={() => handleTabChange('focus')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'focus' && styles.tabTextActive,
            ]}
          >
            Focus
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'review' && styles.tabActive]}
          onPress={() => handleTabChange('review')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'review' && styles.tabTextActive,
            ]}
          >
            Review
          </Text>
        </TouchableOpacity>
      </View>

      {/* Контент таба */}
      <View style={styles.content}>{renderTab()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MD3_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MD3_COLORS.surfaceVariant,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: MD3_COLORS.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: MD3_COLORS.onSurface,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: MD3_COLORS.surfaceVariant,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: MD3_COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: MD3_COLORS.onSurfaceVariant,
  },
  tabTextActive: {
    color: MD3_COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});

