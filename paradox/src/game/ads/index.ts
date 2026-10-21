import type { AdProvider } from './AdProvider';
import { MockAdProvider } from './MockAdProvider';
import { NativeBridgeAdProvider } from './NativeBridgeAdProvider';
import { NoAdProvider } from './NoAdProvider';

/**
 * Chooses the ad provider:
 * - a native wrapper bridge if one is present,
 * - the labelled mock when VITE_AD_PROVIDER=mock, or by default in `npm run dev`,
 * - otherwise none (rewarded features fall back to earned tokens).
 */
export function createAdProvider(): AdProvider {
  if (NativeBridgeAdProvider.detect()) return new NativeBridgeAdProvider();
  const mode = (import.meta.env.VITE_AD_PROVIDER as string | undefined) ?? (import.meta.env.DEV ? 'mock' : 'none');
  if (mode === 'mock') return new MockAdProvider();
  return new NoAdProvider();
}

export type { AdProvider };
