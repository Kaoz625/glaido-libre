import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

export const RECORDING_PATH = '/tmp/glaido-recording.wav';

let recordingProcess: ChildProcess | null = null;

export function startRecording(): void {
  if (recordingProcess) return;

  if (existsSync(RECORDING_PATH)) {
    unlinkSync(RECORDING_PATH);
  }

  // sox: record from default mic, 16kHz mono WAV (optimal for Whisper/SFSpeechRecognizer)
  recordingProcess = spawn('sox', [
    '-d',                    // default audio input device
    '-r', '16000',           // 16kHz sample rate
    '-c', '1',               // mono
    '-b', '16',              // 16-bit
    RECORDING_PATH
  ]);

  recordingProcess.stderr?.on('data', () => {}); // suppress sox progress output
}

export async function stopRecording(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!recordingProcess) return reject(new Error('No active recording'));

    recordingProcess.on('close', () => {
      recordingProcess = null;
      if (existsSync(RECORDING_PATH)) {
        resolve(RECORDING_PATH);
      } else {
        reject(new Error('Recording file not created'));
      }
    });

    recordingProcess.kill('SIGTERM');
  });
}

export function isRecording(): boolean {
  return recordingProcess !== null;
}

export function checkSox(): boolean {
  try {
    execSync('which sox', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
