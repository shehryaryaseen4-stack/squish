import type { AdProvider } from './AdProvider';

/** Used when no ad network is configured. Ads are simply unavailable. */
export class NoAdProvider implements AdProvider {
  readonly name = 'none';
  readonly isMock = false;
  async initialize() {}
  isRewardedAdAvailable() {
    return false;
  }
  showRewardedAd(_r: (txId: string) => void, onClosed: () => void, onError: (m: string) => void) {
    onError('Rewarded videos are not available in this build.');
    onClosed();
  }
}
