import { ImageResponse } from 'next/og';
import { getSiteUrl } from '@/core/seo';

export const runtime = 'edge';
export const alt = 'CSES Better — a focused CSES practice workspace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#080d13', color: '#f1f5f9', padding: '72px', fontFamily: 'Arial', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: 28, fontWeight: 700 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7dd3fc', color: '#080d13', fontSize: 25 }}>C</div>
          CSES Better
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 950 }}>
          <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.05, letterSpacing: '-4px', fontWeight: 700 }}>A calmer way to solve CSES.</div>
          <div style={{ display: 'flex', fontSize: 28, lineHeight: 1.4, color: '#cbd5e1' }}>Practice with an integrated editor, test runner, notes, and progress tracking.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20, color: '#7dd3fc' }}>
          <div style={{ display: 'flex', background: '#7dd3fc', width: 12, height: 12, borderRadius: 6 }} /> Practice at {getSiteUrl().host}
        </div>
      </div>
    ),
    size,
  );
}
