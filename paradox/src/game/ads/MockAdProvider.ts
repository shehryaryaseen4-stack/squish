import { AdProvider, guardCallbacks, newTxId } from './AdProvider';

/**
 * DEVELOPMENT MOCK. Shows a clearly labelled fake "ad" overlay for a few
 * seconds. No network, no tracking, no real advertising. The viewer can close
 * it early, in which case no reward is granted.
 */
export class MockAdProvider implements AdProvider {
  readonly name = 'mock';
  readonly isMock = true;
  private showing = false;
  constructor(private seconds = 3) {}

  async initialize() {}

  isRewardedAdAvailable() {
    return !this.showing && (typeof navigator === 'undefined' || navigator.onLine !== false);
  }

  showRewardedAd(onReward: (txId: string) => void, onClosed: () => void, onError: (m: string) => void) {
    const cb = guardCallbacks(onReward, onClosed, onError);
    if (!this.isRewardedAdAvailable()) {
      cb.error('No mock ad available right now.');
      cb.closed();
      return;
    }
    this.showing = true;
    const el = document.createElement('div');
    el.className = 'mock-ad';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Mock rewarded ad');
    el.innerHTML = `
      <div class="mock-ad-card">
        <div class="mock-ad-badge">MOCK AD · DEVELOPMENT ONLY</div>
        <p>This is a stand-in for a rewarded video. No real ad network is connected.</p>
        <div class="mock-ad-bar"><span></span></div>
        <p class="mock-ad-count"></p>
        <button class="btn ghost" data-close>Close without reward</button>
      </div>`;
    document.body.appendChild(el);
    const bar = el.querySelector<HTMLSpanElement>('.mock-ad-bar span')!;
    const count = el.querySelector<HTMLParagraphElement>('.mock-ad-count')!;
    const start = performance.now();
    const total = this.seconds * 1000;
    let finished = false;
    const finish = (earned: boolean) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      el.remove();
      this.showing = false;
      if (earned) cb.reward(newTxId());
      else cb.error('The ad was closed before the end, so no reward was granted.');
      cb.closed();
    };
    const timer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / total);
      bar.style.width = `${t * 100}%`;
      count.textContent = t < 1 ? `Reward in ${Math.ceil((total - (performance.now() - start)) / 1000)}s` : '';
      if (t >= 1) finish(true);
    }, 100);
    el.querySelector('[data-close]')!.addEventListener('click', () => finish(false));
  }
}
