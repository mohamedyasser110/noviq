import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createElement } from 'react';
import { HelpCircle } from 'lucide-react';
import { iconMap, supportedIconNames, hasIcon } from './icons';

export { supportedIconNames, hasIcon };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => ({
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '\'',
  }[char] ?? char));
}

/* The icon map itself lives in lib/icons.ts, generated from every icon name
   the shipped content uses and verified against the installed lucide. It was
   hand-maintained here before, and names the dashboard already relied on —
   stethoscope, package, shopping-cart, building-2, landmark and forty more —
   were absent, so those cards rendered a literal "?" glyph. */
const ICON_FALLBACK = HelpCircle;

export function createIcon(name: string, props: { size?: number; className?: string } = {}): React.ReactElement {
  const Icon = iconMap[String(name || '').toLowerCase()] || ICON_FALLBACK;
  return createElement(Icon, props);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function debounce<T>(fn: (...args: any[]) => T, delay: number): (...args: any[]) => void {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}