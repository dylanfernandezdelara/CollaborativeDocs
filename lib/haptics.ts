/**
 * Fire a short haptic tick on devices that support it (Android Chrome, etc.).
 * iOS Safari has no `navigator.vibrate`, so visual press feedback must carry
 * the weight there. Safe to call from any user-gesture handler.
 */
export function pressHaptic(): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(10);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}
