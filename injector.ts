import { execSync } from 'child_process';

export function inject(text: string, appName?: string): void {
  if (!text.trim()) return;

  const escaped = text.replace(/'/g, "'\\''");
  execSync(`printf '%s' '${escaped}' | pbcopy`, { timeout: 3000 });

  if (appName && appName !== 'Unknown') {
    execSync(
      `osascript -e 'tell application "${appName}" to activate' -e 'delay 0.25'`,
      { timeout: 3000 }
    );
  }

  execSync(
    `osascript -e 'delay 0.1' -e 'tell application "System Events" to keystroke "v" using command down'`,
    { timeout: 5000 }
  );
}
