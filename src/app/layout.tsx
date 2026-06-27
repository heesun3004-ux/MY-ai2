import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '수영 여행 - 당신의 수영이 지도 위 여행이 된다',
  description: '수영 기록 앱 & 멀티플레이어 수영 게임',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}