# VibeIcons

Менеджер иконок-PWA: импорт JSON-библиотек SVG-иконок, поиск, фильтрация, превью на тёмном/светлом фоне в разных размерах, перекраска, копирование SVG-кода и скачивание SVG/PNG.

Собран на **Vite 7 + React 19 + TypeScript**. Иконки, наборы, группы и источники хранятся в IndexedDB; настройки UI, избранное и recents — в localStorage.

В качестве базовой библиотеки в комплекте поставляется [Ant Design Icons](https://github.com/ant-design/ant-design-icons) (~830 иконок в трёх стилях: `outlined`, `filled`, `twotone`). Загрузка ручная: либо кнопкой на плейсхолдере пустой библиотеки, либо в Settings → Bundled icon library.

Деплой: <https://gritsenko.biz/vibeicons/> (Vite собран с `base: "/vibeicons/"`).

## Установка и запуск

```bash
npm install
npm run dev          # http://localhost:5173 (предварительно генерирует public/libraries/)
npm run build        # tsc -b && vite build → dist/
npm run preview      # локальный preview прод-сборки
npm run typecheck    # tsc -b --noEmit
npm run build:icons  # форсированная регенерация public/libraries/ant-*.json
```

Требуется Node 20.19+ или 22.12+ (требование Vite 7).

## Возможности

- **Импорт JSON** — drag&drop в зону сайдбара или кнопкой `Import JSON`. Каждый импорт становится отдельным верхнеуровневым разделом библиотеки (имя берётся из имени файла без расширения). ID `sets` и `groups` неймспейсятся источником, чтобы разные библиотеки не перетирали друг друга.
- **Базовая библиотека Ant Design** — три источника `Ant Design Outlined` / `Filled` / `TwoTone`, подгружаются по кнопке на плейсхолдере пустой библиотеки или в Settings → Bundled icon library (см. `scripts/build-ant-icons.mjs`).
- **Empty state с CTA** — при отсутствии иконок (свежая БД или после Clear all data) показывается плейсхолдер с кнопками «Load Ant Design Icons» и «Import a JSON file».
- **Иерархия Library** — `groups` → вложенные `groups` → `sets`, со счётчиками и сворачиванием. По умолчанию все ветки свёрнуты.
- **Sources** — список импортированных файлов в сайдбаре, по клику фильтрует иконки только из этого источника.
- **Поиск** — по имени, тегам и названию библиотеки. Фокус по `/`. Поисковый индекс предвычисляется на импорт (`buildSearch`), `useDeferredValue` гасит лаги при наборе.
- **Фильтры** — по `style`, по `set_id`, по `group_id` (с рекурсивным разворачиванием в множество допустимых сетов), по `source`, плюс быстрые чипы тегов в тулбаре.
- **Группировка** — режим Group в тулбаре отображает иконки сгруппированными по сетам (доступен только когда есть активный source/group/set).
- **Variations** — иконки с одинаковыми именами из разных библиотек хранятся отдельно и показываются переключателем в детальной панели.
- **Превью** — карточки dark/light с шахматной сеткой (визуализация прозрачности) + ряд размеров 16/24/32/48/64.
- **Перекраска** — 8 пресетов + native color picker + hex input. Иконки рендерятся через `currentColor`, при экспорте `currentColor` заменяется на выбранный hex.
- **Скачивание/копирование** — SVG-код с подсветкой, кнопки SVG/PNG (PNG рендерится через canvas, 256px).
- **Избранное** (двойной клик по иконке или `f`) и **Recents** (автоматически по выбору, последние 24).
- **Settings-модалка** — статистика библиотеки, список источников, кнопка загрузки базовой библиотеки Ant Design, «Clear all data»: сбрасывает IDB и localStorage в пустое состояние.
- **Темы** — светлая по умолчанию, тёмная по кнопке. Акцент `#F97316`. Плотность сетки S/M/L (compact/comfortable/spacious).
- **Хоткеи** — `/` фокус поиска, `Esc` очистить запрос, `←/→` навигация по сетке, `f` toggle favorite.

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

`tags` может быть строкой через запятую или массивом — приводится к строке. Дубликаты по имени пропускаются в пределах одного импорта. На импорте каждый SVG проходит через `preprocessSvgContent`: убираются `width`/`height`, проставляется `viewBox` и `preserveAspectRatio`, все ненулевые `fill` заменяются на `currentColor`.

## Структура проекта

```
scripts/
└── build-ant-icons.mjs       # Генератор public/libraries/ant-{outlined,filled,twotone}.json
public/
└── libraries/                # Сгенерированные базовые библиотеки (gitignored)
src/
├── main.tsx                  # createRoot bootstrap
├── App.tsx                   # Корневой компонент: state, IDB+localStorage, импорт, фильтры
├── styles.css                # Все стили
├── types.ts                  # IconRecord, SetMeta, GroupMeta, SourceMeta, Tweaks, …
├── lib/
│   ├── db.ts                 # IDB v2: openDb, getAll*, bulkPut*, clearAll, deleteIconsBySource
│   ├── storage.ts            # readJson/writeJson/clearAllStorage для localStorage
│   ├── icons.ts              # iconKey, normalizeImportedIcon, rehydrateLegacyIcon, buildSearch
│   └── svg.ts                # preprocessSvgContent, colorizeContent, downloadSVG/PNG
└── components/
    ├── Icon.tsx              # Inline UI-иконки (chrome)
    ├── RenderedIcon.tsx      # SVG-инжект через dangerouslySetInnerHTML, мемо по key+size+color
    ├── HierarchyTree.tsx     # Дерево groups → sets в сайдбаре
    ├── IconGrid.tsx          # Виртуализированная сетка (ResizeObserver + onScroll)
    ├── GroupedIconGrid.tsx   # Сетка с группировкой по сетам (без виртуализации)
    ├── HomeView.tsx          # Стартовая страница с источниками и стилями
    ├── LibraryEmpty.tsx      # Плейсхолдер пустой библиотеки с CTA на Ant Design
    ├── DetailPanel.tsx       # Правая панель деталей
    └── SettingsModal.tsx     # Модалка настроек / сброса / загрузки Ant Design
```

## Хранение данных

| Данные                            | Хранилище                                   | Ключ / store                  |
| --------------------------------- | ------------------------------------------- | ----------------------------- |
| Иконки                            | IndexedDB `vibeicons` v2 / store `icons`    | keyPath `key` (`"<source>::<name>"`), индексы `set_id`/`source`/`style`/`name` |
| Sets                              | IndexedDB `vibeicons` v2 / store `sets`     | keyPath `id`                  |
| Groups                            | IndexedDB `vibeicons` v2 / store `groups`   | keyPath `id`                  |
| Sources                           | IndexedDB `vibeicons` v2 / store `sources`  | keyPath `name`                |
| Произвольные ключи                | IndexedDB `vibeicons` v2 / store `meta`     | свободный keyPath             |
| Избранное / недавние              | localStorage                                | `vibeicons.v1.favs` / `.recents` |
| Настройки UI (theme/density/…)    | localStorage                                | `vibeicons.v1.tweaks`         |
| `groupBy` toggle                  | localStorage                                | `vibeicons.v1.groupBy`        |

IndexedDB используется для иконок специально — в localStorage обычно ~5 МБ квоты, чего мало даже для одной средней библиотеки. На апгрейде с v1 (где иконки лежали единым массивом в `kv.icons`) данные мигрируются в новую схему.

Импорты пишутся в IDB **дельтами** (`bulkPutIcons` / `bulkPutSets` / `bulkPutGroups` / `putSource`), без перезаписи всего набора.

## Базовая библиотека (Ant Design Icons)

Иконки из [`@ant-design/icons-svg`](https://www.npmjs.com/package/@ant-design/icons-svg) (devDep) конвертируются в импортный JSON-формат скриптом `scripts/build-ant-icons.mjs`. Скрипт прошивается в `predev` и `prebuild`, результат пишется в `public/libraries/` (этот каталог в `.gitignore`).

Загружаются они **вручную**: либо кнопкой «Load Ant Design Icons» на плейсхолдере пустой библиотеки, либо в Settings → Bundled icon library. Импорт идёт через стандартный `handleImport`, никакого специального кода. Уже загруженные source'ы пропускаются, поэтому повторные клики идемпотентны.

«Clear all data» в настройках сбрасывает IDB и localStorage в пустое состояние — пользователь возвращается на плейсхолдер и сам решает, загружать ли базовую библиотеку обратно.

## PWA / SEO

- `public/manifest.webmanifest` — standalone PWA, theme `#F97316`, scope `/vibeicons/`.
- `public/favicon.svg` — векторный favicon (V-mark на оранжевом градиенте).
- `public/cover.jpg` — обложка для OG / Twitter Card (1024×541).
- В `index.html` прописаны `og:*` и `twitter:*` теги с абсолютными URL `https://gritsenko.biz/vibeicons/...`, чтобы превью корректно подхватывалось в Telegram, Twitter/X и Facebook.

## Происхождение

Дизайн собран в [Claude Design](https://claude.ai/design) (см. чаты в `.design-bundle/vibeicons/chats/`). Этот репозиторий — портация прототипа на production-стек: Vite + React + TypeScript, без UMD-React и Babel-Standalone из исходного HTML-прототипа.

Иконки в базовой библиотеке — [Ant Design Icons](https://github.com/ant-design/ant-design-icons), MIT.
