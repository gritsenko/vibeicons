# VibeIcons

Менеджер иконок-PWA: импорт JSON-библиотек SVG-иконок, поиск, фильтрация, превью на тёмном/светлом фоне в разных размерах, перекраска, копирование SVG-кода и скачивание SVG/PNG.

Собран на **Vite 7 + React 19 + TypeScript**. Хранит иконки в IndexedDB, настройки и метаданные — в localStorage.

Деплой: <https://gritsenko.biz/vibeicons/> (Vite собран с `base: "/vibeicons/"`).

## Установка и запуск

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build → dist/
npm run preview      # локальный preview прод-сборки
npm run typecheck    # tsc -b --noEmit
```

Требуется Node 20.19+ или 22.12+ (требование Vite 7).

## Возможности

- **Импорт JSON** — drag&drop в зону сайдбара или кнопкой `Import JSON`. Каждый импорт становится отдельным верхнеуровневым разделом библиотеки (имя берётся из имени файла без расширения). ID `sets` и `groups` неймспейсятся источником, чтобы разные библиотеки не перетирали друг друга.
- **Иерархия Library** — `groups` → вложенные `groups` → `sets`, со счётчиками и сворачиванием. По умолчанию все ветки свёрнуты.
- **Sources** — список импортированных файлов в сайдбаре, по клику фильтрует иконки только из этого источника.
- **Поиск** — по имени, тегам и названию библиотеки. Фокус по `/`.
- **Фильтры** — по `style`, по `set_id`, по `source`, плюс быстрые чипы в тулбаре.
- **Variations** — иконки с одинаковыми именами из разных библиотек хранятся отдельно и показываются переключателем в детальной панели.
- **Превью** — карточки dark/light с шахматной сеткой (визуализация прозрачности) + ряд размеров 16/24/32/48/64.
- **Перекраска** — 8 пресетов + native color picker + hex input. Меняет `fill` в SVG, не трогая `fill="none"`.
- **Скачивание/копирование** — SVG-код с подсветкой, кнопки SVG/PNG (PNG рендерится через canvas, 256px).
- **Избранное** (двойной клик по иконке или `f`) и **Recents** (автоматически по выбору).
- **Settings-модалка** — статистика библиотеки, список источников, «Clear all data» с подтверждением.
- **Темы** — светлая по умолчанию, тёмная по кнопке. Акцент `#F97316`. Плотность сетки S/M/L.
- **Хоткеи** — `/` фокус поиска, `←/→` навигация по сетке, `f` toggle favorite.

## Формат импортируемого JSON

Поддерживаются два варианта корня:

```jsonc
// 1) массив иконок
[
  { "name": "...", "content": "<svg>…</svg>", "style": "glyph",
    "width": 48, "height": 48, "set_id": 82, "tags": "tag1,tag2" }
]

// 2) объект с массивом icons + метаданными
{
  "icons":  [ /* как выше */ ],
  "sets":   [{ "id": 1, "label": "Big Movement Line Arrow", "group_id": 2 }],
  "groups": [{ "id": 1, "label": "Core Line" },
             { "id": 2, "label": "Arrows", "group_id": 1 }]
}
```

`tags` может быть строкой через запятую или массивом — приводится к строке. Дубликаты по имени пропускаются в пределах одного импорта.

## Структура проекта

```
src/
├── main.tsx                # createRoot bootstrap
├── App.tsx                 # Корневой компонент: state, IDB+localStorage, импорт, фильтры
├── styles.css              # Все стили
├── seed.ts                 # Стартовые иконки
├── types.ts                # IconRecord, SetMeta, GroupMeta, Tweaks, …
├── lib/
│   ├── storage.ts          # openDb / load / save / clear
│   └── svg.ts              # highlightSvg, colorizeContent, downloadSVG/PNG
└── components/
    ├── Icon.tsx            # Inline UI-иконки (chrome)
    ├── RenderedIcon.tsx    # Императивный инжект SVG + перекраска через currentColor
    ├── HierarchyTree.tsx   # Дерево groups → sets в сайдбаре
    ├── DetailPanel.tsx     # Правая панель деталей
    └── SettingsModal.tsx   # Модалка настроек / сброса
```

## Хранение данных

| Данные                            | Хранилище                              | Ключ                           |
| --------------------------------- | -------------------------------------- | ------------------------------ |
| Иконки                            | IndexedDB `vibeicons` / store `kv`     | `icons`                        |
| Метаданные `sets` / `groups`      | localStorage                           | `vibeicons.v1.setsMeta` / `.groupsMeta` |
| Источники                         | localStorage                           | `vibeicons.v1.sources`         |
| Избранное / недавние              | localStorage                           | `vibeicons.v1.favs` / `.recents` |
| Настройки UI (theme/density/…)    | localStorage                           | `vibeicons.v1.tweaks`          |

IndexedDB используется для иконок специально — в localStorage обычно ~5 МБ квоты, что мало для крупных библиотек. Если IDB недоступен, идёт fallback в localStorage с поглощением quota-ошибок.

## PWA / SEO

- `public/manifest.webmanifest` — standalone PWA, theme `#F97316`, scope `/vibeicons/`.
- `public/favicon.svg` — векторный favicon (V-mark на оранжевом градиенте).
- `public/cover.jpg` — обложка для OG / Twitter Card (1024×541).
- В `index.html` прописаны `og:*` и `twitter:*` теги с абсолютными URL `https://gritsenko.biz/vibeicons/...`, чтобы превью корректно подхватывалось в Telegram, Twitter/X и Facebook.

## Происхождение

Дизайн собран в [Claude Design](https://claude.ai/design) (см. чаты в `.design-bundle/vibeicons/chats/`). Этот репозиторий — портация прототипа на production-стек: Vite + React + TypeScript, без UMD-React и Babel-Standalone из исходного HTML-прототипа.
