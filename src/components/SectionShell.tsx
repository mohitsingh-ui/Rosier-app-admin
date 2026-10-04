/**
 * Wraps every home section: its background colour, extra space, entrance animation
 * (all set per section in the admin panel), and the click-to-edit target in the preview.
 */
import React, { ReactNode } from 'react';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInLeft, SlideInRight, ZoomIn } from 'react-native-reanimated';
import { useReplay } from '../lib/editorBridge';
import { Editable } from './Editable';

const ANIMS: Record<string, any> = {
  fadeUp: FadeInDown,
  fadeDown: FadeInUp,
  fade: FadeIn,
  zoom: ZoomIn,
  slideLeft: SlideInRight,
  slideRight: SlideInLeft,
};

const LABELS: Record<string, string> = {
  categories: 'Category icons',
  deals: 'Deals row',
  benefits: 'Benefits Club banner',
  grid: 'Product grid',
  row: 'Product row',
  promo: 'Promo strip',
  image: 'Image banner',
  reviews: 'Reviews',
  pillars: 'Rosier experience',
};

export function SectionShell({ sec, index, width, imageHeight, children }: { sec: any; index: number; width: number; imageHeight?: number; children: ReactNode }) {
  const id = `home.sections.${index}`;
  const replay = useReplay((s) => s.n[id] ?? 0);
  const anim = ANIMS[sec.animation ?? ''];
  const speed = Math.min(4, Math.max(0.25, Number(sec.animSpeed) || 1));
  const entering = anim && sec.animation !== 'none' ? anim.duration(Math.round(500 / speed)) : undefined;
  const bg = typeof sec.bg === 'string' && sec.bg.trim() ? sec.bg.trim() : undefined;
  const above = Number(sec.spaceAbove) || 0;
  const below = Number(sec.spaceBelow) || 0;
  const label = `${LABELS[sec.type] ?? 'Section'}${sec.title ? ` · ${sec.title}` : ''}`;
  // Image banners can be resized by dragging in the preview.
  const resize = sec.type === 'image' ? { target: `home.sections.${index}.height`, base: imageHeight && imageHeight > 0 ? imageHeight : Math.round((width - 40) / 2) } : {};
  return (
    <Editable id={id} label={label} {...resize}>
      <Animated.View
        key={replay}
        entering={entering}
        style={{
          marginTop: above,
          paddingBottom: below + (bg ? 18 : 0),
          backgroundColor: bg,
          ...(bg ? { marginHorizontal: 0, paddingTop: 2 } : {}),
        }}
      >
        {children}
      </Animated.View>
    </Editable>
  );
}
