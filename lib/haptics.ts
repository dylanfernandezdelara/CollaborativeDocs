/**
 * Fire a short haptic tick on devices that support it (Android Chrome, etc.).
 * iOS Safari has no `navigator.vibrate`, so visual press feedback must carry
 * the weight there. Call from a handler that runs inside a user activation
 * (click / pointerup); Chrome blocks vibration before the first activation,
 * so pointerdown-time calls fail on a freshly loaded page.
 */
export function pressHaptic(): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(10);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}
