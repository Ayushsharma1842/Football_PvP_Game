import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate a random player ID
export function generatePlayerId(): string {
  return crypto.randomUUID();
}

// Generate a short share code for matches
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Get or create persistent player ID from localStorage
export function getPlayerId(): string {
  const key = 'the-var-room-player-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generatePlayerId();
    localStorage.setItem(key, id);
  }
  return id;
}

// Get or set player name
export function getPlayerName(): string {
  return localStorage.getItem('the-var-room-player-name') || 'Player';
}

export function setPlayerName(name: string): void {
  localStorage.setItem('the-var-room-player-name', name);
}

// Format time in seconds to display string
export function formatTime(seconds: number): string {
  return seconds.toFixed(1);
}

// Format milliseconds to readable time
export function formatMs(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s`;
}

// Generate bot names
const BOT_NAMES = [
  'VAR Bot',
  'Ref AI',
  'Whistle Bot',
  'Card Master',
  'Offside Oracle',
  'Penalty Pro',
  'Rule Keeper',
];

export function getRandomBotName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

