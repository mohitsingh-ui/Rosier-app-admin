/**
 * Product page parts taken from rosierfoods.com (mobile view):
 *  - A+ banners (the tall picture strips under the product)
 *  - the description tabs (Product Description, Key Benefits, Nutrition…)
 *  - Judge.me reviews, with "Write a review"
 * Everything is sized and coloured from the admin panel → Product page.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContent } from '../config/remote';
import { success } from '../lib/haptics';
import { ProductExtras, Review, submitReview, useReviews } from '../lib/website';
import { useApp } from '../store/app';
import { useAuth } from '../store/auth';
import { fonts, useTheme } from '../theme';
import { Editable } from './Editable';
import { toast } from './Toast';
import { Img, PressableScale } from './ui';

const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);

export function useProductPage() {
  const c = (useContent('productPage' as any) ?? {}) as any;
  return {
    heroHeight: Math.min(90, Math.max(25, n(c.heroHeight, 58))),
    heroFit: (c.heroFit === 'cover' ? 'cover' : 'contain') as 'cover' | 'contain',
    heroBg: c.heroBg || '#F7EFE6',
    showAplus: c.showAplus !== false,
    aplusGap: n(c.aplusGap, 6),
    aplusRadius: n(c.aplusRadius, 0),
    aplusMargin: n(c.aplusMargin, 0),
    showTabs: c.showTabs !== false,
    tabsTitle: String(c.tabsTitle ?? ''),
    showReviews: c.showReviews !== false,
    reviewsTitle: c.reviewsTitle || 'Product Reviews',
    reviewsPerPage: Math.min(20, Math.max(1, n(c.reviewsPerPage, 5))),
    allowWrite: c.allowWrite !== false,
    writeButton: c.writeButton || 'Write a review',
    thanks: c.thanks || 'Thank you! Your review will show once it’s approved.',
    starColor: c.starColor || '#E1A140',
  };
}
type PP = ReturnType<typeof useProductPage>;

/* ───────── A+ banners ───────── */

function AplusImage({ uri, ratio, w, radius }: { uri: string; ratio: number; w: number; radius: number }) {
  const [r, setR] = useState(ratio || 0);
  return (
    <Img
      source={uri}
      size={w}
      style={{ width: w, height: r ? w / r : w, borderRadius: radius, backgroundColor: r ? 'transparent' : '#EFE5DA' }}
      contentFit="cover"
      onLoad={(e: any) => {
        const sw = e?.source?.width;
        const sh = e?.source?.height;
        if (sw && sh && Math.abs(sw / sh - r) > 0.01) setR(sw / sh);
      }}
    />
  );
}

export function AplusBanners({ extras, pp }: { extras: ProductExtras | null; pp: PP }) {
  const { width } = useWindowDimensions();
  if (!pp.showAplus || !extras?.aplus?.length) return null;
  const w = width - pp.aplusMargin * 2;
  return (
    <Editable id="productPage" label="A+ pictures" target="productPage.aplusGap" base={pp.aplusGap}>
      <View style={{ marginHorizontal: -20 + pp.aplusMargin, marginTop: 22, gap: pp.aplusGap }}>
        {extras.aplus.map((a, i) => (
          <AplusImage key={a.image + i} uri={a.image} ratio={a.ratio} w={w} radius={pp.aplusRadius} />
        ))}
      </View>
    </Editable>
  );
}

/* ───────── Tabs ───────── */

