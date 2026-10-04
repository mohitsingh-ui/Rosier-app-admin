/**
 * Order tracking: a 5-step timeline (placed → packed → shipped → out for delivery →
 * delivered), the courier + tracking number, and the full courier history.
 * Works with Shopify data from the logged-in customer's orders or the guest lookup.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useContent } from '../config/remote';
import { rupee, shortTitle } from '../lib/format';
import type { Shipment } from '../store/auth';
import { fonts, useTheme } from '../theme';
import { Button, Img } from './ui';

export type TrackOrder = {
  name: string;
  processedAt: string;
  cancelled: boolean;
  fulfillmentStatus: string | null;
  statusPageUrl?: string;
  total?: number;
  address?: string;
  shipments?: Shipment[];
  items?: { title: string; variant?: string; qty: number; image?: string }[];
};

const LEVEL: Record<string, number> = {
  CONFIRMED: 1,
  SUBMITTED: 1,
  LABEL_PURCHASED: 1,
  LABEL_PRINTED: 1,
  CARRIER_PICKED_UP: 2,
  IN_TRANSIT: 2,
  DELAYED: 2,
  FULFILLED: 2,
  MARKED_AS_FULFILLED: 2,
  ATTEMPTED_DELIVERY: 3,
  OUT_FOR_DELIVERY: 3,
  READY_FOR_PICKUP: 3,
  DELIVERED: 4,
  PICKED_UP: 4,
};

const LABEL: Record<string, string> = {
  CONFIRMED: 'Order confirmed',
  SUBMITTED: 'Sent to warehouse',
  LABEL_PURCHASED: 'Shipping label created',
  LABEL_PRINTED: 'Packed & label printed',
  CARRIER_PICKED_UP: 'Picked up by courier',
  IN_TRANSIT: 'In transit',
  DELAYED: 'Delayed',
  FULFILLED: 'Shipped',
  MARKED_AS_FULFILLED: 'Shipped',
  ATTEMPTED_DELIVERY: 'Delivery attempted',
  OUT_FOR_DELIVERY: 'Out for delivery',
  READY_FOR_PICKUP: 'Ready for pickup',
  DELIVERED: 'Delivered',
  PICKED_UP: 'Picked up',
  FAILURE: 'Delivery problem',
  NOT_DELIVERED: 'Not delivered',
};

export const eventLabel = (s: string) => LABEL[s] ?? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const fmt = (d?: string | null, time = false) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) }) : '';

/** Where the order is: 0 placed … 4 delivered, plus any problem. */
export function trackState(o: TrackOrder) {
  const ships = o.shipments ?? [];
  const statuses = ships.flatMap((s) => [s.latest, ...s.events.map((e) => e.status)]).filter(Boolean) as string[];
  let level = 0;
  if (ships.length || ['IN_PROGRESS', 'PARTIALLY_FULFILLED', 'FULFILLED', 'SCHEDULED'].includes(o.fulfillmentStatus ?? '')) level = 1;
  if (ships.some((s) => s.number || s.url) || o.fulfillmentStatus === 'FULFILLED') level = Math.max(level, 2);
  for (const s of statuses) level = Math.max(level, LEVEL[s] ?? 0);
  const latest = ships.map((s) => s.latest).find(Boolean) ?? statuses[statuses.length - 1] ?? null;
  const problem = latest && ['DELAYED', 'FAILURE', 'ATTEMPTED_DELIVERY', 'NOT_DELIVERED'].includes(latest) ? latest : null;
  // When each step happened (first event that reached it).
  const at: (string | null)[] = [o.processedAt, ships[0]?.createdAt ?? null, null, null, null];
  for (const e of ships.flatMap((s) => s.events).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const l = LEVEL[e.status];
    if (l != null && !at[l]) at[l] = e.at;
  }
  const eta = ships.map((s) => s.eta).find(Boolean) ?? null;
  return { level, latest, problem, at, eta };
}

/** Short status for order lists. */
export function trackSummary(o: TrackOrder): { label: string; tone: 'green' | 'gold' | 'danger' } {
  if (o.cancelled) return { label: 'Cancelled', tone: 'danger' };
  const s = trackState(o);
  if (s.problem) return { label: eventLabel(s.problem), tone: 'danger' };
  return { label: ['Being packed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'][s.level], tone: s.level === 4 ? 'green' : 'gold' };
}

function courierLink(s: Shipment, template: string) {
  if (s.url) return s.url;
  if (s.number && template.includes('{number}')) return template.replace('{number}', encodeURIComponent(s.number));
  return '';
}

const open = (url: string) => WebBrowser.openBrowserAsync(url, { toolbarColor: '#3E2415', controlsColor: '#F3D48B' });

