import type { Game } from '../../game/Game';
import { esc, hex, toast } from '../dom';
import { icons } from '../icons';
import { COSMETICS, Cosmetic, CosmeticSlot } from '../../data/cosmetics';
import { achievementById } from '../../data/achievements';
import { WORLDS } from '../../data/worlds';
import { refreshWallet, topBar } from './common';

const SLOTS: { id: CosmeticSlot; label: string }[] = [
  { id: 'skin', label: 'Cube skins' },
  { id: 'trail', label: 'Trails' },
  { id: 'portal', label: 'Rift colours' },
];

function sourceText(c: Cosmetic) {
  if (c.price !== undefined) return `${c.price} coins`;
  if (c.source === 'world') return `Complete ${WORLDS[Number(c.sourceRef) - 1].name}`;
  if (c.source === 'achievement') return `Achievement: ${achievementById(c.sourceRef!)?.name ?? ''}`;
  if (c.source === 'ad') return 'Optional rewarded video';
  if (c.source === 'ending') return 'Awaken the Paradox Core';
  return 'Starter';
}

export function rewardsScreen(game: Game, root: HTMLElement, params: Record<string, unknown>) {
  const bar = topBar(game, 'Rewards');
  let slot = (params.slot as CosmeticSlot) ?? 'skin';
  const render = () => {
    root.innerHTML = `
      <section class="screen rewards">
        ${bar.html}
        <div class="tabs" role="tablist">${SLOTS.map((s) => `<button role="tab" class="tab ${s.id === slot ? 'on' : ''}" aria-selected="${s.id === slot}" data-slot="${s.id}">${s.label}</button>`).join('')}</div>
        <p class="levels-sub">Purely cosmetic. Tap an item to preview it on the cube behind this menu.</p>
        <div class="cos-grid scroll">
          ${COSMETICS.filter((c) => c.slot === slot)
            .map((c) => {
              const owned = game.rewards.owns(c.id);
              const equipped = game.saves.data.equipped[c.slot] === c.id;
              return `<div class="cos ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}" data-id="${c.id}">
                <button class="swatch" data-preview style="--c1:${hex(c.color)};--c2:${hex(c.color2)}" aria-label="Preview ${esc(c.name)}"></button>
                <b>${esc(c.name)}</b>
                <small>${esc(c.description)}</small>
                ${
                  equipped
                    ? `<span class="tag">${icons.check} Equipped</span>`
                    : owned
                      ? `<button class="btn small" data-equip>Equip</button>`
                      : c.price !== undefined
                        ? `<button class="btn small primary" data-buy ${game.rewards.coins < c.price ? 'disabled' : ''}>${icons.coin} ${c.price}</button>`
                        : c.source === 'ad'
                          ? `<button class="btn small" data-ad ${game.ads.isRewardedAdAvailable() ? '' : 'disabled'}>${icons.video} Watch${game.ads.isMock ? ' (mock)' : ''}</button>`
                          : `<span class="tag lock">${icons.lock} ${esc(sourceText(c))}</span>`
                }
              </div>`;
            })
            .join('')}
        </div>
      </section>`;
    bar.bind(root);
    root.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        slot = b.dataset.slot as CosmeticSlot;
        game.click();
        render();
      }),
    );
    root.querySelectorAll<HTMLElement>('.cos').forEach((card) => {
      const id = card.dataset.id!;
      const c = COSMETICS.find((x) => x.id === id)!;
      card.querySelector('[data-preview]')?.addEventListener('click', () => {
        if (c.slot === 'skin') game.menuScene.setSkin(c.color);
        else toast(`${c.name}: ${c.description}`, 'info');
      });
      card.querySelector('[data-equip]')?.addEventListener('click', () => {
        game.rewards.equip(id);
        game.click();
        if (c.slot === 'skin') game.menuScene.setSkin(c.color);
        game.checkAchievements();
        render();
      });
      card.querySelector('[data-buy]')?.addEventListener('click', () => {
        const r = game.rewards.buy(id);
        if (r === 'ok') {
          game.audio.play('coin');
          toast(`Unlocked ${c.name}`, 'good');
          render();
        } else if (r === 'insufficient') toast('Not enough coins yet.', 'warn');
        refreshWallet(game, root);
      });
      card.querySelector('[data-ad]')?.addEventListener('click', () => {
        game.ads.showRewardedAd(
          (txId) => {
            if (game.rewards.applyAdReward(txId, 'cosmetic', game.daily.today)) {
              toast(`Unlocked ${c.name}`, 'good');
              game.audio.play('coin');
            }
          },
          () => render(),
          (m) => toast(m, 'warn'),
        );
      });
    });
  };
  render();
}
