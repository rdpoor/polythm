/**
 * parser.js – Beat value parsing and formatting utilities
 */

/**
 * Parses a beat value string into a number.
 * Supports:
 *   "4"          → 4
 *   "2.6666667"  → 2.6666667
 *   "3/4"        → 0.75
 *   "2 2/3"      → 2.6666...
 * Returns NaN if the string cannot be parsed.
 */
function parseBeatValue(str) {
  if (typeof str !== 'string') return NaN;
  str = str.trim();
  if (str === '') return NaN;

  // Mixed number: "2 2/3"
  const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num   = parseInt(mixedMatch[2], 10);
    const den   = parseInt(mixedMatch[3], 10);
    if (den === 0) return NaN;
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (num / den);
  }

  // Simple fraction: "3/4"
  const fracMatch = str.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const den = parseInt(fracMatch[2], 10);
    if (den === 0) return NaN;
    return num / den;
  }

  // Integer or float
  const n = Number(str);
  return isNaN(n) ? NaN : n;
}

/**
 * Formats a number as a human-readable beat string.
 * Uses fraction notation if it matches a simple fraction with denominator ≤ 16,
 * otherwise returns a float string (up to 7 decimal places, trimmed).
 */
function formatBeatValue(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0';

  // Check for simple fraction (denominator 2–16)
  for (let den = 2; den <= 16; den++) {
    const num = Math.round(val * den);
    if (Math.abs(num / den - val) < 1e-9) {
      if (num % den === 0) {
        // It's a whole number
        return String(num / den);
      }
      const whole = Math.floor(Math.abs(num / den));
      const remNum = Math.abs(num) - whole * den;
      if (whole > 0) {
        return `${Math.sign(val) < 0 ? '-' : ''}${whole} ${remNum}/${den}`;
      }
      return `${num}/${den}`;
    }
  }

  // Fall back to float, trimming trailing zeros
  return parseFloat(val.toFixed(7)).toString();
}

window.parseBeatValue = parseBeatValue;
window.formatBeatValue = formatBeatValue;