export function TrackingView({ order }: { order: TrackOrder }) {
  const t = useTheme();
  const cfg = useContent('tracking');
  const st = trackState(order);
  const steps = [cfg.steps.ordered, cfg.steps.confirmed, cfg.steps.shipped, cfg.steps.out, cfg.steps.delivered];
  const card = { backgroundColor: t.cardStrong, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.border } as const;
  const ships = order.shipments ?? [];
  const history = ships
    .flatMap((s) => s.events)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <View style={{ gap: 14 }}>
      {/* Headline */}
      <Animated.View entering={FadeInDown.springify()} style={[card, { backgroundColor: t.deep, borderColor: t.deep }]}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#C9B8A8' }}>
          Order {order.name} · {fmt(order.processedAt)}
        </Text>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: '#FBE6CF', marginTop: 4 }}>
          {order.cancelled ? 'Cancelled' : st.problem ? eventLabel(st.problem) : steps[st.level]}
        </Text>
        {!order.cancelled && st.level < 4 && st.eta && (
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: '#F3D48B', marginTop: 4 }}>Expected by {fmt(st.eta)}</Text>
        )}
        {!order.cancelled && st.level === 4 && st.at[4] && <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: '#9BD49B', marginTop: 4 }}>Delivered on {fmt(st.at[4], true)}</Text>}
      </Animated.View>

      {/* Timeline */}
      {!order.cancelled && (
        <Animated.View entering={FadeInDown.delay(60).springify()} style={card}>
          {steps.map((label, i) => {
            const done = i <= st.level;
            const current = i === st.level && i < 4;
            const last = i === steps.length - 1;
            const color = st.problem && current ? t.danger : t.green;
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center', width: 24 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? color : t.card, borderWidth: done ? 0 : 2, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
                    {done && <MaterialCommunityIcons name={current && st.problem ? 'alert' : 'check'} size={15} color="#fff" />}
                  </View>
                  {!last && <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: i < st.level ? t.green : t.border }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
                  <Text style={{ fontFamily: done ? fonts.sansSemi : fonts.sans, fontSize: 14.5, color: done ? t.text : t.textMute }}>{label}</Text>
                  {done && st.at[i] ? <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>{fmt(st.at[i], true)}</Text> : null}
                </View>
              </View>
            );
          })}
          {!!cfg.help && <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft, marginTop: 12 }}>{cfg.help}</Text>}
        </Animated.View>
      )}

      {/* Courier */}
      {ships
        .filter((s) => s.company || s.number || s.url)
        .map((s, i) => {
          const link = courierLink(s, cfg.websiteTrackUrl || '');
          return (
            <Animated.View key={i} entering={FadeInDown.delay(50).springify()} style={card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={22} color={t.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>{s.company || 'Courier'}</Text>
                  {!!s.number && (
                    <Text selectable style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.textSoft, letterSpacing: 0.4 }}>
                      Tracking no. {s.number}
                    </Text>
                  )}
                </View>
              </View>
              {!!link && <Button small label="Live tracking on courier site" icon="navigate-outline" onPress={() => open(link)} style={{ marginTop: 12 }} />}
            </Animated.View>
          );
        })}

      {/* Courier history */}
      {history.length > 0 && (
        <Animated.View entering={FadeInDown.delay(70).springify()} style={card}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: t.heading, marginBottom: 8 }}>Shipment updates</Text>
          {history.map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: t.border }}>
              <MaterialCommunityIcons name="circle-medium" size={18} color={i === 0 ? t.green : t.textMute} />
              <Text style={{ flex: 1, fontFamily: i === 0 ? fonts.sansSemi : fonts.sans, fontSize: 13.5, color: t.text }}>{eventLabel(e.status)}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>{fmt(e.at, true)}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Items & address */}
      {(order.items?.length || order.address) && (
        <Animated.View entering={FadeInDown.delay(90).springify()} style={card}>
          {(order.items ?? []).map((it, k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Img source={it.image} size={44} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: t.card }} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: t.text }}>
                {shortTitle(it.title)}
                {it.variant ? ` · ${it.variant}` : ''} × {it.qty}
              </Text>
            </View>
          ))}
          {order.total != null && <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: t.text, marginTop: 4 }}>Total {rupee(order.total)}</Text>}
          {!!order.address && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={t.textMute} />
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: t.textSoft }}>{order.address}</Text>
            </View>
          )}
        </Animated.View>
      )}

      {!!order.statusPageUrl && <Button kind="ghost" small label="Invoice & full order details" icon="document-text-outline" onPress={() => open(order.statusPageUrl!)} />}
    </View>
  );
}
