import { execSync } from 'child_process';

export interface AppContext {
  appName: string;
  surroundingText: string;
  docType: 'code' | 'email' | 'chat' | 'document' | 'general';
}

const CODE_APPS = ['code', 'cursor', 'xcode', 'terminal', 'iterm', 'warp', 'nova', 'zed'];
const EMAIL_APPS = ['mail', 'gmail', 'outlook', 'spark', 'airmail'];
const CHAT_APPS = ['slack', 'discord', 'messages', 'telegram', 'teams', 'whatsapp', 'signal'];
const DOC_APPS = ['notion', 'word', 'pages', 'google docs', 'bear', 'obsidian', 'typora'];

function classifyApp(appName: string): AppContext['docType'] {
  const lower = appName.toLowerCase();
  if (CODE_APPS.some(a => lower.includes(a))) return 'code';
  if (EMAIL_APPS.some(a => lower.includes(a))) return 'email';
  if (CHAT_APPS.some(a => lower.includes(a))) return 'chat';
  if (DOC_APPS.some(a => lower.includes(a))) return 'document';
  // Browser: try to infer from page title/URL if possible
  return 'general';
}

function run(script: string): string {
  try {
    return execSync(`osascript -e '${script}'`, {
      timeout: 3000,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

export function getActiveContext(): AppContext {
  const appName = run(
    'tell app "System Events" to get name of first process whose frontmost is true'
  );

  // Try to get selected text first (most accurate context)
  let surroundingText = run(
    'tell app "System Events" to get (the clipboard)'
  );

  // Try Accessibility API for focused element's value
  if (!surroundingText) {
    surroundingText = run(`
      tell application "System Events"
        set frontApp to first process whose frontmost is true
        try
          set focusedEl to value of attribute "AXFocusedUIElement" of frontApp
          set surroundingText to value of attribute "AXSelectedText" of focusedEl
          return surroundingText
        end try
      end tell
    `);
  }

  return {
    appName: appName || 'Unknown',
    surroundingText: surroundingText || '',
    docType: classifyApp(appName),
  };
}
