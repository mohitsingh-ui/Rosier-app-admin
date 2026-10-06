/**
 * Shopify customer login — the same account people use on rosierfoods.com.
 *
 * Login runs through our backend (it holds the Shopify secret): the backend sends
 * people to Shopify's sign-in page, then hands the app a one-time ticket that we
 * swap for tokens. Tokens live in the phone's secure storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { coinsForAmount } from '../config/coins';
import { API_URL, useRemote } from '../config/remote';
import { useApp } from './app';
import { useCoins } from './shop';
import { storage } from './storage';

export type Shipment = {
  status: string;
  /** Latest courier status, e.g. IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED. */
  latest: string | null;
  createdAt: string | null;
  eta: string | null;
  company: string;
  number: string;
  url: string;
  events: { at: string; status: string }[];
};

export type ShopOrder = {
  id: string;
  name: string;
  number: number;
  processedAt: string;
  cancelled: boolean;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  statusPageUrl: string;
  total: number;
  subtotal: number;
  shipping?: number;
  address?: string;
  shipments?: Shipment[];
  items: { title: string; variant: string; qty: number; price: number; total: number; image: string; productId: string | null; variantId: string | null }[];
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  imageUrl: string;
  address: string;
  /** Shopify customer tags (used to spot members). */
  tags?: string[];
  since?: string | null;
  orders: ShopOrder[];
};

type Tokens = { accessToken: string; refreshToken: string | null; expiresAt: number; idToken?: string | null };

/* Tokens: secure storage on phones (web preview falls back to local storage). */
const secure = createJSONStorage(() =>
  Platform.OS === 'web'
    ? AsyncStorage
    : { getItem: (k: string) => SecureStore.getItemAsync(k), setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v), removeItem: (k: string) => SecureStore.deleteItemAsync(k) },
);

type TokenState = { tokens: Tokens | null };
const useTokens = create<TokenState>()(persist((): TokenState => ({ tokens: null }), { name: 'rosier-auth', storage: secure }));

type AuthState = {
  customer: Customer | null;
  loggedInAt: number;
  /** Shopify orders we've already given coins for. */
  credited: string[];
  loading: boolean;
};

export const useAuth = create<AuthState>()(
  persist((): AuthState => ({ customer: null, loggedInAt: 0, credited: [], loading: false }), {
    name: 'rosier-customer',
    storage,
    partialize: ({ loading, ...rest }) => rest,
  }),
);

export function useLoggedIn() {
  const hasToken = useTokens((s) => !!s.tokens);
  const hasCustomer = useAuth((s) => !!s.customer);
  return hasToken && hasCustomer;
}
export const useShopifyFlags = () => useRemote((s) => s.shopify);
export const getShopifyFlags = () => useRemote.getState().shopify;

const api = () => useRemote.getState().preview?.api || API_URL;

export async function apiPost<T>(path: string, body: object): Promise<T> {
  return post<T>(path, body);
}

async function post<T>(path: string, body: object, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${api()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'Something went wrong'), { status: res.status });
  return json as T;
}

/** A fresh access token, refreshing it if needed. Null when logged out. */
export async function validToken(): Promise<string | null> {
  const t = useTokens.getState().tokens;
  if (!t) return null;
  if (t.expiresAt - 60_000 > Date.now()) return t.accessToken;
  try {
    const next = await post<Tokens>('/api/auth/refresh', { refreshToken: t.refreshToken });
    useTokens.setState({ tokens: { accessToken: next.accessToken, refreshToken: next.refreshToken ?? t.refreshToken, expiresAt: next.expiresAt, idToken: next.idToken ?? t.idToken ?? null } });
    return next.accessToken;
  } catch (e: any) {
    if (e?.status && e.status < 500) logout();
    return null;
  }
}

/** Opens Shopify's sign-in page. Resolves true once the person is logged in. */
/** The in-app login window (phones): opened by login(), drawn by <LoginHost/> in the root layout. */
export const useLoginHost = create<{ open: boolean; email: string; resolve: ((ok: boolean) => void) | null; reject: ((e: Error) => void) | null }>(() => ({ open: false, email: '', resolve: null, reject: null }));

/**
 * Logs in with their Shopify account. On phones this happens inside the app
 * (in-app window + code auto-fill); on the web preview it uses a popup.
 */
export async function login(email?: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    return new Promise<boolean>((resolve, reject) => useLoginHost.setState({ open: true, email: (email ?? useApp.getState().email ?? '').trim(), resolve, reject }));
  }
  const { start, redirect } = loginUrls();
  const result = await WebBrowser.openAuthSessionAsync(start, redirect);
  if (result.type !== 'success' || !result.url) return false;
  return completeLogin(result.url);
}

/** Where the in-app login starts, and the app link Shopify sends people back to. */
export function loginUrls(email = '') {
  const redirect = Linking.createURL('auth');
  const e = email.trim();
  return { redirect, start: `${api()}/auth/shopify/start?redirect=${encodeURIComponent(redirect)}${e ? `&email=${encodeURIComponent(e)}` : ''}` };
}

