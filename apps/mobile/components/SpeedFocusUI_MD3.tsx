/**
 * @file: SpeedFocusUI_MD3.tsx
 * @description: Speed Focus UI с Material Design 3
 * @dependencies: TableSvg, TagModal, QuickNote, expo-haptics
 * @created: 2025-09-30
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { TagModal } from './TagModal';
import { QuickNote } from './QuickNote';
import { NewPlayerSheet } from './NewPlayerSheet';
import { RenamePlayerSheet } from './RenamePlayerSheet';
import { PlayerTagsSettingsSheet } from './PlayerTagsSettingsSheet';
import { tableStore, useTableStore, Player, Tag, HIDE_PLAYER_UNDO_MS } from '../stores/table';
import { tablesStore } from '../stores/tables';
import { getPlayerTagColor } from '../constants/playerTags';
import { playerTagsStore } from '../stores/playerTags';
import { eventLogger } from '../services/eventLogger';

const SEATS_STORAGE_PREFIX = '@apn:speed_focus_seats_v1';

const getSeatsStorageKey = (tableId: string) =>
  `${SEATS_STORAGE_PREFIX}:${tableId || 'default'}`;

const getTableLayout = () => {
  const { width: screenWidth } = Dimensions.get('window');
  const tableWidth = Math.min(screenWidth - 48, 320);
  const seatSize = tableWidth >= 300 ? 52 : 48;
  return { tableWidth, seatSize };
};

/** Подпись на фишке: имя или номер места, если имени нет */
const seatChipLabel = (seat: { seat: number; displayName?: string }) => {
  const name = seat.displayName?.trim();
  if (!name || name === 'Пусто') return String(seat.seat + 1);
  return name.split(' ')[0];
};

const playerListLabel = (player: { name?: string; seat?: number }) => {
  const name = player.name?.trim();
  if (name) return name;
  if (player.seat && player.seat > 0) return `Без имени · ${player.seat}`;
  return 'Без имени';
};
// Tag / ColorSystem — stores/table + constants/playerTags

// Material Design 3 цвета
const MD3_COLORS = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  background: '#FFFBFE',
  onBackground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
};

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

interface SpeedFocusUI_MD3Props {
  tableId: string;
  initialTable?: Table;
  onTableUpdate?: (table: Table) => void;
  onNoteCreate?: (note: { text: string; tags: string[]; type: string }) => Promise<void>;
}

