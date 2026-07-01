import type { Metadata } from 'next';
import FirebaseAnalytics from './components/FirebaseAnalytics';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://my-ai2-swimming-course.vercel.app'),
  title: 'Swim Log',
  description: '수영 기록부터 목표 관리, AI 코칭까지 한곳에서 관리하는 나만의 수영 캘린더',
  openGraph: {
    title: 'Swim Log',
    description: '수영 기록부터 AI 코칭까지',
    images: [
      {
        url: '/images/og-swim-log.png',
        width: 1200,
        height: 630,
        alt: 'Swim Log - 수영 기록부터 AI 코칭까지',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swim Log',
    description: '수영 기록부터 AI 코칭까지',
    images: ['/images/og-swim-log.png'],
  },
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
