/**
 * Rewarded-ad abstraction. Gameplay never talks to an ad SDK directly.
 *
 * Contract:
 * - `onReward(txId)` is called at most once per `showRewardedAd` call, and only
 *   after the provider confirms the viewer earned the reward. `txId` is unique.
 * - `onClosed()` is always called once when the ad UI goes away.
 * - `onError(message)` is called instead of `onReward` when nothing was earned.
 */
export interface AdProvider {
  readonly name: string;
  /** True for development stand-ins that never show real ads. */
  readonly isMock: boolean;
  initialize(): Promise<void>;
  isRewardedAdAvailable(): boolean;
  showRewardedAd(onReward: (txId: string) => void, onClosed: () => void, onError: (message: string) => void): void;
}

/** Wraps callbacks so each fires at most once, whatever the provider does. */
export function guardCallbacks(onReward: (txId: string) => void, onClosed: () => void, onError: (m: string) => void) {
  let rewarded = false;
  let closed = false;
  let errored = false;
  return {
    reward: (txId: string) => {
      if (rewarded || errored) return;
      rewarded = true;
      onReward(txId);
    },
    closed: () => {
      if (closed) return;
      closed = true;
      onClosed();
    },
    error: (m: string) => {
      if (rewarded || errored) return;
      errored = true;
      onError(m);
    },
  };
}

export const newTxId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
