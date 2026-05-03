#!/usr/bin/env node
// Copies Electron.app to /tmp to escape iCloud xattr injection, signs it ad-hoc with
// required entitlements, copies back. Without entitlements Electron 41 won't initialize
// its browser process (process.type stays undefined, require('electron') returns a path).
import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eapp = join(root, 'node_modules/electron/dist/Electron.app');
const tmp = '/tmp/Electron_glaido_sign.app';
const entitlementsPath = '/tmp/electron-glaido-entitlements.plist';

if (!existsSync(eapp)) {
  console.log('Electron.app not found, skipping codesign');
  process.exit(0);
}

const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.get-task-allow</key><true/>
  <key>com.apple.security.automation.apple-events</key><true/>
</dict>
</plist>`;

try {
  writeFileSync(entitlementsPath, entitlements);
  execSync(`rm -rf "${tmp}"`, { stdio: 'ignore' });
  execSync(`ditto --norsrc --noextattr --nohfsCompression "${eapp}" "${tmp}"`, { stdio: 'ignore' });
  execSync(`xattr -cr "${tmp}" 2>/dev/null; true`, { shell: true, stdio: 'ignore' });
  execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${tmp}"`, { stdio: 'pipe' });
  execSync(`rm -rf "${eapp}"`, { stdio: 'ignore' });
  execSync(`cp -R "${tmp}" "${eapp}"`, { stdio: 'ignore' });
  console.log('Electron.app codesigned OK with entitlements');
} catch (e) {
  console.warn('codesign warning (non-fatal):', e.message);
}
