# Replit Agent Task Spec — glaido-libre

## Instructions for Replit Agent
Read this file carefully before touching any code.
Commit all changes with prefix "replit: " and push to main when done.

## What This Is
glaido-libre is a macOS menu-bar Electron app. Press ⌘⇧Space → it records your voice →
transcribes with whisper-cpp → strips filler words → injects clean text into whatever app
you were typing in. No cloud — everything runs locally.

## Stack
- Electron (TypeScript, ESM)
- whisper-cpp for transcription (local GGUF models)
- sox for audio preprocessing
- Anthropic claude-sonnet-4-6 (optional AI formatting — currently bypassed for speed)

## Known Issues (Fix These)

### Issue 1 — Wrong model string in config default
File: `index.ts` line ~17
```ts
return { model: 'claude-sonnet-4-5' };
```
Change to:
```ts
return { model: 'claude-sonnet-4-6' };
```

### Issue 2 — Hardcoded whisper-cli path breaks on most machines
File: `transcriber.ts`
`WHISPER_CLI` is hardcoded to `/usr/local/Cellar/whisper-cpp/1.8.4/bin/whisper-cli`
This path only exists on machines with that exact Homebrew Cellar version.

Fix: make `findWhisperCli()` try these paths in order:
1. `which whisper-cli` (PATH lookup — works on any machine)
2. `brew --prefix whisper-cpp` + `/bin/whisper-cli`
3. `/usr/local/bin/whisper-cli`
4. `/opt/homebrew/bin/whisper-cli`
5. Fallback to Python `whisper` if whisper-cli not found

### Issue 3 — No graceful error when whisper model missing
If `GGML_MODEL` doesn't exist (no model downloaded), the app silently fails.
Add a startup check in `index.ts` that shows a notification:
"Glaido: whisper model not found. Run: mkdir -p ~/.cache/glaido-libre/models && cd ~/.cache/glaido-libre/models && curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

### Issue 4 — No dependency check on launch
Add a `checkDeps()` function called at app startup that verifies:
- `whisper-cli` or `whisper` is available
- `sox` is available (for audio preprocessing)
- At least one GGUF model exists in `~/.cache/glaido-libre/models/`
If any check fails, show a system notification with the fix command.

### Issue 5 — Recording may not capture audio on macOS 14+
File: `recorder.ts`
Ensure sox is called with `coreaudio` input device explicitly:
```bash
sox -t coreaudio default output.wav silence 1 0.1 1% 1 1.0 1%
```
If sox is not available, fall back to a Swift AVAudioRecorder call via `transcribe.swift`.

## Stack Rules
- Do NOT add any npm dependencies — keep it dependency-free (Electron built-ins only)
- AI model: claude-sonnet-4-6 (fix the hardcoded 4-5 string)
- Commit every change with "replit: " prefix
- TypeScript strict mode — no `any` types

## How to Test
```bash
npm install
npm run build   # tsc
# Then launch via Electron — can't test macOS tray on Replit, but verify build passes
npx tsc --noEmit   # type check only
```
