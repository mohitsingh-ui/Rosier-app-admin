/**
 * Rosier Coins rules. Defaults live in `defaults.json` (section "coins") and are
 * replaced by whatever is published from the admin panel (see `remote.ts`).
 */
import defaults from './defaults.json';

export type Voucher = { id: string; value: number; cost: number; code: string; tint: string };

type CoinRules = {
  earnPerRupee: number;
  reviewBonus: number;
  referralBonus: number;
  welcomeBonus: number;
  pendingDays: number;
  minCartForVoucher: number;
  vouchers: Voucher[];
};

const pick = (c: typeof defaults.coins): CoinRules => ({
  earnPerRupee: Number(c.earnPerRupee) || 0,
  reviewBonus: Number(c.reviewBonus) || 0,
  referralBonus: Number(c.referralBonus) || 0,
  welcomeBonus: Number(c.welcomeBonus) || 0,
  pendingDays: Number(c.pendingDays) || 0,
  minCartForVoucher: Number(c.minCartForVoucher) || 0,
  vouchers: (c.vouchers ?? [])
    .filter((v) => v && v.id && v.cost > 0)
    .map((v) => ({ id: String(v.id), value: Number(v.value), cost: Number(v.cost), code: String(v.code ?? ''), tint: String(v.tint ?? 'brown') }))
    .sort((a, b) => a.cost - b.cost),
});

/** Live coin rules. Mutated in place when new content arrives, so every import sees the latest. */
export const COINS: CoinRules = pick(defaults.coins);

export function applyCoins(c: typeof defaults.coins) {
  Object.assign(COINS, pick(c));
}

export const coinsForAmount = (rupees: number) => Math.floor(rupees * COINS.earnPerRupee);