export const SpeedFocusUI_MD3: React.FC<SpeedFocusUI_MD3Props> = ({
  tableId,
  initialTable,
  onNoteCreate,
}) => {
  const seatsStorageKey = getSeatsStorageKey(tableId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // 3-button nav на S23 съедает низ sheet — иначе «Отмена» под системной панелью
  const pickSheetPadBottom = Math.max(insets.bottom, 16) + 20;
  useTableStore();

  const [table, setTable] = useState<Table | undefined>(initialTable || {
    id: 'demo-table',
    name: 'Покерный стол',
    maxSeats: 6, // По умолчанию 6-max
    seats: [],
    startedAt: new Date().toISOString()
  });
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [isNewPlayerSheetOpen, setIsNewPlayerSheetOpen] = useState(false);
  const [selectedPlayerForNote, setSelectedPlayerForNote] = useState<Seat | null>(null);
  const [selectedPlayerForTag, setSelectedPlayerForTag] = useState<Seat | null>(null);
  const [selectedSeatForNewPlayer, setSelectedSeatForNewPlayer] = useState<Seat | null>(null);
  const [seatForRename, setSeatForRename] = useState<Seat | null>(null);
  const [createPlayerFromQuickNote, setCreatePlayerFromQuickNote] = useState(false);
  const [pickPlayerForSeat, setPickPlayerForSeat] = useState<Seat | null>(null);
  // SC-10: bottom sheet вместо Alert (Android ≤3 кнопки)
  const [seatMenu, setSeatMenu] = useState<{
    seat: Seat;
    mode: 'empty' | 'occupied';
  } | null>(null);
  const [tagsSettingsOpen, setTagsSettingsOpen] = useState(false);
  // MB-13: soft-hide + undo ~5с до flush
  const [hideUndo, setHideUndo] = useState<{
    token: string;
    seatsBefore: Seat[];
    label: string;
  } | null>(null);

  const persistSeats = useCallback(async (next: Table) => {
    try {
      await AsyncStorage.setItem(
        seatsStorageKey,
        JSON.stringify({
          maxSeats: next.maxSeats,
          stakes: next.stakes,
          seats: next.seats.map((s) => ({
            seat: s.seat,
            playerId: s.playerId,
            displayName: s.displayName,
          })),
        })
      );
    } catch {
      // ignore
    }
  }, [seatsStorageKey]);

  const buildEmptySeats = (maxSeats: number, heroIndex?: number): Seat[] => {
    const heroSeat = heroIndex ?? Math.floor(maxSeats / 2);
    const seats: Seat[] = [];
    for (let i = 0; i < maxSeats; i++) {
      const isHero = i === heroSeat;
      seats.push({
        seat: i,
        playerId: isHero ? 'hero' : 'empty',
        displayName: isHero ? 'Вы (HERO)' : 'Пусто',
        isActive: true,
        noteCount: 0,
        color: isHero ? '#fbbf24' : undefined,
      });
    }
    return seats;
  };

  /** Уникальные по имени + все без имени (по id). Приоритет — у кого больше заметок. */
  const uniqueNamedPlayers = (): Player[] => {
    const players = tableStore.listPlayers();
    const byName = new Map<string, Player>();
    const unnamed: Player[] = [];
    for (const p of players) {
      const key = p.name?.trim().toLowerCase();
      if (!key) {
        unnamed.push(p);
        continue;
      }
      const prev = byName.get(key);
      if (!prev) {
        byName.set(key, p);
        continue;
      }
      const prevNotes = tableStore.getNoteCount(prev.id);
      const nextNotes = tableStore.getNoteCount(p.id);
      if (
        nextNotes > prevNotes ||
        (nextNotes === prevNotes && p.backendId != null && prev.backendId == null)
      ) {
        byName.set(key, p);
      }
    }
    return [...byName.values(), ...unnamed];
  };

  const applyPlayersToSeats = (seats: Seat[], maxSeats: number): Seat[] => {
    const heroIndex = Math.floor(maxSeats / 2);
    const seatedIds = new Set(
      seats
        .filter((s) => s.playerId && s.playerId !== 'empty' && s.playerId !== 'hero')
        .map((s) => s.playerId)
    );
    const candidates = uniqueNamedPlayers().filter((p) => !seatedIds.has(p.id));
    let idx = 0;
    return seats.map((seat) => {
      if (seat.seat === heroIndex || (seat.playerId && seat.playerId !== 'empty')) {
        return seat;
      }
      const player = candidates[idx++];
      if (!player) {
        return seat;
      }
      return {
        ...seat,
        playerId: player.id,
        displayName: player.name || 'Игрок',
        noteCount: tableStore.getNoteCount(player.id),
        tag: player.tags?.[0],
        color: player.tags?.[0]
          ? playerTagsStore.getColor(player.tags[0], getPlayerTagColor(player.tags[0]))
          : seat.color,
      };
    });
  };

  const initializeTable = (
    maxSeats: number,
    seatPlayers = true,
    persist = true,
    stakes?: string,
    heroPosition?: number
  ) => {
    const heroIndex = heroPosition ?? Math.floor(maxSeats / 2);
    const seats = buildEmptySeats(maxSeats, heroIndex);
    const nextSeats = seatPlayers ? applyPlayersToSeats(seats, maxSeats) : seats;
    const stakesLabel = stakes ?? initialTable?.stakes ?? '1/2';
    const next: Table = {
      id: tableId || 'demo-table',
      name: `${maxSeats}-max · $${stakesLabel}`,
      maxSeats,
      seats: nextSeats,
      heroPosition: heroIndex,
      stakes: stakesLabel,
      startedAt: new Date().toISOString(),
    };
    setTable(next);
    if (persist) {
      void persistSeats(next);
    }
    return next;
  };

  const normalizePresetSeats = (seats: Seat[], maxSeats: number): Seat[] => {
    const base = buildEmptySeats(maxSeats);
    return base.map((empty) => {
      const match = seats.find((s) => s.seat === empty.seat);
      if (!match) return empty;
      const pid = match.playerId;
      const isEmpty = !pid || pid === 'empty';
      if (isEmpty) return empty;
      if (pid === 'hero') {
        return { ...empty, playerId: 'hero', displayName: 'Вы (HERO)', color: '#fbbf24' };
      }
      return {
        ...empty,
        playerId: String(pid),
        displayName: match.displayName || 'Игрок',
        isActive: true,
        noteCount: match.noteCount ?? 0,
        color: match.color,
        tag: match.tag,
      };
    });
  };

  // Инициализация стола при загрузке
  useEffect(() => {
    let cancelled = false;

    const bootMaxSeats = initialTable?.maxSeats ?? 6;
    const bootStakes = initialTable?.stakes ?? '1/2';
    const bootHero = initialTable?.heroPosition ?? Math.floor(bootMaxSeats / 2);
    const hasPresetSeats =
      initialTable?.seats != null && initialTable.seats.length > 0;

    const boot = async () => {
      if (!initialTable) {
        initializeTable(6, false, false);
      } else if (hasPresetSeats) {
        setTable({
          id: tableId || initialTable.id,
          name: initialTable.name || `${bootMaxSeats}-max · $${bootStakes}`,
          maxSeats: bootMaxSeats,
          stakes: bootStakes,
          heroPosition: bootHero,
          seats: normalizePresetSeats(initialTable.seats, bootMaxSeats),
          startedAt: initialTable.startedAt || new Date().toISOString(),
        });
      } else {
        initializeTable(bootMaxSeats, false, false, bootStakes, bootHero);
      }

      await tableStore.loadPlayersFromStorage();
      await tableStore.loadNotesFromStorage();
      await tableStore.syncPlayersFromApi();
      if (cancelled) return;

      try {
        const raw = await AsyncStorage.getItem(seatsStorageKey);
        if (raw) {
          const saved = JSON.parse(raw) as {
            maxSeats: number;
            stakes?: string;
            seats: { seat: number; playerId: string; displayName: string }[];
          };
          const maxSeats = saved.maxSeats || bootMaxSeats;
          const base = buildEmptySeats(maxSeats, Math.floor(maxSeats / 2));
          const restored = base.map((seat) => {
            const match = saved.seats.find((s) => s.seat === seat.seat);
            if (!match || match.playerId === 'empty' || match.playerId === 'hero') {
              return seat;
            }
            const resolved = tableStore.resolvePlayerIdForNotes(
              match.playerId,
              match.displayName
            );
            const player = tableStore.getPlayer(resolved);
            // Безымянный (name пустой) — валидный игрок за столом, не сбрасывать место
            if (!player) {
              return seat;
            }
            return {
              ...seat,
              playerId: resolved,
              displayName: player.name?.trim() || match.displayName || '',
              noteCount: tableStore.getNoteCount(resolved),
              tag: player.tags?.[0],
              color: player.tags?.[0]
                ? playerTagsStore.getColor(
                    player.tags[0],
                    getPlayerTagColor(player.tags[0])
                  )
                : undefined,
            };
          });
          const next: Table = {
            id: tableId || 'demo-table',
            name: `${maxSeats}-max · $${saved.stakes || bootStakes}`,
            maxSeats,
            seats: restored,
            heroPosition: Math.floor(maxSeats / 2),
            stakes: saved.stakes || bootStakes,
            startedAt: new Date().toISOString(),
          };
          setTable(next);
          void persistSeats(next);
          return;
        }
      } catch {
        // fallback ниже
      }

      const known = tableStore.listPlayers().filter((p) => p.name?.trim());
      if (known.length === 0) {
        if (hasPresetSeats) {
          const preset: Table = {
            id: tableId || initialTable!.id,
            name: initialTable!.name || `${bootMaxSeats}-max · $${bootStakes}`,
            maxSeats: bootMaxSeats,
            stakes: bootStakes,
            heroPosition: bootHero,
            seats: normalizePresetSeats(initialTable!.seats, bootMaxSeats),
            startedAt: initialTable!.startedAt || new Date().toISOString(),
          };
          setTable(preset);
          void persistSeats(preset);
          return;
        }
        initializeTable(bootMaxSeats, false, true, bootStakes, bootHero);
        return;
      }

      if (!hasPresetSeats) {
        initializeTable(bootMaxSeats, false, true, bootStakes, bootHero);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTable, tableId, seatsStorageKey]);

  const handleHeroPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    eventLogger.logEvent('mindset', 'open', { source: 'hero_tap' });
    router.push('/mindset');
  };

  const syncSeatPlayerId = (seatIndex: number, playerId: string, displayName?: string) => {
    setTable((prev) => {
      if (!prev) {
        return prev;
      }
      const next: Table = {
        ...prev,
        seats: prev.seats.map((s) =>
          s.seat === seatIndex
            ? {
                ...s,
                playerId,
                // пустая строка — валидно (игрок без имени)
                ...(displayName !== undefined ? { displayName } : {}),
              }
            : s
        ),
      };
      void persistSeats(next);
      return next;
    });
  };

  const openNoteForSeat = (seat: Seat, playerId: string, displayName: string) => {
    const resolvedPlayerId = tableStore.ensurePlayerForQuickNote(
      playerId,
      displayName,
      seat.seat
    );
    syncSeatPlayerId(seat.seat, resolvedPlayerId, displayName);
    tableStore.selectPlayer(resolvedPlayerId);
    setSelectedPlayerForNote({
      ...seat,
      playerId: resolvedPlayerId,
      displayName,
    });
    setIsQuickNoteOpen(true);
  };

  const seatAnonymousPlayer = (seat: Seat) => {
    void (async () => {
      try {
        const newPlayer = await tableStore.createPlayer('', [], seat.seat);
        const mark = newPlayer.tags?.[0];
        setTable((prev) => {
          if (!prev) return prev;
          const next: Table = {
            ...prev,
            seats: prev.seats.map((s) =>
              s.seat === seat.seat
                ? {
                    ...s,
                    playerId: newPlayer.id,
                    displayName: '',
                    tag: mark,
                    color: mark
                      ? playerTagsStore.getColor(mark, getPlayerTagColor(mark))
                      : undefined,
                    isActive: true,
                  }
                : s
            ),
          };
          void persistSeats(next);
          return next;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        console.warn('seatAnonymousPlayer failed', e);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    })();
  };

  const openSeatPickerAlert = (seat: Seat) => {
    setSeatMenu({ seat, mode: 'empty' });
  };

  const handleSeatPress = (seat: Seat) => {
    if (seat.playerId === 'hero') {
      handleHeroPress();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!seat.playerId || seat.playerId === 'empty') {
      openSeatPickerAlert(seat);
      return;
    }

    openNoteForSeat(seat, seat.playerId, seat.displayName);
  };

  const clearSeat = (seat: Seat) => {
    setTable((prev) => {
      if (!prev) return prev;
      const next: Table = {
        ...prev,
        seats: prev.seats.map((s) =>
          s.seat === seat.seat
            ? {
                ...s,
                playerId: 'empty',
                displayName: 'Пусто',
                color: undefined,
                noteCount: 0,
              }
            : s
        ),
      };
      void persistSeats(next);
      return next;
    });
  };

  const clearSeatsForPlayerIds = (playerIds: string[]) => {
    const idSet = new Set(playerIds);
    setTable((prev) => {
      if (!prev) return prev;
      const next: Table = {
        ...prev,
        seats: prev.seats.map((s) =>
          s.playerId && idSet.has(s.playerId)
            ? {
                ...s,
                playerId: 'empty',
                displayName: 'Пусто',
                color: undefined,
                tag: undefined,
                noteCount: 0,
              }
            : s
        ),
      };
      void persistSeats(next);
      return next;
    });
  };

  const confirmHidePlayer = (seat: Seat) => {
    const playerId = seat.playerId;
    if (!playerId || playerId === 'empty' || playerId === 'hero') {
      return;
    }
    const label = seat.displayName?.trim() || `Место ${seat.seat + 1}`;
    Alert.alert(
      'Скрыть игрока?',
      `"${label}" пропадёт из списка и со всех мест. Заметки на сервере сохранятся, но будут скрыты. Отменить можно ~${Math.round(HIDE_PLAYER_UNDO_MS / 1000)} сек.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Скрыть',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const seatsBefore = table?.seats ? table.seats.map((s) => ({ ...s })) : [];
              const result = await tableStore.hidePlayer(playerId);
              if (!result) {
                Alert.alert('Ошибка', 'Не удалось скрыть игрока');
                return;
              }
              clearSeatsForPlayerIds(result.relatedIds);
              setHideUndo({
                token: result.undoToken,
                seatsBefore,
                label,
              });
              // баннер сам гаснет; flush делает store
              setTimeout(() => {
                setHideUndo((prev) =>
                  prev?.token === result.undoToken ? null : prev
                );
              }, HIDE_PLAYER_UNDO_MS);
            })();
          },
        },
      ]
    );
  };

  const handleUndoHide = () => {
    if (!hideUndo) return;
    const snapshot = hideUndo;
    setHideUndo(null);
    void (async () => {
      const ok = await tableStore.undoHidePlayer(snapshot.token);
      if (!ok || !table) return;
      const next: Table = { ...table, seats: snapshot.seatsBefore };
      setTable(next);
      void persistSeats(next);
    })();
  };

  const seatExistingPlayer = (seat: Seat, player: Player) => {
    const playerId = tableStore.resolvePlayerIdForNotes(player.id, player.name);
    syncSeatPlayerId(seat.seat, playerId, player.name?.trim() || '');
    setPickPlayerForSeat(null);
  };

  const handleSeatLongPress = (seat: Seat) => {
    if (seat.playerId === 'hero') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const isEmpty = !seat.playerId || seat.playerId === 'empty';
    if (isEmpty) {
      openSeatPickerAlert(seat);
      return;
    }

    setSeatMenu({ seat, mode: 'occupied' });
  };

  const handleTagSelect = (tag: string) => {
    if (!selectedPlayerForTag) {
      setIsTagModalOpen(false);
      return;
    }

    const playerId = selectedPlayerForTag.playerId;
    const seatNum = selectedPlayerForTag.seat;
    const color =
      tag === 'unknown'
        ? undefined
        : playerTagsStore.getColor(tag, getPlayerTagColor(tag));

    void (async () => {
      try {
        await tableStore.setPlayerTag(playerId, tag);
        eventLogger.logTagApplied(tag, selectedPlayerForTag.displayName, 'quick');
        setTable((prev) => {
          if (!prev) return prev;
          const next: Table = {
            ...prev,
            seats: prev.seats.map((s) =>
              s.seat === seatNum
                ? {
                    ...s,
                    tag: tag === 'unknown' ? undefined : tag,
                    color,
                  }
                : s
            ),
          };
          void persistSeats(next);
          return next;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        console.warn('handleTagSelect failed', e);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    })();

    setIsTagModalOpen(false);
  };

  // Обработка создания нового игрока (имя + теги; заметка — отдельно, по тапу на сиденье)
  const handleCreatePlayer = async (name: string, tags: string[]) => {
    const seat = selectedSeatForNewPlayer;

    try {
      const newPlayer = await tableStore.createPlayer(
        name,
        tags as Tag[],
        seat?.seat
      );

      const label = (newPlayer.name || name || '').trim();

      if (seat) {
        const mark = newPlayer.tags?.[0];
        setTable((prev) => {
          if (!prev) return prev;
          const next: Table = {
            ...prev,
            seats: prev.seats.map((s) =>
              s.seat === seat.seat
                ? {
                    ...s,
                    playerId: newPlayer.id,
                    displayName: label,
                    tag: mark,
                    color: mark
                      ? playerTagsStore.getColor(mark, getPlayerTagColor(mark))
                      : undefined,
                    isActive: true,
                  }
                : s
            ),
          };
          void persistSeats(next);
          return next;
        });
      }

      setIsNewPlayerSheetOpen(false);
      setSelectedSeatForNewPlayer(null);

      // Из QuickNote — вернуться к форме заметки с новым игроком (текст не обязателен до Save)
      if (createPlayerFromQuickNote) {
        setCreatePlayerFromQuickNote(false);
        tableStore.selectPlayer(newPlayer.id);
        setSelectedPlayerForNote({
          seat: seat?.seat ?? selectedPlayerForNote?.seat ?? 0,
          playerId: newPlayer.id,
          displayName: label || `Место ${(seat?.seat ?? 0) + 1}`,
          isActive: true,
        });
        setIsQuickNoteOpen(true);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Ошибка создания игрока:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // QuickNote → «новый игрок»: обязательно привязать к месту заметки,
  // иначе createPlayer без seatIndex — имя в списке, а на фишке остаётся «без имени».
  const handleCreateNewPlayerFromQuickNote = useCallback(() => {
    setCreatePlayerFromQuickNote(true);
    const noteSeat = selectedPlayerForNote;
    if (noteSeat && noteSeat.playerId !== 'hero') {
      const occupied =
        Boolean(noteSeat.playerId) && noteSeat.playerId !== 'empty';
      // Безымянный уже сидит — даём имя через rename, не плодим второго игрока
      if (occupied && !noteSeat.displayName?.trim()) {
        setSeatForRename({
          seat: noteSeat.seat,
          playerId: noteSeat.playerId,
          displayName: '',
          isActive: true,
        });
        setIsQuickNoteOpen(false);
        return;
      }
      setSelectedSeatForNewPlayer({
        seat: noteSeat.seat,
        playerId: noteSeat.playerId || 'empty',
        displayName: noteSeat.displayName || '',
        isActive: true,
      });
    }
    setIsQuickNoteOpen(false);
    setIsNewPlayerSheetOpen(true);
  }, [selectedPlayerForNote]);

  const handleCloseQuickNote = useCallback(() => {
    setIsQuickNoteOpen(false);
  }, []);

  const handleCloseNewPlayerSheet = () => {
    setCreatePlayerFromQuickNote(false);
    setSelectedSeatForNewPlayer(null);
    setIsNewPlayerSheetOpen(false);
  };

  const handleRenamePlayer = async (name: string) => {
    const seat = seatForRename;
    if (!seat?.playerId || seat.playerId === 'empty' || seat.playerId === 'hero') {
      return;
    }

    try {
      await tableStore.renamePlayer(seat.playerId, name);
      setTable((prev) => {
        if (!prev) return prev;
        const next: Table = {
          ...prev,
          seats: prev.seats.map((s) =>
            s.seat === seat.seat ? { ...s, displayName: name } : s
          ),
        };
        void persistSeats(next);
        return next;
      });
      setSelectedPlayerForNote((prev) =>
        prev && prev.seat === seat.seat
          ? { ...prev, displayName: name, playerId: seat.playerId }
          : prev
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('handleRenamePlayer failed', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSeatForRename(null);
    }
  };

  const changeTableSize = (maxSeats: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    initializeTable(maxSeats, false, true, table?.stakes);
  };

  const goToLobby = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // replace — надёжнее back(): Link со стола не всегда даёт корректный stack
    router.replace('/(app)/lobby');
  };

  const deleteCurrentTable = () => {
    if (!tablesStore.canDelete(tableId)) {
      Alert.alert(
        'Удаление',
        'Демо-столы удалить нельзя. Создайте свой через «+ Новый стол».'
      );
      return;
    }

    Alert.alert(
      'Удалить стол?',
      'Стол исчезнет из лобби. Локальная рассадка на этом столе тоже очистится.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await tablesStore.remove(tableId);
                await AsyncStorage.removeItem(seatsStorageKey);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
                router.replace('/(app)/lobby');
              } catch {
                Alert.alert('Ошибка', 'Не удалось удалить стол');
              }
            })();
          },
        },
      ]
    );
  };

  const renderTableHeader = () => {
    if (!table) return null;
    const stakesLabel = table.stakes ? `$${table.stakes}` : '$1/2';
    return (
      <View style={styles.tableHeader} testID="table-header">
        <Text style={styles.tableHeaderTitle} numberOfLines={1}>
          {table.maxSeats}-max стол
        </Text>
        <Text style={styles.tableHeaderStakes} testID="table-stakes" accessibilityLabel="table-stakes">
          {stakesLabel}
        </Text>
      </View>
    );
  };

  const renderPokerTable = () => {
    if (!table) return null;

    const { tableWidth, seatSize } = getTableLayout();
    const tableHeight = tableWidth * 0.6;

    return (
      <View style={styles.tableContainer}>
        {renderTableHeader()}
        {/* Покерный стол - овал */}
        <View style={[styles.pokerTable, { width: tableWidth, height: tableHeight, borderRadius: tableWidth / 2 }]}>
          {/* Внутренняя граница */}
          <View style={[styles.tableBorder, { borderRadius: (tableHeight - 16) / 2 }]} />
          
          {/* Игроки */}
          {table.seats.map((seat) => {
            const isEmpty = !seat.playerId || seat.playerId === 'empty';
            const isHero = seat.playerId === 'hero';

            return (
            <TouchableOpacity
              key={seat.seat}
              testID={isEmpty ? `seat-empty-${seat.seat}` : `seat-player-${seat.seat}`}
              accessibilityLabel={
                isEmpty ? `seat-empty-${seat.seat}` : `seat-player-${seat.seat}`
              }
              style={[
                styles.playerSeat,
                { width: seatSize, height: seatSize, borderRadius: seatSize / 2 },
                getPlayerSeatPosition(seat.seat, table.maxSeats, tableWidth, seatSize),
                isHero && styles.heroSeat,
                isEmpty && styles.emptySeat,
                seat.color && !isEmpty
                  ? { backgroundColor: seat.color }
                  : seat.tag && !isEmpty
                    ? { backgroundColor: playerTagsStore.getColor(seat.tag, getPlayerTagColor(seat.tag)) }
                    : null,
              ]}
              onPress={() => handleSeatPress(seat)}
              onLongPress={() => handleSeatLongPress(seat)}
              delayLongPress={500}
            >
              <Text
                style={[styles.playerName, isEmpty && styles.emptySeatText]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isHero ? 'HERO' : isEmpty ? '+' : seatChipLabel(seat)}
              </Text>
              {isEmpty ? (
                <Text style={styles.seatNumber}>{seat.seat + 1}</Text>
              ) : null}
              {!isEmpty && !isHero
                ? (() => {
                    const effectivePlayerId = tableStore.resolvePlayerIdForNotes(
                      seat.playerId,
                      seat.displayName
                    );
                    const noteCount = tableStore.getNoteCount(effectivePlayerId);
                    return noteCount > 0 ? (
                      <View style={styles.noteBadge}>
                        <Text style={styles.noteBadgeText}>{noteCount}</Text>
                      </View>
                    ) : null;
                  })()
                : null}
            </TouchableOpacity>
            );
          })}
        </View>
        
        <Text style={styles.tableHint}>
          «+» — новый / без имени / из списка • Занято — заметка • Долгое — метка / заменить
        </Text>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Размер стола</Text>
      <View style={styles.buttonGrid}>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.buttonPrimary,
            table?.maxSeats === 6 && styles.buttonActive
          ]}
          onPress={() => changeTableSize(6)}
        >
          <Text style={styles.buttonText}>6-max</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.buttonSecondary,
            table?.maxSeats === 8 && styles.buttonActive
          ]}
          onPress={() => changeTableSize(8)}
        >
          <Text style={styles.buttonText}>8-max</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.cardTitle}>Быстрые действия</Text>
      <View style={styles.buttonGrid}>
        <TouchableOpacity
          testID="table-player-tags"
          accessibilityLabel="table-player-tags"
          style={[styles.button, styles.buttonTertiary]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setTagsSettingsOpen(true);
          }}
        >
          <Text style={styles.buttonText}>Метки</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          testID="table-back-lobby"
          accessibilityLabel="table-back-lobby"
          style={[styles.button, styles.buttonTertiary]}
          onPress={goToLobby}
        >
          <Text style={styles.buttonText}>← Лобби</Text>
        </TouchableOpacity>
      </View>

      {tablesStore.canDelete(tableId) ? (
        <TouchableOpacity
          testID="table-delete"
          accessibilityLabel="table-delete"
          style={[styles.button, styles.buttonDanger, { marginTop: 12, flex: 0 }]}
          onPress={deleteCurrentTable}
        >
          <Text style={styles.buttonText}>Удалить стол</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        testID="reset-table-local"
        accessibilityLabel="reset-table-local"
        style={[styles.button, styles.buttonSecondary, { marginTop: 12, flex: 0 }]}
        onPress={() => {
          Alert.alert(
            'Сброс теста',
            'Очистить локальных игроков, заметки и рассадку? Вход сохранится. Сервер уже можно очистить отдельно.',
            [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Очистить',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await tableStore.clearLocalTableData();
                    // Всегда чистый стол (HERO + empty). Пресет sc1/abc123
                    // не восстанавливаем — иначе «Сброс» бесполезен для Maestro.
                    initializeTable(
                      table?.maxSeats ?? initialTable?.maxSeats ?? 6,
                      false,
                      true,
                      table?.stakes ?? initialTable?.stakes,
                      table?.heroPosition ?? initialTable?.heroPosition
                    );
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                  })();
                },
              },
            ]
          );
        }}
      >
        <Text style={[styles.buttonText, { color: MD3_COLORS.onSecondaryContainer }]}>
          Сброс теста (локально)
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderRecentNotes = () => {
    const recent = uniqueNamedPlayers()
      .map((p) => {
        const note = tableStore.getLastNote(p.id);
        return note
          ? { player: p, note, count: tableStore.getNoteCount(p.id) }
          : null;
      })
      .filter(Boolean)
      .slice(0, 5) as {
      player: Player;
      note: { text: string; tags?: string[]; createdAt: string };
      count: number;
    }[];

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Игроки и заметки</Text>
        {recent.length === 0 ? (
          <Text style={styles.noteText}>Пока нет сохранённых заметок</Text>
        ) : (
          recent.map(({ player, note, count }) => {
            const initial = (player.name || '?').trim().charAt(0).toUpperCase();
            return (
              <View key={player.id} style={styles.noteItem}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: MD3_COLORS.primaryContainer },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: MD3_COLORS.onPrimaryContainer },
                    ]}
                  >
                    {initial}
                  </Text>
                </View>
                <View style={styles.noteContent}>
                  <Text style={styles.noteName}>
                    {playerListLabel(player)}
                    {count > 1 ? ` · ${count}` : ''}
                  </Text>
                  <Text style={styles.noteText} numberOfLines={2}>
                    {note.text?.trim() ||
                      (note.tags?.length ? note.tags.join(' · ') : '—')}
                  </Text>
                  {note.tags?.length ? (
                    <View style={styles.chipContainer}>
                      {note.tags.slice(0, 3).map((tag) => (
                        <View key={tag} style={styles.chip}>
                          <Text style={styles.chipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  const renderSeatMenuModal = () => {
    if (!seatMenu) return null;
    const { seat, mode } = seatMenu;
    const title =
      mode === 'empty'
        ? 'Свободное место'
        : seat.displayName?.trim() || `Место ${seat.seat + 1}`;
    const subtitle =
      mode === 'empty' ? 'Кого посадить?' : 'Что сделать с местом?';

    type Action = {
      key: string;
      label: string;
      destructive?: boolean;
      onPress: () => void;
      testID?: string;
    };

    const actions: Action[] =
      mode === 'empty'
        ? [
            {
              key: 'new',
              label: 'Новый игрок',
              testID: 'seat-menu-new-player',
              onPress: () => {
                setSelectedSeatForNewPlayer(seat);
                setIsNewPlayerSheetOpen(true);
              },
            },
            {
              key: 'anon',
              label: 'Без имени',
              testID: 'seat-menu-nameless',
              onPress: () => seatAnonymousPlayer(seat),
            },
            {
              key: 'list',
              label: 'Из списка',
              testID: 'seat-menu-from-list',
              onPress: () => setPickPlayerForSeat(seat),
            },
          ]
        : [
            {
              key: 'rename',
              label: 'Переименовать',
              testID: 'seat-menu-rename',
              onPress: () => setSeatForRename(seat),
            },
            {
              key: 'tag',
              label: 'Цветовая метка',
              testID: 'seat-menu-color-tag',
              onPress: () => {
                setSelectedSeat(seat);
                setSelectedPlayerForTag(seat);
                setIsTagModalOpen(true);
              },
            },
            {
              key: 'replace-new',
              label: 'Заменить — новый',
              testID: 'seat-menu-replace-new',
              onPress: () => {
                setSelectedSeatForNewPlayer(seat);
                setIsNewPlayerSheetOpen(true);
              },
            },
            {
              key: 'replace-list',
              label: 'Заменить — из списка',
              testID: 'seat-menu-replace-list',
              onPress: () => setPickPlayerForSeat(seat),
            },
            {
              key: 'clear',
              label: 'Освободить место',
              destructive: true,
              testID: 'seat-menu-clear',
              onPress: () => clearSeat(seat),
            },
            {
              key: 'hide',
              label: 'Скрыть игрока',
              destructive: true,
              testID: 'seat-menu-hide-player',
              onPress: () => confirmHidePlayer(seat),
            },
          ];

    const close = () => setSeatMenu(null);

    return (
      <Modal
        visible
        animationType="slide"
        transparent
        onRequestClose={close}
        testID="seat-menu-modal"
        statusBarTranslucent
      >
        <View style={styles.pickOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={close}
            accessibilityLabel="seat-menu-backdrop"
          />
          <View style={[styles.pickSheet, { paddingBottom: pickSheetPadBottom }]}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.noteText}>
              {subtitle} · место {seat.seat + 1}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  testID={action.testID}
                  accessibilityLabel={action.testID}
                  style={styles.pickRow}
                  onPress={() => {
                    close();
                    action.onPress();
                  }}
                >
                  <Text
                    style={[
                      styles.noteName,
                      action.destructive && { color: '#f87171' },
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              testID="seat-menu-cancel"
              accessibilityLabel="seat-menu-cancel"
              style={[styles.button, styles.buttonSecondary, { marginTop: 12 }]}
              onPress={close}
            >
              <Text style={styles.buttonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };


  const renderPickPlayerModal = () => {
    if (!pickPlayerForSeat) return null;
    const seatedIds = new Set(
      (table?.seats || [])
        .filter((s) => s.playerId && s.playerId !== 'empty' && s.playerId !== 'hero')
        .map((s) => s.playerId)
    );
    const options = uniqueNamedPlayers().sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ru')
    );

    return (
      <Modal
        visible
        animationType="slide"
        transparent
        onRequestClose={() => setPickPlayerForSeat(null)}
      >
        <View style={styles.pickOverlay}>
          <View style={[styles.pickSheet, { paddingBottom: pickSheetPadBottom }]}>
            <Text style={styles.cardTitle}>Кого посадить?</Text>
            <Text style={styles.noteText}>
              Место {pickPlayerForSeat.seat + 1}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {options.length === 0 ? (
                <Text style={styles.noteText}>Список пуст — создайте игрока</Text>
              ) : (
                options.map((player) => {
                  const seated = seatedIds.has(player.id);
                  return (
                    <TouchableOpacity
                      key={player.id}
                      style={[styles.pickRow, seated && styles.pickRowSeated]}
                      onPress={() =>
                        seatExistingPlayer(pickPlayerForSeat, player)
                      }
                    >
                      <Text style={styles.noteName}>{playerListLabel(player)}</Text>
                      <Text style={styles.noteText}>
                        {tableStore.getNoteCount(player.id)} зам.
                        {seated ? ' · уже за столом' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { marginTop: 12 }]}
              onPress={() => setPickPlayerForSeat(null)}
            >
              <Text style={styles.buttonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderPokerTable()}
        {renderQuickActions()}
        {renderRecentNotes()}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          // Показать быстрые действия
        }}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Tag Modal */}
      <TagModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        onTagSelect={handleTagSelect}
        playerName={selectedPlayerForTag?.displayName || ''}
      />

      <PlayerTagsSettingsSheet
        isOpen={tagsSettingsOpen}
        onClose={() => setTagsSettingsOpen(false)}
      />

      {/* Quick Note Modal */}
      <QuickNote
        isOpen={isQuickNoteOpen}
        onClose={handleCloseQuickNote}
        playerName={selectedPlayerForNote?.displayName}
        seatNumber={selectedPlayerForNote?.seat}
        tableId={table?.id || 'demo'}
        playerId={selectedPlayerForNote?.playerId || ''}
        onCreateNewPlayer={handleCreateNewPlayerFromQuickNote}
      />

      {/* New Player Sheet */}
      <NewPlayerSheet
        isOpen={isNewPlayerSheetOpen}
        onClose={handleCloseNewPlayerSheet}
        onCreatePlayer={handleCreatePlayer}
        seatNumber={
          selectedSeatForNewPlayer != null
            ? selectedSeatForNewPlayer.seat + 1
            : undefined
        }
      />

      <RenamePlayerSheet
        isOpen={seatForRename != null}
        onClose={() => setSeatForRename(null)}
        onSave={(name) => {
          void handleRenamePlayer(name);
        }}
        initialName={seatForRename?.displayName?.trim() || ''}
        seatNumber={
          seatForRename != null ? seatForRename.seat + 1 : undefined
        }
      />

      {renderSeatMenuModal()}
      {renderPickPlayerModal()}

      {hideUndo ? (
        <View
          testID="hide-player-undo-banner"
          accessibilityLabel="hide-player-undo-banner"
          style={[
            styles.hideUndoBanner,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Text style={styles.hideUndoText} numberOfLines={1}>
            Скрыт: {hideUndo.label}
          </Text>
          <TouchableOpacity
            testID="hide-player-undo"
            accessibilityLabel="hide-player-undo"
            onPress={handleUndoHide}
            style={styles.hideUndoBtn}
          >
            <Text style={styles.hideUndoBtnText}>Отменить</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

// Функция расчета позиции игрока вокруг эллиптического стола
function getPlayerSeatPosition(
  seatIndex: number,
  maxSeats: number,
  tableWidth: number,
  seatSize: number
) {
  const tableHeight = tableWidth * 0.6;
  const centerX = tableWidth / 2;
  const centerY = tableHeight / 2;
  const halfSeat = seatSize / 2;

  let radiusX = tableWidth * 0.3;
  let radiusY = tableWidth * 0.2;
  const seatOffset = tableWidth * 0.11;

  if (maxSeats <= 6) {
    radiusX = tableWidth * 0.25;
    radiusY = tableWidth * 0.18;
  } else if (maxSeats >= 8) {
    radiusX = tableWidth * 0.31;
    radiusY = tableWidth * 0.21;
  }

  const angle = (seatIndex * 2 * Math.PI) / maxSeats - Math.PI / 2;
  const x = centerX + (radiusX + seatOffset) * Math.cos(angle);
  const y = centerY + (radiusY + seatOffset) * Math.sin(angle);

  return {
    position: 'absolute' as const,
    left: x - halfSeat,
    top: y - halfSeat,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MD3_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
    gap: 8,
  },
  tableHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: MD3_COLORS.onSurface,
    flex: 1,
  },
  tableHeaderStakes: {
    fontSize: 16,
    fontWeight: '600',
    color: MD3_COLORS.primary,
  },
  card: {
    backgroundColor: MD3_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: MD3_COLORS.onSurface,
    marginBottom: 12,
  },
  tableContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 8,
  },
  pokerTable: {
    alignSelf: 'center',
    marginVertical: 16,
    position: 'relative',
    backgroundColor: '#0f4c3a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'visible',
  },
  tableBorder: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 4,
    borderColor: '#FFD700',
  },
  playerSeat: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    backgroundColor: '#6b7280',
  },
  heroSeat: {
    backgroundColor: '#fbbf24',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  emptySeat: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  emptySeatText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#e2e8f0',
    lineHeight: 22,
  },
  seatNumber: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 1,
  },
  playerName: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  noteBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableHint: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: MD3_COLORS.onSurfaceVariant,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: MD3_COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: MD3_COLORS.secondaryContainer,
  },
  buttonTertiary: {
    backgroundColor: MD3_COLORS.tertiaryContainer,
  },
  buttonDanger: {
    backgroundColor: '#B3261E',
  },
  buttonActive: {
    borderWidth: 2,
    borderColor: MD3_COLORS.primary,
    shadowColor: MD3_COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  noteItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteContent: {
    flex: 1,
  },
  noteName: {
    fontSize: 14,
    fontWeight: '500',
    color: MD3_COLORS.onSurface,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: MD3_COLORS.onSurfaceVariant,
    marginBottom: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  chip: {
    backgroundColor: MD3_COLORS.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: MD3_COLORS.onSecondaryContainer,
  },
  noteTime: {
    fontSize: 12,
    color: MD3_COLORS.onSurfaceVariant,
  },
  pickOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickSheet: {
    backgroundColor: MD3_COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  pickRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MD3_COLORS.outlineVariant,
  },
  pickRowSeated: {
    opacity: 0.55,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: MD3_COLORS.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 24,
    color: MD3_COLORS.onPrimaryContainer,
    fontWeight: '300',
  },
  hideUndoBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
    elevation: 8,
  },
  hideUndoText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
  },
  hideUndoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  hideUndoBtnText: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 14,
  },
});
