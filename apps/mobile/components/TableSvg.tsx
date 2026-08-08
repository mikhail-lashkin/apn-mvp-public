/**
 * @file: TableSvg.tsx
 * @description: React Native SVG компонент покерного стола с адаптивной отрисовкой
 * @dependencies: react-native-svg, types
 * @created: 2025-01-28
 */

import React from 'react';
import { View, Dimensions, TouchableOpacity, Text } from 'react-native';
import Svg, { Ellipse, Circle, Text as SvgText, G } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Seat {
  seat: number;
  playerId: string;
  displayName: string;
  tag?: string;
  color?: string;
  isActive: boolean;
  noteCount?: number;
}

interface TableSvgProps {
  seats: Seat[];
  maxSeats: number;
  heroPosition?: number;
  onSeatClick: (seat: number) => void;
  onSeatLongPress: (seat: number) => void;
}

// Цвета меток: Colors_to_PlayerTypes (+ legacy aliases)
const TAG_COLORS: Record<string, string> = {
  whale: '#A855F7',
  fish: '#EF4444',
  passive_fish: '#38BDF8',
  aggro_fish: '#F97316',
  vip_aggressive: '#EC4899',
  tight_reg: '#15803D',
  standard_reg: '#22C55E',
  unknown_ss: '#EAB308',
  // legacy / UI
  nit: '#15803D',
  aggro_reg: '#22C55E',
  TAG: '#15803D',
  LAG: '#22C55E',
  NIT: '#15803D',
  MANIAC: '#F97316',
  FISH: '#EF4444',
  REG: '#22C55E',
  UNKNOWN: '#6B7280',
  unknown: '#6B7280',
  empty: '#9CA3AF',
  EMPTY: '#E5E7EB',
  RECENT: '#EC4899',
  FAVORITE: '#F59E0B',
};

// Вычисление позиций игроков вокруг эллипса с адаптивным радиусом
const calculateSeatPosition = (seatIndex: number, totalSeats: number, centerX: number, centerY: number, radiusX: number, radiusY: number) => {
  const angle = (2 * Math.PI * seatIndex) / totalSeats - Math.PI / 2; // Начинаем сверху
  const x = centerX + radiusX * Math.cos(angle);
  const y = centerY + radiusY * Math.sin(angle);
  return { x, y, angle };
};

// Адаптивные размеры стола в зависимости от количества мест
const getTableDimensions = (maxSeats: number, screenWidth: number) => {
  const baseRadiusX = screenWidth * 0.3;
  const baseRadiusY = screenWidth * 0.2;
  const seatRadius = screenWidth * 0.05;
  
  // Адаптируем размеры стола под количество мест
  let radiusX = baseRadiusX;
  let radiusY = baseRadiusY;
  let seatOffset = screenWidth * 0.08; // Расстояние от края стола до центра круга игрока
  
  if (maxSeats <= 6) {
    // Для 6-max делаем стол компактнее
    radiusX = screenWidth * 0.25;
    radiusY = screenWidth * 0.18;
    seatOffset = screenWidth * 0.06;
  } else if (maxSeats >= 10) {
    // Для 10-max делаем стол больше
    radiusX = screenWidth * 0.35;
    radiusY = screenWidth * 0.23;
    seatOffset = screenWidth * 0.09;
  }
  
  return { radiusX, radiusY, seatOffset, seatRadius };
};

export const TableSvg: React.FC<TableSvgProps> = ({ 
  seats, 
  maxSeats, 
  heroPosition,
  onSeatClick,
  onSeatLongPress 
}) => {
  const tableWidth = screenWidth - 40;
  const tableHeight = tableWidth * 0.6;
  const centerX = tableWidth / 2;
  const centerY = tableHeight / 2;
  
  // Получаем адаптивные размеры стола
  const { radiusX, radiusY, seatOffset, seatRadius } = getTableDimensions(maxSeats, tableWidth);

  // Создаем массив всех позиций (занятых и пустых)
  const allSeats = Array.from({ length: maxSeats }, (_, index) => {
    const seat = seats.find(s => s.seat === index);
    return seat || { seat: index, playerId: '', displayName: '', isActive: false };
  });

  return (
    <View style={{ width: tableWidth, height: tableHeight, backgroundColor: '#0F5132', borderRadius: tableWidth * 0.3, overflow: 'hidden' }}>
      <Svg
        width={tableWidth}
        height={tableHeight}
        viewBox={`0 0 ${tableWidth} ${tableHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Стол - эллипс */}
        <Ellipse
          cx={centerX}
          cy={centerY}
          rx={radiusX}
          ry={radiusY}
          fill="#0F5132"
          stroke="#16A34A"
          strokeWidth="2"
        />
        
        {/* Центральная область стола */}
        <Ellipse
          cx={centerX}
          cy={centerY}
          rx={radiusX - 20}
          ry={radiusY - 15}
          fill="none"
          stroke="#16A34A"
          strokeWidth="1"
          strokeDasharray="5,5"
        />

        {/* Игроки вокруг стола */}
        {allSeats.map((seat, index) => {
          const { x, y, angle } = calculateSeatPosition(index, maxSeats, centerX, centerY, radiusX + seatOffset, radiusY + seatOffset);
          const isHero = heroPosition === index;
          const hasPlayer = seat.playerId && seat.isActive;
          const tagColor = seat.tag ? TAG_COLORS[seat.tag] : TAG_COLORS.EMPTY;
          
          return (
            <G key={index}>
              {/* Круг игрока */}
              <Circle
                cx={x}
                cy={y}
                r={seatRadius}
                fill={hasPlayer ? tagColor : '#E5E7EB'}
                stroke={isHero ? '#F59E0B' : '#6B7280'}
                strokeWidth={isHero ? 3 : 2}
              />
              
              {/* Имя игрока */}
              {hasPlayer && (
                <SvgText
                  x={x}
                  y={y + 35}
                  textAnchor="middle"
                  fontSize="12"
                  fill="white"
                  fontWeight="500"
                >
                  {seat.displayName.length > 8 
                    ? `${seat.displayName.substring(0, 8)}...` 
                    : seat.displayName
                  }
                </SvgText>
              )}
              
              {/* Индикатор героя */}
              {isHero && (
                <SvgText
                  x={x}
                  y={y - 25}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#F59E0B"
                  fontWeight="bold"
                >
                  HERO
                </SvgText>
              )}
              
              {/* Номер позиции */}
              <SvgText
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize="12"
                fill="white"
                fontWeight="bold"
              >
                {index + 1}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Touchable области для каждого игрока */}
      {allSeats.map((seat, index) => {
        const { x, y } = calculateSeatPosition(index, maxSeats, centerX, centerY, radiusX + seatOffset, radiusY + seatOffset);
        
        return (
          <TouchableOpacity
            key={`touch-${index}`}
            style={{
              position: 'absolute',
              left: x - seatRadius,
              top: y - seatRadius,
              width: seatRadius * 2,
              height: seatRadius * 2,
              borderRadius: seatRadius,
            }}
            onPress={() => onSeatClick(index)}
            onLongPress={() => onSeatLongPress(index)}
            delayLongPress={300}
          />
        );
      })}
    </View>
  );
};
