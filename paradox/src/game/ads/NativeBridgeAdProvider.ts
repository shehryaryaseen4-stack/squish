import { AdProvider, guardCallbacks } from './AdProvider';

/**
 * Adapter for a native wrapper (for example a Capacitor or Trusted Web
 * Activity shell) that exposes `window.ParadoxNativeAds`. The wrapper owns the
 * real SDK (such as Google AdMob) and its credentials; nothing secret lives in
 * this web bundle. Expected bridge shape:
 *
 *   window.ParadoxNativeAds = {
 *     isReady(): boolean,
 *     show(callbacks: { reward(txId: string): void; closed(): void; error(msg: string): void }): void
 *   }
 *
 * The bridge must call `reward` only from the SDK's "user earned reward"
 * callback (ideally after server-side verification).
 */
interface NativeBridge {
  isReady(): boolean;
  show(cb: { reward(txId: string): void; closed(): void; error(msg: string): void }): void;
}

export class NativeBridgeAdProvider implements AdProvider {
  readonly name = 'native-bridge';
  readonly isMock = false;
  private get bridge(): NativeBridge | undefined {
    return (globalThis as unknown as { ParadoxNativeAds?: NativeBridge }).ParadoxNativeAds;
  }
  static detect() {
    return !!(globalThis as unknown as { ParadoxNativeAds?: NativeBridge }).ParadoxNativeAds;
  }
  async initialize() {}
  isRewardedAdAvailable() {
    try {
      return !!this.bridge?.isReady();
    } catch {
      return false;
    }
  }
  showRewardedAd(onReward: (txId: string) => void, onClosed: () => void, onError: (m: string) => void) {
    const cb = guardCallbacks(onReward, onClosed, onError);
    const b = this.bridge;
    if (!b || !this.isRewardedAdAvailable()) {
      cb.error('No ad is ready.');
      cb.closed();
      return;
    }
    try {
      b.show({ reward: cb.reward, closed: cb.closed, error: cb.error });
    } catch (e) {
      cb.error(String(e));
      cb.closed();
    }
  }
}
