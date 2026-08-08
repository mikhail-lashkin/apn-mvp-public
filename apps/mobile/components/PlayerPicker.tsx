/**
 * @file: PlayerPicker.tsx
 * @description: Простая версия без react-native-element-dropdown для избежания проблем с зависимостями
 * @dependencies: react-native
 * @created: 2025-01-30
 * @updated: 2026-07-21
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';

// Временно используем локальный тип вместо @apn/core
type Player = {
  id: string;
  backendId?: number | null;
  tableId: string;
  seat: number;
  name?: string;
  tags?: string[];
  createdAt: string;
};

interface PlayerPickerProps {
  players: Player[];
  selectedPlayerId?: string;
  onPlayerSelect: (playerId: string) => void;
  onCreateNewPlayer?: () => void;
  placeholder?: string;
}

function playerLabel(player: Player): string {
  const name = player.name?.trim();
  if (name) return name;
  // seat в store — 1-based (createPlayer: seatIndex + 1)
  if (player.seat > 0) return `Без имени · ${player.seat}`;
  return 'Без имени';
}

export const PlayerPicker: React.FC<PlayerPickerProps> = ({
  players,
  selectedPlayerId,
  onPlayerSelect,
  onCreateNewPlayer,
  placeholder = 'Выберите игрока...',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredPlayers = players.filter((player) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return playerLabel(player).toLowerCase().includes(q);
  });

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  const handlePlayerSelect = (playerId: string) => {
    onPlayerSelect(playerId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID="player-picker-toggle"
        accessibilityLabel="player-picker-toggle"
        style={styles.selector}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={styles.selectorText}>
          {selectedPlayer ? playerLabel(selectedPlayer) : placeholder}
        </Text>
        <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdown}>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск игроков..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.list}>
            {filteredPlayers.map((item) => (
              <TouchableOpacity
                key={item.id}
                testID={`player-picker-item-${item.id}`}
                accessibilityLabel={`player-picker-item-${item.id}`}
                style={[
                  styles.playerItem,
                  item.id === selectedPlayerId && styles.playerItemSelected,
                ]}
                onPress={() => handlePlayerSelect(item.id)}
              >
                <Text style={styles.playerName}>{playerLabel(item)}</Text>
                {item.tags && item.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {item.tags.slice(0, 2).map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {onCreateNewPlayer && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                onCreateNewPlayer();
                setIsOpen(false);
              }}
            >
              <Text style={styles.createButtonText}>+ Новый игрок</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 2,
  },
  selector: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  arrow: {
    color: '#94a3b8',
    fontSize: 12,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    zIndex: 1000,
    elevation: 8,
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    margin: 8,
    color: '#fff',
    fontSize: 14,
  },
  list: {
    maxHeight: 200,
    overflow: 'hidden',
  },
  playerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  playerItemSelected: {
    backgroundColor: '#334155',
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  tag: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
  },
  createButton: {
    padding: 12,
    backgroundColor: '#10b981',
    margin: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
