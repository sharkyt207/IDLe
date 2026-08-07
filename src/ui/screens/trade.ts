import { Content } from '../../data';
import { t } from '../../core/i18n';
import { ECONOMY } from '../../data/economy';
import { duration, fmt, money, units } from '../../core/format';
import type { Game } from '../../game/game';
import { acceptOffer, abandon, canAccept, deliver, progressOf, recurringIncome } from '../../economy/contracts';
import { lotValue, placeBid } from '../../economy/auctions';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/** Handel: long-term contracts and live auctions (GDD chapter 4). */
export class TradeScreen implements Screen {
  readonly id = 'trade';
  readonly label = 'nav.sub.trade';
  readonly icon = '🤝';
  readonly root = el('div', 'screen');

  private tab: 'contracts' | 'auction' = 'contracts';

  constructor(private game: Game) {}

  available(): boolean {
    return this.game.state.level >= 5;
  }

  hasNews(): boolean {
    const trade = this.game.state.trade;
    if (trade.auction) return true;
    return trade.active.some((c) => !c.done && progressOf(c) >= 1);
  }

  refresh(): void {
    clear(this.root);
    const { game } = this;

    const grid = el('div', 'stat-grid');
    grid.appendChild(stat(money(recurringIncome(game)) + '/s', 'Vertragseinkommen'));
    grid.appendChild(
      stat(`${game.state.trade.active.length}/${ECONOMY.contracts.maxActive}`, 'Aktive Verträge'),
    );
    this.root.appendChild(grid);

    const tabs = el('div', 'btn-row');
    for (const [id, label] of [
      ['contracts', t('trade.contracts')],
      ['auction', t('trade.auction')],
    ] as [string, string][]) {
      const btn = el('button', this.tab === id ? 'primary' : 'ghost');
      btn.textContent = label;
      if (id === 'auction' && game.state.trade.auction) btn.textContent = `${label} •`;
      btn.addEventListener('click', () => {
        this.tab = id as 'contracts' | 'auction';
        this.refresh();
      });
      tabs.appendChild(btn);
    }
    this.root.appendChild(tabs);

    if (this.tab === 'contracts') this.renderContracts();
    else this.renderAuction();
  }

  // -------------------------------------------------------------------------

  private renderContracts(): void {
    const { game, root } = this;
    const trade = game.state.trade;

    root.appendChild(el('div', 'screen-title', t('trade.activeOrders')));
    if (trade.active.length === 0) {
      root.appendChild(el('div', 'empty', t('trade.noOrders')));
    }
    for (const contract of trade.active) {
      const def = Content.contract(contract.defId);
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', def?.icon ?? '📝'));

      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', def?.client ?? contract.defId));

      if (contract.done) {
        body.appendChild(
          el('div', 'card-desc', `Läuft noch ${duration(contract.incomeLeft)} · ${money(contract.income)}/s`),
        );
      } else {
        for (const entry of contract.demand) {
          const have = contract.delivered[entry.material] ?? 0;
          const stock = game.state.storage[entry.material] ?? 0;
          const mat = Content.material(entry.material);
          const line = el('div', have >= entry.amount ? 'card-desc' : 'card-note');
          line.textContent = `${mat?.icon ?? ''} ${mat?.name ?? entry.material}: ${units(have)}/${units(
            entry.amount,
          )}  (Lager ${units(stock)})`;
          body.appendChild(line);
        }
        const bar = el('div', 'xp-bar');
        const fill = el('i');
        fill.style.width = `${Math.round(progressOf(contract) * 100)}%`;
        bar.appendChild(fill);
        bar.style.marginTop = '6px';
        body.appendChild(bar);
      }
      card.appendChild(body);

      const actions = el('div', 'card-actions');
      if (!contract.done) {
        const send = el('button', 'primary', t('trade.deliver'));
        send.addEventListener('click', () => {
          deliver(game, contract.key);
          this.refresh();
        });
        actions.appendChild(send);
        const drop = el('button', 'ghost', '✕');
        drop.title = t('trade.abandon');
        drop.addEventListener('click', () => {
          abandon(game, contract.key);
          this.refresh();
        });
        actions.appendChild(drop);
      }
      card.appendChild(actions);
      root.appendChild(card);
    }

    root.appendChild(el('div', 'screen-title', t('trade.offers')));
    if (trade.offers.length === 0) {
      root.appendChild(el('div', 'empty', t('trade.noOffers')));
    }
    for (const offer of trade.offers) {
      const def = Content.contract(offer.defId);
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', def?.icon ?? '📝'));

      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', def?.client ?? offer.defId));
      body.appendChild(el('div', 'card-desc', def?.desc ?? ''));
      body.appendChild(
        el(
          'div',
          'card-desc',
          offer.demand
            .map((d) => `${Content.material(d.material)?.name ?? d.material} ${units(d.amount)}`)
            .join(' · '),
        ),
      );
      body.appendChild(
        el(
          'div',
          'card-desc',
          `Prämie ${money(offer.payout)} + ${money(offer.income)}/s für ${duration(
            ECONOMY.contracts.incomeSeconds,
          )}`,
        ),
      );
      card.appendChild(body);

      const actions = el('div', 'card-actions');
      const take = el('button', canAccept(game) ? 'primary' : '');
      take.textContent = 'Annehmen';
      take.disabled = !canAccept(game);
      take.addEventListener('click', () => {
        acceptOffer(game, offer.key);
        this.refresh();
      });
      actions.appendChild(take);
      card.appendChild(actions);
      root.appendChild(card);
    }
  }

