#!/bin/bash
# Fast launcher for glaido-libre — skips recompile, only codesigns if needed
set -e

PROJ="/Users/markususche/Documents/NYCTailblazers/Projects/Browser Automation"
EAPP="$PROJ/node_modules/electron/dist/Electron.app"
ELECTRON="$EAPP/Contents/MacOS/Electron"
ENTRY="$PROJ/scripts/glaido-libre/dist"

# Codesign only if invalid (fast path after first run)
if ! codesign -v "$EAPP" 2>/dev/null; then
  node "$PROJ/scripts/glaido-libre/codesign-electron.mjs"
fi

unset ELECTRON_RUN_AS_NODE
exec "$ELECTRON" "$ENTRY"
