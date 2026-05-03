import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, Notification, ipcMain } from 'electron';
import type { BrowserWindow as BrowserWindowType, Tray as TrayType } from 'electron';
import path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { startRecording, stopRecording, isRecording, checkSox } from './recorder.js';
import { transcribe, checkWhisper } from './transcriber.js';
import { getActiveContext } from './context.js';
import { format } from './formatter.js';
import { inject } from './injector.js';

const CONFIG_DIR = path.join(app.getPath('userData'), 'glaido-libre');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig(): Record<string, string> {
  try {
    if (existsSync(CONFIG_FILE)) return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch { /* */ }
  return { model: 'claude-sonnet-4-5' };
}

function saveConfig(cfg: Record<string, string>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

const HOTKEY = 'CommandOrControl+Shift+Space';

let tray: TrayType | null = null;
let settingsWindow: BrowserWindowType | null = null;
let isProcessing = false;

function setTrayIcon(state: 'idle' | 'recording' | 'processing') {
  if (!tray) return;
  const labels: Record<string, string> = {
    idle: 'Glaido Libre — Ready (⌘⇧Space)',
    recording: 'Glaido Libre — Recording...',
    processing: 'Glaido Libre — Processing...',
  };
  tray.setToolTip(labels[state]);
  tray.setTitle(state === 'idle' ? '🎙' : state === 'recording' ? '🔴' : '⏳');
}

function notify(title: string, body: string) {
  new Notification({ title, body, silent: true }).show();
}

async function runPipeline() {
  if (isProcessing) return;
  isProcessing = true;
  setTrayIcon('processing');

  try {
    // Snapshot context BEFORE switching to processing (user was in their app)
    const ctx = getActiveContext();

    const wavPath = await stopRecording();
    if (!wavPath) throw new Error('No recording captured');

    const transcript = await transcribe(wavPath);
    if (!transcript.trim()) {
      notify('Glaido Libre', 'No speech detected. Try again.');
      return;
    }

    // Skip AI formatting for instant injection — just strip filler words locally
    const formatted = transcript
      .replace(/\b(um|uh|like|you know|sort of|kind of|basically|literally)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    inject(formatted, ctx.appName);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    notify('Glaido Libre — Error', msg);
    console.error('[glaido]', msg);
  } finally {
    isProcessing = false;
    setTrayIcon('idle');
  }
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 500,
    title: 'Glaido Libre Settings',
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Glaido Libre', enabled: false },
    { label: `Hotkey: ${HOTKEY}`, enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: openSettings },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

app.dock?.hide(); // tray-only app — no dock icon

app.whenReady().then(() => {
  // Verify prerequisites
  if (!checkSox()) {
    notify('Glaido Libre — Setup Required', 'sox not found. Run: brew install sox');
  }
  if (!checkWhisper()) {
    notify('Glaido Libre — Setup Required', 'whisper not found. Run: brew install openai-whisper');
  }

  // Create tray (nativeImage must be created after app ready)
  tray = new Tray(nativeImage.createEmpty());
  tray.setContextMenu(buildTrayMenu());
  setTrayIcon('idle');
  tray.on('right-click', () => tray?.popUpContextMenu(buildTrayMenu()));

  // Register global hotkey: hold to record, release to process
  globalShortcut.register(HOTKEY, () => {
    if (isProcessing) return;

    if (!isRecording()) {
      // Snapshot context now (user is in their app, about to speak)
      startRecording();
      setTrayIcon('recording');
    } else {
      // Second press = stop and process
      setTrayIcon('processing');
      runPipeline();
    }
  });

  notify('Glaido Libre', `Ready! Press ${HOTKEY} once to start, again to stop & paste.`);
});

// IPC handlers for settings window
ipcMain.handle('get-hotkey', () => HOTKEY);
ipcMain.handle('get-status', () => ({
  sox: checkSox(),
  speechRecognition: checkWhisper(),
  recording: isRecording(),
  processing: isProcessing,
}));
ipcMain.handle('get-model', () => loadConfig().model ?? 'claude-sonnet-4-5');
ipcMain.handle('set-model', (_e, model: string) => {
  const cfg = loadConfig();
  cfg.model = model;
  saveConfig(cfg);
  process.env.GLAIDO_MODEL = model;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Keep app running with no windows open
app.on('window-all-closed', () => { /* keep running as tray app */ });
