import Link from 'next/link';
import TopAuthControls from './TopAuthControls';

const landingHeroImages = [
  '/images/landing-hero-pool-1.png',
  '/images/landing-hero-pool-2.png',
  '/images/landing-hero-pool-3.png',
  '/images/landing-hero-pool-4.png',
  '/images/landing-hero-pool-5.png',
  '/images/landing-hero-pool-6.png',
  '/images/landing-hero-pool-7.png',
];

const highlights = [
  {
    label: 'Calendar',
    accent: 'Photo Log',
    title: '사진과 수영 데이터를 하루 단위로 남겨요',
    desc: '거리, 소요시간, 심박수, 수영장 길이까지 기록해 나만의 수영 캘린더를 채울 수 있습니다.',
  },
  {
    label: 'Route',
    accent: '9 Regions',
    title: '전국 9개 지역 코스를 완주하듯 진행해요',
    desc: '서울부터 제주까지 지역별 5개 코스가 준비되어 있고, 기록한 거리가 코스 진행률로 쌓입니다.',
  },
  {
    label: 'Coach',
    accent: 'AI Pace',
    title: 'AI 수영 코치가 최근 기록을 읽고 조언해요',
    desc: '오늘, 이번 달, 전체 거리와 최근 기록 흐름을 바탕으로 훈련 추천과 페이스 분석을 받을 수 있습니다.',
  },
];

const steps = [
  '오늘 수영한 거리와 세부 기록을 캘린더에 저장',
  '도전할 지역과 코스를 고르고 진행률 누적',
  '이달의 목표를 체크하며 루틴 유지',
  'AI 코치에게 다음 훈련 방향 질문',
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <TopAuthControls />
      <section className="landing-hero">
        <div className="landing-hero-background" aria-hidden="true">
          {landingHeroImages.map((image, index) => (
            <span
              className="landing-hero-background-slide"
              key={image}
              style={{
                animationDelay: `${index * 2}s`,
                backgroundImage: `url(${image})`,
              }}
            />
          ))}
        </div>
        <div className="landing-hero-copy">
          <div className="app-logo-mark landing-logo-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="landing-eyebrow">Swim Log</p>
          <h1 className="landing-title">나만의 수영기록</h1>
          <p className="landing-description">
            오늘의 수영 기록이 캘린더에 쌓이고, 이달의 목표와 전국 수영일주 코스로
            이어집니다. AI 코칭으로 다음 훈련까지 자연스럽게 계획해보세요.
          </p>
         </div>

      </section>

      <section id="features" className="landing-section">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Core Features</p>
          <h2>
            수영 기록을 쌓고, 목표를 달성하세요.
            <br />
            AI 코치가 당신에게 맞는 훈련 방향을 제안합니다.
          </h2>
        </div>
        <div className="landing-feature-grid">
          {highlights.map((item) => (
            <article className="landing-feature-card" key={item.label}>
              <div className="landing-feature-topline">
                <span>{item.label}</span>
                <small>{item.accent}</small>
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-flow-section">
        <div className="landing-flow-panel">
          <div>
            <p className="landing-eyebrow">Daily Flow</p>
            <h2>오늘의 수영을 내일의 루틴으로 연결해요</h2>
          </div>
          <ol className="landing-flow-list">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-cta">
        <p className="landing-eyebrow">Ready to Swim</p>
        <h2>첫 기록부터 시작해볼까요?</h2>
        <p>앱으로 이동하면 기존 Swim Log 기능을 바로 사용할 수 있습니다.</p>
        <Link className="landing-primary-link" href="/app">
          Swim Log 열기
        </Link>
      </section>
    </main>
  );
}
