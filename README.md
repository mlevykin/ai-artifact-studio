# AI Artifact Studio

**Русский** | [English](#english)

Локальный аналог Claude Artifacts и ChatGPT Canvas — чат с ИИ и живым просмотром артефактов в правой панели.

![AI Artifact Studio](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Возможности

- **Два провайдера ИИ** — Claude API и Ollama (локальные модели)
- **Живой рендер артефактов** — Mermaid диаграммы, HTML страницы, Markdown, SVG
- **Зум и панорамирование** — для диаграмм и HTML артефактов
- **История версий** — навигация между версиями артефакта ← v1/3 →
- **Редактирование через чат** — напиши "исправь заголовок" и модель обновит артефакт
- **Вложения файлов** — drag & drop изображений и текстовых файлов
- **Экспорт** — SVG, PNG, HTML, Markdown, RTF
- **Сохранение чатов** — автосохранение сессий в localStorage, экспорт/импорт JSON
- **Двуязычный интерфейс** — RU / EN

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- npm или yarn
- Ollama (опционально) или API ключ Anthropic

### Установка

```bash
git clone https://github.com/mlevykin/ai-artifact-studio.git
cd ai-artifact-studio
npm install
```

### Настройка

```bash
cp .env.example .env
```

Открой `.env` и вставь свой API ключ:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Запуск

```bash
npm run dev
```

Открой [http://localhost:5173](http://localhost:5173)

## 🤖 Провайдеры

### Claude API
Запросы идут через Vite proxy — API ключ не попадает в браузер. Поддерживаемые модели: Claude Sonnet 4, Claude Opus 4, Claude Haiku 4.5.

### Ollama (локально)
Установи [Ollama](https://ollama.ai) и скачай модель:
```bash
ollama pull llama3.2
ollama pull qwen2.5
```
Список установленных моделей подгружается автоматически в настройках.

## 📊 Типы артефактов

| Тип | Описание | Экспорт |
|-----|----------|---------|
| `mermaid` | Flowchart, Sequence, Class, State, ER, Gantt, Timeline | SVG, PNG, RTF |
| `html` | Интерактивные страницы, слайды, визуализации | HTML, RTF |
| `markdown` | Документы, отчёты | MD, RTF |
| `svg` | Векторная графика | SVG, PNG, RTF |

## ⌨️ Использование

1. Выбери провайдера в настройках (⚙)
2. Напиши запрос, например:
   - *"Flowchart процесса CI/CD"*
   - *"Sequence diagram JWT авторизации"*
   - *"HTML слайд для презентации об AI"*
   - *"State diagram заказа в интернет-магазине"*
3. Артефакт появится в правой панели
4. Для редактирования напиши в чат: *"исправь цвета"* или *"добавь этап деплоя"*

## 🗂 Структура проекта

```
ai-artifact-studio/
├── src/
│   ├── App.jsx          # Всё приложение
│   └── App.css          # Стили
├── index.html
├── vite.config.js       # Proxy для Claude API
├── .env.example         # Пример конфига
└── package.json
```

## 📄 Лицензия

MIT

---

<a name="english"></a>

# AI Artifact Studio

[Русский](#ai-artifact-studio) | **English**

A local alternative to Claude Artifacts and ChatGPT Canvas — AI chat with live artifact preview in the right panel.

## ✨ Features

- **Two AI providers** — Claude API and Ollama (local models)
- **Live artifact rendering** — Mermaid diagrams, HTML pages, Markdown, SVG
- **Zoom and pan** — for diagrams and HTML artifacts
- **Version history** — navigate between artifact versions ← v1/3 →
- **Edit via chat** — type "fix the title" and the model updates the artifact
- **File attachments** — drag & drop images and text files
- **Export** — SVG, PNG, HTML, Markdown, RTF
- **Chat history** — auto-save sessions to localStorage, JSON export/import
- **Bilingual UI** — RU / EN

## 🚀 Quick Start

### Requirements

- Node.js 18+
- npm or yarn
- Ollama (optional) or Anthropic API key

### Install

```bash
git clone https://github.com/mlevykin/ai-artifact-studio.git
cd ai-artifact-studio
npm install
```

### Configure

```bash
cp .env.example .env
```

Open `.env` and add your API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 🤖 Providers

### Claude API
Requests go through Vite proxy — API key never reaches the browser. Supported models: Claude Sonnet 4, Claude Opus 4, Claude Haiku 4.5.

### Ollama (local)
Install [Ollama](https://ollama.ai) and pull a model:
```bash
ollama pull llama3.2
ollama pull qwen2.5
```
The list of installed models loads automatically in settings.

## 📊 Artifact Types

| Type | Description | Export |
|------|-------------|--------|
| `mermaid` | Flowchart, Sequence, Class, State, ER, Gantt, Timeline | SVG, PNG, RTF |
| `html` | Interactive pages, slides, visualizations | HTML, RTF |
| `markdown` | Documents, reports | MD, RTF |
| `svg` | Vector graphics | SVG, PNG, RTF |

## ⌨️ Usage

1. Select a provider in settings (⚙)
2. Type a request, for example:
   - *"Flowchart of CI/CD process"*
   - *"Sequence diagram of JWT authentication"*
   - *"HTML slide for an AI presentation"*
   - *"State diagram of a shop order"*
3. The artifact appears in the right panel
4. To edit, type in chat: *"fix the colors"* or *"add a deploy stage"*

## 🗂 Project Structure

```
ai-artifact-studio/
├── src/
│   ├── App.jsx          # Entire application
│   └── App.css          # Styles
├── index.html
├── vite.config.js       # Proxy for Claude API
├── .env.example         # Config example
└── package.json
```

## 📄 License

MIT