# Magecomp Chat Auto Translator

A Chrome extension that automatically translates messages to English on the Magecomp inbox platform with real-time language detection.

## Features

- **Automatic Translation**: Automatically detects and translates non-English messages to English
- **Language Detection**: Shows detected language badges for each translated message
- **Smart Caching**: Avoids re-translating messages that have already been processed
- **Real-time Updates**: Monitors chat for new messages using MutationObserver
- **CORS-free**: Uses background service worker to bypass CORS restrictions
- **Performance Optimized**:
  - Processes messages from newest to oldest
  - Debounced DOM change detection
  - Concurrent processing prevention
- **Visual Indicators**: Loading states and styled translation display

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `magecomp-translator` folder

### File Structure

```
magecomp-translator/
├── manifest.json       # Extension configuration
├── background.js       # Service worker for translation API calls
├── content.js         # Main logic for message detection and translation
└── styles.css         # Styling for translated messages
```

## How It Works

### 1. Message Detection
The extension scans the chat interface for messages with classes:
- `.msg_pos.chat__message_received` (received messages)
- `.msg_pos.chat__message_send` (sent messages)

### 2. Text Extraction
Cleans message text by removing:
- Buttons and UI elements
- Special characters and symbols
- Action labels (Reply, Forward, Bookmark, Delete)
- User name annotations

### 3. Translation Process
- Sends text to Google Translate API via background service worker
- Detects source language automatically
- Skips messages already in English
- Caches translations to improve performance

### 4. Display
- Adds language badge showing detected language
- Appends translation below original message
- Applies custom styling for visual distinction

## Configuration

### Permissions

The extension requires the following permissions (defined in manifest.json):

```json
"host_permissions": [
  "https://inbox.magecomp.in/*",
  "https://translate.googleapis.com/*"
]
```

### Timing Settings

You can adjust these values in `content.js`:

- **Initial scan delay**: `2000ms` (line 173)
- **Re-scan interval**: `5000ms` (line 180)
- **Message processing delay**: `400ms` (line 164)
- **Mutation observer debounce**: `1000ms` (line 189)

## Technical Details

### Background Service Worker
- Handles translation API requests to bypass CORS restrictions
- Uses Google Translate's unofficial API endpoint
- Returns translation with detected language

### Content Script
- Runs on `https://inbox.magecomp.in/*` pages
- Implements caching to avoid duplicate translations
- Uses reverse iteration to prioritize newest messages
- Prevents concurrent processing with mutex pattern

### Styling
- Green-tinted italic text for translations
- Orange language badges
- Subtle border separator from original message

## Privacy & Data

- Sends message text to Google Translate API for translation
- No data is stored or transmitted to third-party servers (except Google Translate)
- All caching is done locally in the browser session
- No persistent storage or tracking

## Development

### Debugging

Check the console for status messages:
- 🌐 Extension loaded confirmation
- ✅ Successful translations with language detection
- ⏭️ Skipped messages (already English)
- ❌ Translation errors

### Making Changes

1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the inbox.magecomp.in page

## Limitations

- Requires internet connection for translation API
- Uses unofficial Google Translate API (may have rate limits)
- Only works on inbox.magecomp.in domain
- Translations are machine-generated and may not be perfect

## Version History

- **v1.0** - Initial release with automatic translation and language detection

## License

This project is provided as-is for use with the Magecomp inbox platform.
