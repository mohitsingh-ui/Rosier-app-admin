/**
 * Is the logged-in customer a Rosier member, and until when?
 *
 * A customer is a member if they bought the membership product (in the app or on
 * rosierfoods.com — we read their Shopify orders) or their Shopify customer has one
 * of the member tags set in the admin panel. The plan length comes from the variant
 * they bought ("3 Months", "6 Months", "12 Months").
 */
import { useMemo } from 'react';
import { getContent, useContent } from '../config/remote';
import { Customer, ShopOrder, useAuth, useLoggedIn } from '../store/auth';

export type Membership = {
  active: boolean;
  /** Bought before but the plan has ended. */
  expired: boolean;
  plan: string;
  since: number | null;
  until: number | null;
  daysLeft: number | null;
  viaTag: boolean;
  /** Orders placed since joining (not the membership itself). */
  orders: ShopOrder[];
  spent: number;
};

const NONE: Membership = { active: false, expired: false, plan: '', since: null, until: null, daysLeft: null, viaTag: false, orders: [], spent: 0 };

function addMonths(t: number, months: number) {
  const d = new Date(t);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function membershipOf(c: Customer | null, cfg = getContent('benefits')): Membership {
  if (!c) return NONE;
  const pid = String(cfg.membershipProductId || '').trim();
  const isMembershipLine = (li: ShopOrder['items'][number]) => (pid && li.productId === pid) || /^membership\b/i.test(li.title.trim());
  // Every membership purchase, oldest first (renewals extend from the end of the last plan).
  const buys = c.orders
    .filter((o) => !o.cancelled && o.items.some(isMembershipLine))
    .sort((a, b) => Date.parse(a.processedAt) - Date.parse(b.processedAt));
  let since: number | null = null;
  let until: number | null = null;
  let plan = '';
  for (const o of buys) {
    const li = o.items.find(isMembershipLine)!;
    const months = (parseInt(li.variant, 10) || 12) * (li.qty || 1);
    const at = Date.parse(o.processedAt);
    const start = until && until > at ? until : at;
    if (!since || (until && at > until)) since = at;
    until = addMonths(start, months);
    plan = li.variant || plan;
  }
  const tags = (c.tags ?? []).map((t) => t.toLowerCase().trim());
  const memberTags = (cfg.memberTags ?? []).map((t: string) => t.toLowerCase().trim()).filter(Boolean);
  const viaTag = tags.some((t) => memberTags.includes(t));
  const now = Date.now();
  const byPurchase = !!until && until > now;
  const active = byPurchase || viaTag;
  if (!active && !buys.length) return NONE;
  const from = since ?? 0;
  const orders = c.orders.filter((o) => !o.cancelled && Date.parse(o.processedAt) >= from && !o.items.every(isMembershipLine));
  const spent = orders.reduce((n, o) => n + (o.total || 0), 0);
  return {
    active,
    expired: !active && buys.length > 0,
    plan,
    since: since ?? (viaTag && c.since ? Date.parse(c.since) : null),
    until: byPurchase || !active ? until : null,
    daysLeft: until ? Math.max(0, Math.ceil((until - now) / 86400000)) : null,
    viaTag,
    orders,
    spent,
  };
}

export function useMembership(): Membership {
  const loggedIn = useLoggedIn();
  const customer = useAuth((s) => s.customer);
  const cfg = useContent('benefits');
  return useMemo(() => (loggedIn ? membershipOf(customer, cfg) : NONE), [loggedIn, customer, cfg]);
}
