/**
 * Marks part of a screen as editable in the admin panel's visual editor.
 * In the real app this renders its children untouched (no extra view, no cost).
 *
 *  id       what gets selected, e.g. "home.sections.3" or "categories.items.0"
 *  label    name shown on the highlight
 *  target   content path a drag-resize changes, e.g. "theme.layout.heroCardHeight"
 *  base     the target's current value (resizing scales it)
 *  invert   true when the value gets smaller as the element gets taller (width ÷ height ratios)
 */
import React, { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { IN_EDITOR } from '../config/remote';

type Props = { id: string; label: string; target?: string; base?: number; invert?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode };

export function Editable({ id, label, target, base, invert, style, children }: Props) {
  if (!IN_EDITOR) return style ? <View style={style}>{children}</View> : <>{children}</>;
  const dataSet: Record<string, string> = { edit: id, editLabel: label };
  if (target && base != null) {
    dataSet.editTarget = target;
    dataSet.editBase = String(base);
    if (invert) dataSet.editInvert = '1';
  }
  // react-native-web turns dataSet into data-* attributes the editor overlay reads.
  return <View {...({ dataSet } as any)} style={style}>{children}</View>;
}

export const inEditor = IN_EDITOR;