export function WebsiteTabs({ extras, pp }: { extras: ProductExtras | null; pp: PP }) {
  const t = useTheme();
  const [tab, setTab] = useState(0);
  if (!pp.showTabs || !extras?.tabs?.length) return null;
  const cur = extras.tabs[Math.min(tab, extras.tabs.length - 1)];
  return (
    <Editable id="productPage" label="Product details tabs">
      <View style={{ marginTop: 24 }}>
        {!!pp.tabsTitle && <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: t.heading, marginBottom: 10 }}>{pp.tabsTitle}</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {extras.tabs.map((x, i) => {
            const on = i === tab;
            return (
              <Pressable key={x.title + i} onPress={() => setTab(i)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: on ? t.primary : t.card, borderWidth: 1, borderColor: on ? t.primary : t.border }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: on ? '#fff' : t.text }}>{x.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Animated.View key={tab} entering={FadeIn.duration(220)} layout={LinearTransition} style={{ marginTop: 12, backgroundColor: t.card, borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: t.heading }}>{cur.body.replace(/^[ \t]*[-–][ \t]*/gm, '• ')}</Text>
        </Animated.View>
      </View>
    </Editable>
  );
}

/* ───────── Reviews ───────── */

export function Stars({ value, size = 14, color, onPick }: { value: number; size?: number; color: string; onPick?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onPick ? 8 : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons name={name as any} size={size} color={color} />;
        return onPick ? (
          <Pressable key={i} onPress={() => onPick(i)} hitSlop={6} accessibilityLabel={`${i} star${i > 1 ? 's' : ''}`}>
            {icon}
          </Pressable>
        ) : (
          <React.Fragment key={i}>{icon}</React.Fragment>
        );
      })}
    </View>
  );
}

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(+d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function ReviewCard({ r, pp, onPhoto }: { r: Review; pp: PP; onPhoto: (u: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Animated.View entering={FadeInDown.springify()} style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: t.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.sansSemi, color: t.primary }}>{r.initial || r.name.slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: t.text }} numberOfLines={1}>
              {r.name}
            </Text>
            {r.verified && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: t.greenSoft, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Ionicons name="checkmark-circle" size={11} color={t.green} />
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10, color: t.green }}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute }}>{fmtDate(r.at)}</Text>
        </View>
        <Stars value={r.rating} color={pp.starColor} size={13} />
      </View>
      {!!r.title && <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: t.heading, marginTop: 8 }}>{r.title}</Text>}
      {!!r.body && (
        <Pressable onPress={() => setOpen((o) => !o)}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: t.textSoft, marginTop: 4 }} numberOfLines={open ? undefined : 5}>
            {r.body}
          </Text>
        </Pressable>
      )}
      {r.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
          {r.photos.map((p) => (
            <Pressable key={p.small} onPress={() => onPhoto(p.large)}>
              <Img source={p.small} size={72} style={{ width: 72, height: 72, borderRadius: 10 }} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      {!!r.reply && (
        <View style={{ marginTop: 10, backgroundColor: t.card, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: t.primary }}>Rosier Foods replied</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft, marginTop: 2 }}>{r.reply}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export function ProductReviews({ extras, pp, title }: { extras: ProductExtras | null; pp: PP; title: string }) {
  const t = useTheme();
  const { data, reviews, loading, busy, canLoadMore, loadMore } = useReviews(extras?.productId, pp.reviewsPerPage);
  const [writing, setWriting] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  if (!pp.showReviews || !extras?.productId) return null;
  const avg = data?.average ?? extras.rating ?? 0;
  const count = data?.count ?? extras.reviewCount ?? 0;
  const allPhotos = reviews.flatMap((r) => r.photos).slice(0, 12);

  return (
    <Editable id="productPage" label="Reviews">
      <View style={{ marginTop: 28 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: t.heading }}>{pp.reviewsTitle}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, backgroundColor: t.card, borderRadius: 18, padding: 16 }}>
          <View style={{ alignItems: 'center', minWidth: 86 }}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 34, color: t.text }}>{avg ? avg.toFixed(1) : '–'}</Text>
            <Stars value={avg} color={pp.starColor} size={14} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: t.textMute, marginTop: 4 }}>{count} review{count === 1 ? '' : 's'}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {[5, 4, 3, 2, 1].map((s) => {
              const h = data?.histogram.find((x) => x.rating === s);
              const pct = h ? h.percent : 0;
              return (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textSoft, width: 10 }}>{s}</Text>
                  <Ionicons name="star" size={10} color={pp.starColor} />
                  <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: t.border, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pp.starColor }} />
                  </View>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: t.textMute, width: 28, textAlign: 'right' }}>{h?.count ?? 0}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {!!data?.summary && (
          <View style={{ marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={14} color={pp.starColor} />
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: t.text }}>What customers say</Text>
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: t.textSoft, marginTop: 4 }}>{data.summary}</Text>
          </View>
        )}

        {pp.allowWrite && (
          <PressableScale onPress={() => setWriting(true)} style={{ marginTop: 12, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: t.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Ionicons name="create-outline" size={18} color={t.primary} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: t.primary }}>{pp.writeButton}</Text>
          </PressableScale>
        )}

        {allPhotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {allPhotos.map((p) => (
              <Pressable key={p.small} onPress={() => setPhoto(p.large)}>
                <Img source={p.small} size={84} style={{ width: 84, height: 84, borderRadius: 12 }} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {loading && !reviews.length ? <ActivityIndicator color={t.primary} style={{ marginTop: 20 }} /> : null}
        {reviews.map((r) => (
          <ReviewCard key={r.id} r={r} pp={pp} onPhoto={setPhoto} />
        ))}
        {!loading && !reviews.length && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textMute, marginTop: 14 }}>No reviews yet — be the first to write one.</Text>}
        {canLoadMore && (
          <PressableScale onPress={() => loadMore().catch(() => toast('Couldn’t load more reviews', 'info'))} style={{ marginTop: 14, alignSelf: 'center', paddingHorizontal: 22, height: 40, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={t.primary} /> : <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: t.text }}>Show more reviews</Text>}
          </PressableScale>
        )}
      </View>

      <WriteReview visible={writing} onClose={() => setWriting(false)} productId={extras.productId} title={title} pp={pp} />
      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable onPress={() => setPhoto(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {!!photo && <Img source={photo} style={{ width: '94%', height: '80%' }} contentFit="contain" />}
        </Pressable>
      </Modal>
    </Editable>
  );
}

/* ───────── Write a review ───────── */

function WriteReview({ visible, onClose, productId, title, pp }: { visible: boolean; onClose: () => void; productId: string; title: string; pp: PP }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const customer = useAuth((s) => s.customer);
  const profile = { name: useApp((s) => s.name), email: useApp((s) => s.email) };
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [head, setHead] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const onShow = () => {
    setName((v) => v || customer?.name || profile.name || '');
    setEmail((v) => v || customer?.email || profile.email || '');
    setErr('');
    setDone(false);
  };

  const send = async () => {
    setErr('');
    if (!rating) return setErr('Please tap the stars to rate.');
    if (!name.trim()) return setErr('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Please enter a valid email.');
    if (body.trim().length < 3) return setErr('Please write a few words about the product.');
    setSending(true);
    try {
      await submitReview({ productId, name: name.trim(), email: email.trim(), rating, title: head.trim(), body: body.trim() });
      success();
      setDone(true);
      setRating(0);
      setHead('');
      setBody('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const input = { fontFamily: fonts.sans, fontSize: 15, color: t.text, backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: t.border } as const;
  const label = { fontFamily: fonts.sansMedium, fontSize: 12.5, color: t.textMute, marginTop: 14, marginBottom: 6 } as const;

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={onShow} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: t.cardStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontFamily: fonts.serif, fontSize: 20, color: t.heading }}>{pp.writeButton}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={t.textSoft} />
              </Pressable>
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textMute, marginTop: 2 }} numberOfLines={2}>
              {title}
            </Text>
            {done ? (
              <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
                <Ionicons name="checkmark-circle" size={56} color={t.green} />
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text, textAlign: 'center' }}>{pp.thanks}</Text>
                <PressableScale onPress={onClose} style={{ marginTop: 8, paddingHorizontal: 28, height: 46, borderRadius: 14, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemi, color: '#fff' }}>Done</Text>
                </PressableScale>
              </Animated.View>
            ) : (
              <>
                <Text style={label}>Your rating</Text>
                <Stars value={rating} size={34} color={pp.starColor} onPick={setRating} />
                <Text style={label}>Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={t.textMute} style={input} autoComplete="name" />
                <Text style={label}>Email (not shown)</Text>
                <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={t.textMute} style={input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <Text style={label}>Review title (optional)</Text>
                <TextInput value={head} onChangeText={setHead} placeholder="Give it a heading" placeholderTextColor={t.textMute} style={input} maxLength={100} />
                <Text style={label}>Your review</Text>
                <TextInput value={body} onChangeText={setBody} placeholder="How did you like it?" placeholderTextColor={t.textMute} style={[input, { minHeight: 110, textAlignVertical: 'top' }]} multiline maxLength={2000} />
                {!!err && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: '#C0392B', marginTop: 10 }}>{err}</Text>}
                <PressableScale onPress={send} disabled={sending} style={{ marginTop: 18, height: 52, borderRadius: 16, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.7 : 1 }}>
                  {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: '#fff' }}>Submit review</Text>}
                </PressableScale>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
