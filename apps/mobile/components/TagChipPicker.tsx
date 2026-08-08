/**
 * @file: TagChipPicker.tsx
 * @description: Выбор тегов — flat picker (игрок) или grouped toggle (заметка SC-3)
 * @created: 2026-07-14
 * @updated: 2026-07-15
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

export type TagOption = { label: string; value: string; color?: string };

export type TagGroup = {
  id: string;
  title: string;
  options: readonly TagOption[];
};

type TagChipPickerProps = {
  options?: readonly TagOption[];
  /** Если заданы — inline multi-select с группами (1 тап = toggle). */
  groups?: readonly TagGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  title?: string;
  addLabel?: string;
  /** Префикс testID: player-tag-* (default) | note-tag-* */
  testIdPrefix?: string;
  /** SC-6: метка игрока — ровно одна (или ни одной). Inline цветные чипы. */
  singleSelect?: boolean;
};

function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[+/]/g, (ch) => (ch === '+' ? 'plus' : 'eq'));
}

function tagOptionTestId(prefix: string, value: string): string {
  return `${prefix}-${slugifyTag(value)}`;
}

export function TagChipPicker({
  options,
  groups,
  selected,
  onChange,
  title = 'Теги',
  addLabel = '+ Тег',
  testIdPrefix = 'player-tag',
  singleSelect = false,
}: TagChipPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const flatFromGroups = useMemo(
    () => (groups ? groups.flatMap((g) => [...g.options]) : []),
    [groups]
  );

  const flatOptions = useMemo(() => {
    if (groups) return flatFromGroups;
    return options ? [...options] : [];
  }, [groups, options, flatFromGroups]);

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    flatOptions.forEach((o) => map.set(o.value, o.label));
    return map;
  }, [flatOptions]);

  const knownValues = useMemo(
    () => new Set(flatOptions.map((o) => o.value)),
    [flatOptions]
  );

  const extraSelected = useMemo(
    () => selected.filter((v) => !knownValues.has(v)),
    [selected, knownValues]
  );

  const available = useMemo(
    () => flatOptions.filter((o) => !selected.includes(o.value)),
    [flatOptions, selected]
  );

  const toggleTag = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (singleSelect) {
      onChange(selected.includes(value) ? [] : [value]);
      return;
    }
    if (selected.includes(value)) {
      onChange(selected.filter((t) => t !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const removeTag = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(selected.filter((t) => t !== value));
  };

  const addTag = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (singleSelect) {
      onChange([value]);
    } else if (!selected.includes(value)) {
      onChange([...selected, value]);
    }
    setPickerOpen(false);
  };

  // --- Single-select inline (метка игрока SC-6) ---
  if (singleSelect && options && options.length > 0 && !groups) {
    return (
      <View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.row}>
          {options.map((opt) => {
            const isOn = selected.includes(opt.value);
            const tid = tagOptionTestId(testIdPrefix, opt.value);
            const accent = opt.color ?? '#3b82f6';
            return (
              <TouchableOpacity
                key={opt.value}
                testID={tid}
                accessibilityLabel={tid}
                accessibilityState={{ selected: isOn }}
                style={[
                  styles.toggleChip,
                  isOn && {
                    borderColor: accent,
                    backgroundColor: accent,
                  },
                ]}
                onPress={() => toggleTag(opt.value)}
              >
                <Text
                  style={[styles.toggleChipText, isOn && styles.toggleChipTextOn]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // --- Grouped toggle (QuickNote) ---
  if (groups && groups.length > 0) {
    return (
      <View>
        <Text style={styles.title}>{title}</Text>
        {groups.map((group) => (
          <View key={group.id} style={styles.groupBlock}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.row}>
              {group.options.map((opt) => {
                const isOn = selected.includes(opt.value);
                const tid = tagOptionTestId(testIdPrefix, opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    testID={tid}
                    accessibilityLabel={tid}
                    accessibilityState={{ selected: isOn }}
                    style={[styles.toggleChip, isOn && styles.toggleChipOn]}
                    onPress={() => toggleTag(opt.value)}
                  >
                    <Text
                      style={[styles.toggleChipText, isOn && styles.toggleChipTextOn]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        {extraSelected.length > 0 ? (
          <View style={styles.groupBlock}>
            <Text style={styles.groupTitle}>Другие</Text>
            <View style={styles.row}>
              {extraSelected.map((value) => (
                <View key={value} style={[styles.toggleChip, styles.toggleChipOn]}>
                  <Text style={[styles.toggleChipText, styles.toggleChipTextOn]}>
                    {labelByValue.get(value) ?? value}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeTag(value)}
                    style={styles.removeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // --- Compact picker (NewPlayerSheet) ---
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        {selected.map((value) => (
          <View key={value} style={styles.chip}>
            <Text style={styles.chipText}>{labelByValue.get(value) ?? value}</Text>
            <TouchableOpacity
              onPress={() => removeTag(value)}
              style={styles.removeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        {available.length > 0 ? (
          <TouchableOpacity
            testID={`${testIdPrefix}-add`}
            accessibilityLabel={`${testIdPrefix}-add`}
            style={styles.addChip}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPickerOpen(true);
            }}
          >
            <Text style={styles.addChipText}>{addLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Выберите тег</Text>
            {available.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                testID={tagOptionTestId(testIdPrefix, opt.value)}
                accessibilityLabel={tagOptionTestId(testIdPrefix, opt.value)}
                style={styles.option}
                onPress={() => addTag(opt.value)}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.cancelOption}
              onPress={() => setPickerOpen(false)}
            >
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  groupBlock: {
    marginBottom: 10,
  },
  groupTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
    backgroundColor: 'transparent',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
  },
  toggleChipOn: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  toggleChipText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  toggleChipTextOn: {
    color: 'white',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  removeBtn: {
    marginLeft: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  addChip: {
    borderWidth: 1,
    borderColor: '#64748b',
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    maxHeight: '50%',
  },
  sheetTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  optionText: {
    color: 'white',
    fontSize: 16,
  },
  cancelOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
});
