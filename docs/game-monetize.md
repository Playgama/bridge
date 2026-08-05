# GameMonetize

Документация по интеграции платформы [GameMonetize.com](https://gamemonetize.com).

## Описание

GameMonetize — платформа для монетизации HTML5-игр через рекламу. SDK загружается динамически с `https://api.gamemonetize.com/sdk.js` и предоставляет единственный вид рекламы — **interstitial** (вызывается через `sdk.showBanner()`).

Поддерживаемые функции:

| Функция          | Поддержка |
|------------------|-----------|
| Interstitial     | ✅        |
| Rewarded         | ✅ (симуляция) |
| Banner           | ❌        |
| Авторизация      | ❌        |
| Лидерборды       | ❌        |
| Платежи          | ❌        |
| Хранилище        | `local_storage` |

---

## Конфигурация

В файле `playgama-bridge-config.json` необходимо указать `gameId` — хэш игры из панели управления GameMonetize.com.

```json
{
  "platforms": {
    "game_monetize": {
      "gameId": "your_game_id_here"
    }
  }
}
```

> **gameId** — берётся из раздела *Game Management → My Games* на сайте [gamemonetize.com](https://gamemonetize.com).

---

## Определение платформы

Платформа определяется автоматически при инициализации. SDK проверяет hostname страницы на совпадение с любым из официальных доменов GameMonetize:

```js
url.hostname.includes('gamemonetize.com')  // основной домен
url.hostname.includes('gamemonetize.co')   // альт. домен + cdn поддомены
url.hostname.includes('distributegames.com') // партнёрская сеть
```

Покрываемые хосты: `gamemonetize.com`, `gamemonetize.co`, `html5.gamemonetize.co`, `uncached.gamemonetize.com/co`, `distributegames.com`.

При успешном определении в консоли появится сообщение:
```
[Bridge] Platform detected: game_monetize
```

Платформу также можно указать принудительно через URL-параметр или конфиг:

```
https://example.com/game/?platform_id=game_monetize
```

```json
{
  "forciblySetPlatformId": "game_monetize"
}
```

---

## Инициализация SDK

При вызове `bridge.initialize()` бридж:

1. Устанавливает `window.SDK_OPTIONS` с указанным `gameId` и обработчиком событий.
2. Динамически добавляет скрипт `https://api.gamemonetize.com/sdk.js`.
3. Ожидает событие `SDK_READY` — после него инициализация считается завершённой, `window.sdk` сохраняется как `_platformSdk`.

### Обрабатываемые события SDK

| Событие                | Действие в бридже                              |
|------------------------|------------------------------------------------|
| `SDK_READY`            | Инициализация завершена, промис резолвится     |
| `AD_SDK_MANAGER_READY` | Через 500 мс показывается стартовый interstitial |
| `SDK_GAME_PAUSE`| `interstitialState` → `opened` (пауза игры)   |
| `SDK_GAME_START`| `interstitialState` → `closed` (реклама скрыта)|
| `COMPLETE`      | Реклама досмотрена — награда за rewarded разрешена |

> Все события GameMonetize приходят в колбэк `SDK_OPTIONS.onEvent`, а **не** как события `window`.

### Стартовая реклама

Реклама показывается автоматически при первой загрузке игры: после `AD_SDK_MANAGER_READY` с задержкой 500 мс. Если менеджер рекламы так и не сообщил о готовности (адблок, медленная сеть), показ всё равно запрашивается через 5 секунд после `SDK_READY`. Показ выполняется ровно один раз.

---

## Показ рекламы

Interstitial вызывается стандартным методом бриджа:

```js
bridge.advertisement.showInterstitial()
```

Внутри бридж вызывает `sdk.showBanner()` — именно так называется метод показа рекламы в GameMonetize SDK.

### Пример с отслеживанием состояния

```js
bridge.advertisement.on(
    bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
    (state) => {
        switch (state) {
            case bridge.INTERSTITIAL_STATE.OPENED:
                // Реклама показалась — поставить игру на паузу, выключить звук
                myGame.pause()
                break
            case bridge.INTERSTITIAL_STATE.CLOSED:
            case bridge.INTERSTITIAL_STATE.FAILED:
                // Реклама закрылась — продолжить игру
                myGame.resume()
                break
        }
    }
)

bridge.advertisement.showInterstitial()
```

---

## Rewarded (симуляция)

GameMonetize не имеет отдельного rewarded-формата. Бридж симулирует его через тот же `sdk.showBanner()`, отслеживая тип текущей рекламы через внутренний флаг.

**Поведение:** когда реклама закрывается (`SDK_GAME_START`), бридж автоматически отправляет `REWARDED → CLOSED` вместо `CLOSED`.

> ⚠️ **Ограничение:** пользователь получит награду при любом закрытии рекламы — нет способа определить, досмотрел ли он её до конца.

```js
bridge.advertisement.on(
    bridge.EVENT_NAME.REWARDED_STATE_CHANGED,
    (state) => {
        switch (state) {
            case bridge.REWARDED_STATE.OPENED:
                myGame.pause()
                break
            case bridge.REWARDED_STATE.REWARDED:
                myGame.giveReward() // выдать награду
                break
            case bridge.REWARDED_STATE.CLOSED:
            case bridge.REWARDED_STATE.FAILED:
                myGame.resume()
                break
        }
    }
)

bridge.advertisement.showRewarded()
```

---

## Особенности и ограничения

1. **Rewarded — симуляция** — используется тот же `sdk.showBanner()`, награда выдаётся при любом закрытии рекламы без проверки полного просмотра.
2. **Banner не поддерживается** — вызов `showBanner()` вернёт ошибку через стандартный механизм бриджа.
3. **gameId обязателен** — если `gameId` не указан в конфиге, инициализация завершится ошибкой `GAME_PARAMS_NOT_FOUND`.
4. **Минимальная задержка отключена** — `isMinimumDelayBetweenInterstitialEnabled = false`, платформа управляет частотой показа рекламы самостоятельно.
5. **Хранилище** — используется `localStorage`, платформенного хранилища нет.

---

## Ссылки

- [Репозиторий GameMonetize SDK](https://github.com/MonetizeGame/GameMonetize.com-SDK)
- [Документация на сайте](https://gamemonetize.com/sdk)
- Исходный файл бриджа: `src/platform-bridges/GameMonetizePlatformBridge.js`
