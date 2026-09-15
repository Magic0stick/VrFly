# 🚀 Быстрый старт в VS Code

## Установка

1. Откройте проект в VS Code
2. Нажмите `Ctrl+Shift+P` (или `Cmd+Shift+P` на Mac)
3. Введите `Tasks: Run Task`
4. Выберите `install` для установки зависимостей

## Запуск проекта

### Вариант 1: Через терминал
```bash
npm install
npm run dev
```

### Вариант 2: Через VS Code задачи
1. Нажмите `Ctrl+Shift+P`
2. Введите `Tasks: Run Task`
3. Выберите `dev`

### Вариант 3: Через отладку
1. Нажмите `F5`
2. Выберите `🚀 Dev Server (Vite)`

## Доступные задачи

- **dev** - Запуск dev-сервера (по умолчанию)
- **build** - Сборка для продакшена
- **preview** - Предпросмотр продакшен-сборки
- **typecheck** - Проверка TypeScript
- **install** - Установка зависимостей
- **dev:https** - Dev-сервер с HTTPS (для WebXR)
- **dev:host** - Dev-сервер с сетевым доступом (для Quest)
- **start:steamvr** - Запуск с поддержкой SteamVR
- **start:quest** - Запуск с оптимизацией для Quest
- **clean** - Очистка build-артефактов
- **deploy** - Сборка и подготовка к деплою

## Конфигурации отладки

Нажмите `F5` или перейдите в панель отладки (`Ctrl+Shift+D`):

- **🚀 Dev Server (Vite)** - Просто dev-сервер
- **🌐 Chrome (Desktop Mode)** - Отладка в Chrome
- **🥽 Chrome + SteamVR Debug** - Отладка с WebXR
- **🎮 SteamVR Browser Debug** - Подключение к SteamVR Browser
- **🥽 Oculus Quest Debug** - Отладка для Quest
- **🔥 Dev + Chrome Debug** - Dev-сервер + Chrome автоматически

## Для VR разработки

### SteamVR
```bash
npm run start:steamvr
```
или через задачу `start:steamvr`

### Meta Quest
```bash
npm run start:quest
```
или через задачу `start:quest`

## Горячие клавиши

- `F5` - Запуск отладки
- `Ctrl+Shift+B` - Запуск задачи сборки
- `Ctrl+Shift+D` - Панель отладки
- `Ctrl+` ` - Терминал
- `Ctrl+Shift+P` - Командная палитра

## Решение проблем

### Задача не найдена
1. Убедитесь, что открыли папку проекта в VS Code
2. Перезагрузите окно: `Ctrl+Shift+P` → `Developer: Reload Window`
3. Проверьте, что файлы `.vscode/tasks.json` и `.vscode/launch.json` существуют

### npm не найден
1. Установите Node.js: https://nodejs.org/
2. Перезапустите VS Code
3. Проверьте в терминале: `npm --version`

### Порт 5173 занят
```bash
npm run dev -- --port 3000
```

### WebXR не работает
- Используйте HTTPS: `npm run dev:https`
- Или используйте `npm run dev:host` для доступа с Quest