/** Finishes the login from the link Shopify sent back (…?ticket=…). */
export async function completeLogin(url: string): Promise<boolean> {
  const { queryParams } = Linking.parse(url);
  const ticket = queryParams?.ticket ? String(queryParams.ticket) : '';
  if (!ticket) {
    if (queryParams?.error) throw new Error(String(queryParams.error));
    return false;
  }
  const tokens = await post<Tokens>('/api/auth/ticket', { ticket });
  useTokens.setState({ tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, idToken: tokens.idToken ?? null } });
  useAuth.setState({ loggedInAt: Date.now() });
  const c = await loadCustomer({ firstLogin: true });
  if (c) {
    // Use their Shopify details in the app.
    const app = useApp.getState();
    app.setProfile({ name: c.firstName || c.name || app.name, email: c.email || app.email, phone: c.phone || app.phone });
  }
  return !!c;
}

export function logout() {
  useTokens.setState({ tokens: null });
  useAuth.setState({ customer: null, loggedInAt: 0 });
}

/**
 * Logout button: forgets the login in the app AND signs them out of their Shopify
 * account (the same account as rosierfoods.com), so the next login asks again.
 */
export async function signOut() {
  const idToken = useTokens.getState().tokens?.idToken ?? null;
  const hadLogin = hasTokens();
  logout();
  // Phones log in through a private in-app window, so there's no Shopify session left to close.
  if (!hadLogin || Platform.OS !== 'web') return;
  // Let the screen change finish first — opening the browser in the middle of a navigation can crash on Android.
  await new Promise((r) => setTimeout(r, 450));
  try {
    const appRedirect = Linking.createURL('auth');
    const { url } = await post<{ url: string | null }>('/api/auth/logout', { idToken, redirect: appRedirect });
    if (!url) return;
    if (Platform.OS === 'web') await WebBrowser.openBrowserAsync(url);
    else await WebBrowser.openAuthSessionAsync(url, appRedirect);
  } catch {
    // Offline: they're still logged out of the app.
  }
}

/**
 * Loads the customer + their orders from Shopify, and gives Rosier Coins for any
 * new order placed since they logged in (in the app or on the website).
 * Returns the customer, or null if they're logged out.
 */
export async function loadCustomer({ firstLogin = false } = {}): Promise<Customer | null> {
  const token = await validToken();
  if (!token) return null;
  useAuth.setState({ loading: true });
  try {
    const res = await fetch(`${api()}/api/customer/me`, { headers: { 'X-Customer-Token': token } });
    if (res.status === 401) {
      logout();
      return null;
    }
    if (!res.ok) return useAuth.getState().customer;
    const c = (await res.json()) as Customer;
    const s = useAuth.getState();
    if (firstLogin) {
      // Orders from before they logged in to the app don't earn coins again.
      const known = new Set(s.credited);
      c.orders.forEach((o) => known.add(o.id));
      useAuth.setState({ customer: c, credited: [...known] });
    } else useAuth.setState({ customer: c });
    return c;
  } catch {
    return useAuth.getState().customer; // offline — keep what we have
  } finally {
    useAuth.setState({ loading: false });
  }
}

/** Gives pending coins for orders we haven't credited yet. Returns the newly credited orders. */
export function creditNewOrders(): { order: ShopOrder; coins: number }[] {
  const s = useAuth.getState();
  if (!s.customer) return [];
  const done = new Set(s.credited);
  const out: { order: ShopOrder; coins: number }[] = [];
  for (const o of s.customer.orders) {
    if (done.has(o.id) || o.cancelled) continue;
    const coins = coinsForAmount(o.subtotal || o.total);
    if (coins > 0) useCoins.getState().addPending(coins, o.name.replace(/^#/, ''));
    done.add(o.id);
    out.push({ order: o, coins });
  }
  if (out.length) useAuth.setState({ credited: [...done] });
  return out;
}

/** Shopify cart checkout with the customer logged in (falls back to guest). */
export async function createCheckout(lines: { variantId: number; qty: number }[], discountCodes: string[] = []) {
  const token = await validToken();
  const r = await post<{ checkoutUrl: string }>('/api/checkout', { lines, discountCodes, deviceId: useApp.getState().deviceId }, token ? { 'X-Customer-Token': token } : {});
  return { url: r.checkoutUrl, loggedIn: !!token };
}

export const hasTokens = () => !!useTokens.getState().tokens;

/* ───────── Saved addresses (the same list as their rosierfoods.com account) ───────── */

export type Address = { id: string; firstName: string; lastName: string; company: string; address1: string; address2: string; city: string; zoneCode: string; province: string; country: string; zip: string; phone: string; formatted: string; isDefault: boolean };
export type AddressInput = Omit<Address, 'id' | 'formatted' | 'isDefault' | 'province'>;

async function addressCall(method: string, body?: object, query = ''): Promise<Address[]> {
  const token = await validToken();
  if (!token) throw Object.assign(new Error('Please log in again.'), { status: 401 });
  const res = await fetch(`${api()}/api/customer/addresses${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Customer-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) logout();
  if (!res.ok) throw Object.assign(new Error(json.error || 'Something went wrong. Please try again.'), { status: res.status });
  return json.addresses ?? [];
}

export const fetchAddresses = () => addressCall('GET');
export const addAddress = (address: AddressInput, makeDefault = false) => addressCall('POST', { address, makeDefault });
export const editAddress = (id: string, address: AddressInput | null, makeDefault = false) => addressCall('PUT', { id, address, makeDefault });
export const removeAddress = (id: string) => addressCall('DELETE', undefined, `?id=${encodeURIComponent(id)}`);
