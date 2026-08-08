/**
 * @file: SpeedFocusUI.tsx
 * @description: Главный контейнер Speed Focus UI для мобильного приложения
 * @dependencies: TableSvg, TagModal, QuickNote, expo-haptics
 * @created: 2025-01-28
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Dimensions,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { TableSvg } from './TableSvg';
import { TagModal } from './TagModal';
import { QuickNote } from './QuickNote';

const { width: screenWidth } = Dimensions.get('window');

interface Seat {
  seat: number;
  playerId: string;
  displayName: string;
  tag?: string;
  color?: string;
  isActive: boolean;
  noteCount?: number;
}

interface Table {
  id: string;
  name: string;
  maxSeats: number;
  seats: Seat[];
  heroPosition?: number;
  stakes?: string;
  startedAt: string;
}

interface SpeedFocusUIProps {
  tableId: string;
  initialTable?: Table;
  onTableUpdate?: (table: Table) => void;
  onNoteCreate?: (note: { text: string; tags: string[]; type: string }) => Promise<void>;
  onPlayerTagUpdate?: (seat: number, tag: string) => Promise<void>;
}

export const SpeedFocusUI: React.FC<SpeedFocusUIProps> = ({
  tableId,
  initialTable,
  onTableUpdate,
  onNoteCreate,
  onPlayerTagUpdate
}) => {
  const [table, setTable] = useState<Table>(initialTable || {
    id: tableId,
    name: 'Покерный стол',
    maxSeats: 9,
    seats: [],
    startedAt: new Date().toISOString()
  });

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);

  // Таймер сессии
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Инициализация стола с демо-данными
  useEffect(() => {
    initializeTable();
  }, []);

  const initializeTable = () => {
    const demoSeats: Seat[] = [
      { seat: 0, playerId: '1', displayName: 'Игрок 1', isActive: true, noteCount: 0 },
      { seat: 1, playerId: '2', displayName: 'Игрок 2', isActive: true, noteCount: 0 },
      { seat: 2, playerId: '3', displayName: 'Игрок 3', isActive: true, noteCount: 0 },
      { seat: 3, playerId: 'hero', displayName: 'Вы (HERO)', isActive: true, noteCount: 0 },
      { seat: 4, playerId: '5', displayName: 'Игрок 5', isActive: true, noteCount: 0 },
      { seat: 5, playerId: '6', displayName: 'Игрок 6', isActive: true, noteCount: 0 },
    ];

    setTable(prev => ({
      ...prev,
      seats: demoSeats,
      heroPosition: 3
    }));
  };

  const handleSeatClick = (seatNumber: number) => {
    const seat = table.seats.find(s => s.seat === seatNumber);
    if (!seat || seat.playerId === 'hero') return;

    setSelectedSeat(seatNumber);
    setIsNoteModalOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSeatLongPress = (seatNumber: number) => {
    const seat = table.seats.find(s => s.seat === seatNumber);
    if (!seat || seat.playerId === 'hero') return;

    setSelectedSeat(seatNumber);
    setIsTagModalOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleTagSelect = async (tag: string) => {
    if (selectedSeat === null) return;

    try {
      setIsLoading(true);
      setError(null);

      // Обновляем локальное состояние
      const updatedSeats = table.seats.map(seat => {
        if (seat.seat === selectedSeat) {
          return {
            ...seat,
            tag: tag === 'EMPTY' ? undefined : tag,
            color: tag === 'EMPTY' ? undefined : getTagColor(tag)
          };
        }
        return seat;
      });

      const updatedTable = {
        ...table,
        seats: updatedSeats
      };

      setTable(updatedTable);

      // Уведомляем родительский компонент
      if (onPlayerTagUpdate) {
        await onPlayerTagUpdate(selectedSeat, tag);
      }

      if (onTableUpdate) {
        onTableUpdate(updatedTable);
      }

      // Телеметрия
      trackEvent('ui.player.tag_set', {
        tableId,
        seat: selectedSeat,
        tag
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      console.error('Ошибка обновления метки игрока:', error);
      setError('Ошибка обновления метки игрока');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteSave = async (note: { text: string; tags: string[]; type: string }) => {
    try {
      setError(null);

      // Создаем заметку
      if (onNoteCreate) {
        await onNoteCreate(note);
      }

      // Обновляем счетчик заметок для выбранного игрока
      if (selectedSeat !== null) {
        const updatedSeats = table.seats.map(seat => {
          if (seat.seat === selectedSeat) {
            return {
              ...seat,
              noteCount: (seat.noteCount || 0) + 1
            };
          }
          return seat;
        });

        const updatedTable = {
          ...table,
          seats: updatedSeats
        };

        setTable(updatedTable);

        if (onTableUpdate) {
          onTableUpdate(updatedTable);
        }
      }

      // Телеметрия
      trackEvent('ui.note.create', {
        tableId,
        seat: selectedSeat,
        length: note.text.length,
        tagsCount: note.tags.length
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      console.error('Ошибка сохранения заметки:', error);
      setError('Ошибка сохранения заметки');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const getTagColor = (tag: string): string => {
    const colors: Record<string, string> = {
      TAG: '#3B82F6',
      LAG: '#EF4444',
      NIT: '#8B5CF6',
      MANIAC: '#F97316',
      FISH: '#10B981',
      REG: '#F59E0B',
      UNKNOWN: '#6B7280',
      EMPTY: '#E5E7EB',
      RECENT: '#EC4899',
      FAVORITE: '#F59E0B'
    };
    return colors[tag] || '#6B7280';
  };

  const trackEvent = (type: string, payload: Record<string, any>) => {
    // TODO: Реализовать отправку телеметрии
    console.log('Telemetry:', { type, payload, timestamp: Date.now() });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedPlayer = selectedSeat !== null 
    ? table.seats.find(seat => seat.seat === selectedSeat)
    : null;

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b']}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.tableName}>{table.name}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Время</Text>
              <Text style={styles.statValue}>{formatTime(sessionTime)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Игроки</Text>
              <Text style={styles.statValue}>
                {table.seats.filter(s => s.isActive).length}/{table.maxSeats}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Заметки</Text>
              <Text style={styles.statValue}>
                {table.seats.reduce((acc, seat) => acc + (seat.noteCount || 0), 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Poker Table */}
        <View style={styles.tableContainer}>
          <TableSvg
            seats={table.seats}
            maxSeats={table.maxSeats}
            heroPosition={table.heroPosition}
            onSeatClick={handleSeatClick}
            onSeatLongPress={handleSeatLongPress}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={() => setIsNoteModalOpen(true)}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>📝 Быстрая заметка</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsTagModalOpen(true)}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>🏷️ Цветовая метка</Text>
          </TouchableOpacity>
        </View>

        {/* Player Notes Summary */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Заметки по игрокам</Text>
          {table.seats
            .filter(seat => seat.noteCount && seat.noteCount > 0)
            .map(seat => (
              <View key={seat.seat} style={styles.noteItem}>
                <View style={styles.noteHeader}>
                  <Text style={styles.notePlayerName}>{seat.displayName}</Text>
                  {seat.tag && (
                    <View style={[styles.noteTag, { backgroundColor: getTagColor(seat.tag) }]}>
                      <Text style={styles.noteTagText}>{seat.tag}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.noteCount}>
                  {seat.noteCount} заметок
                </Text>
              </View>
            ))}
          
          {table.seats.filter(seat => seat.noteCount && seat.noteCount > 0).length === 0 && (
            <View style={styles.emptyNotes}>
              <Text style={styles.emptyNotesText}>
                Пока нет заметок. Нажмите на игрока для добавления заметки.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <TagModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        onTagSelect={handleTagSelect}
        currentTag={selectedPlayer?.tag}
        playerName={selectedPlayer?.displayName}
      />

      <QuickNote
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSave={handleNoteSave}
        playerName={selectedPlayer?.displayName}
        seatNumber={selectedSeat || undefined}
        tableId={tableId}
        playerId={selectedPlayer?.playerId || ''}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  tableName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tableContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  notesContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  notesTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  noteItem: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notePlayerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noteTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  noteTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  noteCount: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyNotes: {
    backgroundColor: '#374151',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyNotesText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
  },
});
