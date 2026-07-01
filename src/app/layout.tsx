import type { Metadata } from 'next';
import FirebaseAnalytics from './components/FirebaseAnalytics';
import './globals.css';

export const metadata: Metadata = {
  title: 'Swim Log',
  description: '수영 기록부터 목표 관리, AI 코칭까지 한곳에서 관리하는 나만의 수영 캘린더',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <FirebaseAnalytics />
        {children}
      </body>
    </html>
  );
}
