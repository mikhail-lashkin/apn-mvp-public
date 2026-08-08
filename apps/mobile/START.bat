@echo off
title AI Poker Notes - Mobile (Fixed Positioning)
cd /d "%~dp0\..\.."
cls

echo =============================================
echo   AI POKER NOTES - MOBILE (FIXED POSITIONING)
echo =============================================
echo.
echo Исправления:
echo   [FIX] Увеличено расстояние от края стола
echo   [FIX] Игроки не наплывают на камеру
echo   [FIX] Равномерное расположение как у Сергея и Hero
echo.
echo Запуск Expo в tunnel режиме...
echo =============================================
echo.

npm run dev:mobile

pause
