import React from 'react';
import { Img } from './ui';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

const B = '#7E3F18';
const L = '#F4E3CF';

export function CategoryIcon({ name, size = 40, color = B, image }: { name: string; size?: number; color?: string; image?: string }) {
  // A custom icon uploaded in the admin panel wins over the built-in drawing.
  if (image) return <Img source={image} size={size} style={{ width: size, height: size }} contentFit="contain" />;
  const c = color;
  const common = { width: size, height: size, viewBox: '0 0 48 48' };
  switch (name) {
    case 'ghee':
      return (
        <Svg {...common}>
          <Path d="M13 6h22l3 6-3 3H13l-3-3z" fill={c} />
          <Path d="M14 15h20c2 0 4 2 4 4v21c0 3-2 5-5 5H15c-3 0-5-2-5-5V19c0-2 2-4 4-4z" fill={c} />
          <Rect x="14" y="22" width="20" height="13" rx="3" fill={L} opacity={0.35} />
          <Path d="M16 11h16" stroke={L} strokeWidth={1.4} strokeDasharray="2 2" />
        </Svg>
      );
    case 'atta':
      return (
        <Svg {...common}>
          <Path d="M12 6h24l2 5-2 3 3 27c0 2-1 3-3 3H12c-2 0-3-1-3-3l3-27-2-3z" fill={c} />
          <Rect x="14" y="19" width="20" height="10" rx="1.5" fill={L} />
          <SvgText x="24" y="27" fontSize="7.5" fontWeight="bold" fill={c} textAnchor="middle">ATTA</SvgText>
        </Svg>
      );
    case 'immunity':
      return (
        <Svg {...common}>
          <Path d="M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10z" fill={c} />
          <Circle cx="24" cy="23" r="9" fill="none" stroke={L} strokeWidth={2.2} />
          <Path d="M24 18v10M19 23h10" stroke={L} strokeWidth={2.6} strokeLinecap="round" />
        </Svg>
      );
    case 'breakfast':
      return (
        <Svg {...common}>
          <Rect x="24" y="6" width="17" height="26" rx="2" fill={c} />
          <Rect x="27" y="11" width="11" height="8" rx="1" fill={L} opacity={0.5} />
          <Path d="M5 26h30c0 9-6 16-15 16S5 35 5 26z" fill={c} />
          <Path d="M8 26c2-3 5-4 8-3 2-3 6-3 8 0 3-2 7-1 9 3" stroke={L} strokeWidth={1.6} fill="none" />
          <Path d="M9 16l9 9" stroke={c} strokeWidth={2.6} strokeLinecap="round" />
        </Svg>
      );
    case 'oil':
      return (
        <Svg {...common}>
          <Rect x="20" y="3" width="8" height="6" rx="1" fill={c} />
          <Path d="M19 9h10v5l5 6v20c0 3-2 5-5 5H19c-3 0-5-2-5-5V20l5-6z" fill={c} />
          <Path d="M24 22c3 4 5 7 5 9a5 5 0 0 1-10 0c0-2 2-5 5-9z" fill={L} />
        </Svg>
      );
    case 'pickle':
      return (
        <Svg {...common}>
          <Rect x="12" y="5" width="24" height="7" rx="2" fill={c} />
          <Path d="M13 13h22c2 0 3 1 3 3v24c0 3-2 5-5 5H15c-3 0-5-2-5-5V16c0-2 1-3 3-3z" fill={c} />
          <Path d="M17 34c5-10 12-13 16-12-2 8-9 12-16 12z" fill={L} />
          <Path d="M18 33c4-4 8-7 12-9" stroke={c} strokeWidth={1.2} />
        </Svg>
      );
    case 'combo':
      return (
        <Svg {...common}>
          <Rect x="7" y="18" width="34" height="8" rx="2" fill={c} />
          <Rect x="9" y="26" width="30" height="17" rx="2" fill={c} />
          <Rect x="22" y="18" width="4" height="25" fill={L} />
          <G fill="none" stroke={c} strokeWidth={3}>
            <Path d="M24 18c-3-8-12-9-12-4 0 3 6 4 12 4z" />
            <Path d="M24 18c3-8 12-9 12-4 0 3-6 4-12 4z" />
          </G>
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <Circle cx="24" cy="24" r="18" fill={c} />
        </Svg>
      );
  }
}
