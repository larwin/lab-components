/**
 * Character limit — the pure math behind a TextArea counter.
 *
 * The value itself stays native (the browser's caret machine owns text
 * editing, like TextField); what Forge owns is the *policy*: when the counter
 * turns into a warning and what the screen reader hears. The adapter announces
 * `message` when `warn` flips false → true — crossing back stays quiet.
 */

export interface CharacterLimitState {
  readonly count: number;
  readonly max: number;
  readonly remaining: number;
  /** Within the warning window (≤ threshold remaining) or over the limit. */
  readonly warn: boolean;
  readonly overflow: boolean;
  /** SR announcement for the warning window; `null` outside of it. */
  readonly message: string | null;
}

/** Warning window: 10 % of max, at least 5 characters, at most 20. */
const thresholdFor = (max: number): number => Math.min(20, Math.max(5, Math.floor(max / 10)));

export function characterLimit(value: string, max: number): CharacterLimitState {
  // UTF-16 units, consistent with the native `maxLength` attribute.
  const count = value.length;
  const remaining = max - count;
  const warn = remaining <= thresholdFor(max);
  const overflow = remaining < 0;
  let message: string | null = null;
  if (overflow) {
    message = `Limite dépassée de ${-remaining} caractère${remaining < -1 ? "s" : ""}`;
  } else if (warn) {
    message = `${remaining} caractère${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`;
  }
  return { count, max, remaining, warn, overflow, message };
}
