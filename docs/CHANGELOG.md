# Changelog

## [Unreleased]

### Изменено
- **Синхронизация с upstream v2.1.0** (версия форка `2.1.0-fork.1`). Из upstream пришли: модуль
  `notifications`, loading sound (`loadingSound` в опциях инициализации), анонимные облачные
  сохранения Playgama, события daily rewards / tasks / cross-promo на глобальной шине, типы
  `LeaderboardEntry` / `CatalogProduct` / `Purchase` в npm-пакете, правки Samsung и MSN; платформа
  PlayDeck удалена upstream. Все форк-фичи (VK/OK через VK Bridge, cookie-splash загрузчик,
  Android, GameMonetize, интервал interstitial 80 с, конфиг-фолбэки) сохранены.
- **Загрузчик:** cookie-splash получил `setHideGate()` — при включённом loading sound экран держится
  на 100 % до конца звука (не дольше 3 с), как и стоковый загрузчик upstream.
- **npm-пакет:** сборка ESM/UMD/constants и d.ts теперь целиком upstream-овая; `src/constantsEntry.ts`
  удалён. Upstream-воркфлоу `release.yml` не используется — `npm-release.yml` кладёт в релиз и
  тарбол, и `dist/playgama-bridge.js`.

### Добавлено
- **Android Platform:** Новая платформа `android` для сборки APK-файлов HTML5-игр через Capacitor.
  - Автоматическое определение среды Capacitor (`window.Capacitor.isNativePlatform()`)
  - Интеграция с Yandex Mobile Ads через отдельный Capacitor-плагин `capacitor-plugin-yandex-mobile-ads`
  - Поддержка interstitial, rewarded и banner рекламы
  - Ad Unit ID настраиваются через `playgama-bridge-config.json`
- **capacitor-plugin-yandex-mobile-ads:** Новый Capacitor-плагин (Kotlin) для нативной рекламы Яндекса на Android.

## [1.30.0] - 2026-04-16

### Изменено
- **VK Platform:** Интегрирован API `choclategames.ru` в метод `paymentsGetCatalog()`. Теперь магазин в ВК автоматически запрашивает динамический список товаров для конкретной игры по `vk_app_id` / `api_id`, вместо использования статического конфига. При покупке идентификатор товара передается корректно.
- **Сборка:** Обновлены бандлы (папка `dist/`), так что в консоли при инициализации вновь отображается актуальная версия SDK (1.30.0, а не 1.29).