  // -------------------------------------------------------------------------

  private renderAuction(): void {
    const { game, root } = this;
    const auction = game.state.trade.auction;

    if (!auction) {
      root.appendChild(
        el('div', 'empty', `Nächste Auktion in ${duration(game.state.trade.auctionTimer)}.`),
      );
      return;
    }

    const lot = Content.auctionLot(auction.lotId);
    const card = el('div', 'card');
    card.appendChild(el('div', 'card-icon', lot?.icon ?? '🔨'));

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', lot?.name ?? auction.lotId));
    body.appendChild(el('div', 'card-desc', lot?.desc ?? ''));

    const contents: string[] = [];
    for (const v of lot?.vehicles ?? []) {
      contents.push(`${v.count}× ${Content.vehicle(v.id)?.name ?? v.id}`);
    }
    for (const m of lot?.materials ?? []) {
      contents.push(`${units(m.amount)} ${Content.material(m.material)?.name ?? m.material}`);
    }
    body.appendChild(el('div', 'card-desc', contents.join(' · ')));
    body.appendChild(
      el('div', 'card-desc', `Geschätzter Wert: ${money(lot ? lotValue(game, lot) : auction.value)}`),
    );
    card.appendChild(body);
    root.appendChild(card);

    const status = el('div', 'card');
    const statusBody = el('div', 'card-body');
    statusBody.appendChild(el('div', 'card-title', `Aktuelles Gebot: ${money(auction.bid)}`));
    statusBody.appendChild(
      el(
        'div',
        auction.playerLeads ? 'card-desc' : 'card-note',
        auction.playerLeads ? t('trade.leading') : t('trade.outbid'),
      ),
    );
    statusBody.appendChild(el('div', 'card-desc', `Noch ${duration(Math.ceil(auction.timeLeft))}`));
    status.appendChild(statusBody);

    const actions = el('div', 'card-actions');
    const next = auction.playerLeads ? auction.bid : auction.bid + auction.increment;
    const bid = el('button', game.state.money >= next && !auction.playerLeads ? 'primary' : '');
    bid.innerHTML = `Bieten<span class="price">${money(next)}</span>`;
    bid.disabled = auction.playerLeads || game.state.money < next;
    bid.addEventListener('click', () => {
      placeBid(game);
      this.refresh();
    });
    actions.appendChild(bid);
    status.appendChild(actions);
    root.appendChild(status);

    root.appendChild(
      el(
        'div',
        'card-desc',
        `Tipp: Die Konkurrenz steigt irgendwann aus. Wer über ${fmt(
          ECONOMY.auctions.aiMaxFactor[1] * 100,
          0,
        )} % des Schätzwerts bietet, zahlt am Ende drauf.`,
      ),
    );
  }
}

function stat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}
