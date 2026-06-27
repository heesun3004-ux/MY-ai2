'use client';

import { useState, useEffect, useCallback } from 'react';
import { REGIONS, BADGES, getCourseName, formatDistanceExact, RegionData } from '@/lib/gameData';
import RouteMap from './components/RouteMap';
import ChatbotPopup from './components/ChatbotPopup';
import Link from 'next/link';

// 타입 정의
interface RegionProgress {
  currentCourse: number;
  currentProgress: number;
  completedCourses: boolean[];
  courseProgress: number[];
  visited: boolean;
  completed: boolean;
}

interface SwimRecord {
  region: string;
  distance: number;
  date: string;
}

interface GameState {
  currentRegion: string;
  selectedCourseRegion: string;
  selectedCourse: number | null;
  regionProgress: { [key: string]: RegionProgress };
  totalDistance: number;
  todayDistance: number;
  todayDate: string;
  monthDistance: number;
  monthKey: string;
  records: SwimRecord[];
  badges: string[];
}

const REGION_ENGLISH_NAMES: Record<string, string> = {
  '서울': 'Seoul',
  '제주': 'Jeju',
  '부산': 'Busan',
  '경주': 'Gyeongju',
  '강원': 'Gangwon',
  '목포': 'Mokpo',
  '전주': 'Jeonju',
  '광주': 'Gwangju',
  '대구': 'Daegu',
};

function formatRegionLabel(region: string): string {
  const englishName = REGION_ENGLISH_NAMES[region];
  return englishName ? `${region}(${englishName})` : region;
}

function formatProgressPercent(progressRatio: number): string {
  const percent = Math.min(Math.max(progressRatio, 0), 1) * 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
}

function getDefaultState(): GameState {
  const regionProgress: { [key: string]: RegionProgress } = {};
  for (const regionName of Object.keys(REGIONS)) {
    regionProgress[regionName] = {
      currentCourse: 0,
      currentProgress: 0,
      completedCourses: [false, false, false, false, false],
      courseProgress: [0, 0, 0, 0, 0],
      visited: false,
      completed: false,
    };
  }
  const today = new Date();
  return {
    currentRegion: '서울',
    selectedCourseRegion: '서울',
    selectedCourse: null,
    regionProgress,
    totalDistance: 0,
    todayDistance: 0,
    todayDate: today.toISOString().split('T')[0],
    monthDistance: 0,
    monthKey: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    records: [],
    badges: [],
  };
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function loadState(): GameState {
  if (typeof window === 'undefined') return getDefaultState();

  const saved = localStorage.getItem('swimmingGameState');
  if (saved) {
    const today = new Date();
    const state = { ...getDefaultState(), ...JSON.parse(saved) };
    if (state.todayDate !== getTodayString()) {
      state.todayDistance = 0;
      state.todayDate = getTodayString();
    }
    if (state.monthKey !== getMonthKey()) {
      state.monthDistance = 0;
      state.monthKey = getMonthKey();
    }
    return state;
  }
  return getDefaultState();
}

function saveState(state: GameState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('swimmingGameState', JSON.stringify(state));
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<GameState>(getDefaultState);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'passport' | 'badges'>('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  // AI 코치에게 전달할 수영 기록 요약 생성
  const buildSwimmingContext = (s: GameState): string => {
    const lines: string[] = [];
    lines.push(`- 오늘 거리: ${formatDistanceExact(s.todayDistance)}`);
    lines.push(`- 이번 달 거리: ${formatDistanceExact(s.monthDistance)}`);
    lines.push(`- 총 거리: ${formatDistanceExact(s.totalDistance)}`);
    lines.push(`- 현재 지역: ${s.currentRegion}`);
    if (s.records.length > 0) {
      lines.push('- 최근 기록 (최신순):');
      s.records.forEach((r) => {
        lines.push(`  · ${r.date} | ${r.region} | ${formatDistanceExact(r.distance)}`);
      });
      // 페이스(거리) 변화 추세 계산
      const distances = s.records.map((r) => r.distance).reverse();
      if (distances.length >= 2) {
        const recent = distances[distances.length - 1];
        const prev = distances[distances.length - 2];
        const diff = recent - prev;
        if (diff > 0) {
          lines.push(`- 최근 페이스(거리)는 이전보다 +${diff}m 증가(상승)했습니다.`);
        } else if (diff < 0) {
          lines.push(`- 최근 페이스(거리)는 이전보다 ${diff}m 감소(하락)했습니다.`);
        } else {
          lines.push('- 최근 페이스(거리)는 이전과 동일합니다.');
        }
      }
    } else {
      lines.push('- 아직 기록된 수영 기록이 없습니다.');
    }
    return lines.join('\n');
  };

  useEffect(() => {
    setMounted(true);
    // 앱 버전 업그레이드 시 기존 localStorage 데이터 초기화
    const APP_VERSION = 'v3-course-art';
    const savedVersion = localStorage.getItem('swimmingAppVersion');
    if (savedVersion !== APP_VERSION) {
      localStorage.removeItem('swimmingGameState');
      localStorage.setItem('swimmingAppVersion', APP_VERSION);
    }
    setState(loadState());
    const popupShown = localStorage.getItem('welcomePopupShown');
    setShowWelcome(popupShown !== 'true');
  }, []);

  const updateState = useCallback((updater: (prev: GameState) => GameState) => {
    setState((prev) => {
      const newState = updater(prev);
      saveState(newState);
      return newState;
    });
  }, []);

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('welcomePopupShown', 'true');
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* 환영 팝업 */}
      {showWelcome && (
        <div className="welcome-popup">
          <div className="popup-content">
            <div className="popup-icon">🏊</div>
            <h1 className="popup-title">수영 여행</h1>
            <p className="popup-subtitle">오늘의 수영이 지도 위 여행이 된다</p>
            <p className="popup-desc">당신의 수영 기록이 새로운 지역을 엽니다.</p>
            <button className="popup-btn" onClick={closeWelcome}>시작하기</button>
          </div>
        </div>
      )}

      {/* 메인 앱 컨테이너 */}
      <div className="app-container">
        {/* 헤더 */}
        <header className="app-header">
          <h1 className="app-title">🏊 수영 여행</h1>
          <p className="app-subtitle">오늘의 수영이 지도 위 여행이 된다</p>
        </header>

        {/* 멀티플레이어 게임 링크 */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <Link href="/game" style={{
            background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
            color: 'white',
            padding: '12px 25px',
            borderRadius: '25px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'inline-block'
          }}>
            🎮 멀티플레이어 게임
          </Link>
        </div>

        {/* 탭 네비게이션 */}
        <nav className="tab-nav">
          <button className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>홈</button>
          <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>지도</button>
          <button className={`tab-btn ${activeTab === 'passport' ? 'active' : ''}`} onClick={() => setActiveTab('passport')}>스탬프</button>
          <button className={`tab-btn ${activeTab === 'badges' ? 'active' : ''}`} onClick={() => setActiveTab('badges')}>배지</button>
        </nav>

        {/* 홈 탭 */}
        {activeTab === 'home' && <HomeTab state={state} updateState={updateState} onOpenChatbot={() => setShowChatbot(true)} />}

        {/* 지도 탭 */}
        {activeTab === 'map' && <MapTab state={state} updateState={updateState} setActiveTab={setActiveTab} />}

        {/* 스탬프 탭 */}
        {activeTab === 'passport' && <PassportTab state={state} />}

        {/* 배지 탭 */}
        {activeTab === 'badges' && <BadgesTab state={state} />}
      </div>

      {/* AI 수영 코치 챗봇 팝업 */}
      <ChatbotPopup
        isOpen={showChatbot}
        onClose={() => setShowChatbot(false)}
        swimmingContext={buildSwimmingContext(state)}
      />
    </>
  );
}

// 홈 탭 컴포넌트
function HomeTab({ state, updateState, onOpenChatbot }: { state: GameState; updateState: (fn: (prev: GameState) => GameState) => void; onOpenChatbot: () => void }) {
  const [distanceInput, setDistanceInput] = useState('');
  const [selectedCourseIdx, setSelectedCourseIdx] = useState<number | null>(null);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const region = state.currentRegion;
  const regionData = REGIONS[region];
  const progress = state.regionProgress[region];
  const courseIndex = progress.currentCourse;
  const courseGoal = regionData.courses[courseIndex];
  const progressPercent = Math.min((progress.currentProgress / courseGoal) * 100, 100);

  const handleSelectRegion = (regionName: string) => {
    setSelectedCourseIdx(null);
    setShowAllCourses(false);
    updateState(prev => ({
      ...prev,
      currentRegion: regionName,
      selectedCourseRegion: regionName,
    }));
  };

  const handleSaveRecord = () => {
    const distance = parseFloat(distanceInput);
    if (isNaN(distance) || distance <= 0) return;

    updateState((prev) => {
      const newState: GameState = {
        ...prev,
        badges: [...prev.badges],
        records: [...prev.records],
        regionProgress: Object.fromEntries(
          Object.entries(prev.regionProgress).map(([regionName, regionProgress]) => [
            regionName,
            {
              ...regionProgress,
              completedCourses: [...regionProgress.completedCourses],
              courseProgress: [...regionProgress.courseProgress],
            },
          ])
        ),
      };
      let remainingDistance = distance;
      const region = newState.currentRegion;
      const regionData = REGIONS[region];
      const progress = newState.regionProgress[region];

      // 배지 체크
      if (!newState.badges.includes('first_swim')) {
        newState.badges = [...newState.badges, 'first_swim'];
      }

      newState.totalDistance += remainingDistance;
      newState.todayDistance += remainingDistance;
      newState.monthDistance += remainingDistance;

      // 기록 추가
      const now = new Date();
      const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      newState.records = [{ region, distance, date: dateStr }, ...newState.records].slice(0, 5);

      // 배지 체크
      if (newState.totalDistance >= 10000 && !newState.badges.includes('total_10km')) {
        newState.badges = [...newState.badges, 'total_10km'];
      }
      if (newState.totalDistance >= 30000 && !newState.badges.includes('total_30km')) {
        newState.badges = [...newState.badges, 'total_30km'];
      }

      // 코스 진행
      while (remainingDistance > 0 && progress.currentCourse < 5) {
        const courseGoal = regionData.courses[progress.currentCourse];
        const neededDistance = courseGoal - progress.currentProgress;
        if (remainingDistance >= neededDistance) {
          remainingDistance -= neededDistance;
          progress.currentProgress = courseGoal;
          progress.courseProgress[progress.currentCourse] = courseGoal;
          progress.completedCourses[progress.currentCourse] = true;
          progress.currentCourse++;
          progress.currentProgress = 0;
          if (!newState.badges.includes('first_course')) {
            newState.badges = [...newState.badges, 'first_course'];
          }
        } else {
          progress.currentProgress += remainingDistance;
          progress.courseProgress[progress.currentCourse] += remainingDistance;
          remainingDistance = 0;
        }
      }

      if (progress.currentCourse >= 5) {
        progress.currentCourse = 4;
        progress.currentProgress = regionData.courses[4];
      }

      // 방문 체크
      if (!progress.visited && progress.completedCourses[0] && progress.completedCourses[1]) {
        progress.visited = true;
        if (!newState.badges.includes('first_visit')) {
          newState.badges = [...newState.badges, 'first_visit'];
        }
        const visitedCount = Object.values(newState.regionProgress).filter(p => p.visited).length;
        if (visitedCount >= 3 && !newState.badges.includes('visit_3')) {
          newState.badges = [...newState.badges, 'visit_3'];
        }
      }

      // 완료 체크
      if (!progress.completed && progress.completedCourses.every(c => c)) {
        progress.completed = true;
        if (!newState.badges.includes('first_complete')) {
          newState.badges = [...newState.badges, 'first_complete'];
        }
        const completedCount = Object.values(newState.regionProgress).filter(p => p.completed).length;
        if (completedCount >= 3 && !newState.badges.includes('complete_3')) {
          newState.badges = [...newState.badges, 'complete_3'];
        }
      }

      return newState;
    });

    setDistanceInput('');
  };

  const handleReset = () => {
    if (confirm('모든 기록을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      localStorage.removeItem('swimmingGameState');
      updateState(() => getDefaultState());
    }
  };

  return (
    <section id="home-tab" className="tab-content active">
      {/* 수영장 배경 섹션 */}
      <div className="pool-hero">
        <div className="pool-overlay">
          <h2 className="pool-title">오늘 얼마나 수영했나요?</h2>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="stats-card">
        <div className="stat-item">
          <span className="stat-label">오늘</span>
          <span className="stat-value">{formatDistanceExact(state.todayDistance)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">이번 달</span>
          <span className="stat-value">{formatDistanceExact(state.monthDistance)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">총 거리</span>
          <span className="stat-value">{formatDistanceExact(state.totalDistance)}</span>
        </div>
      </div>

      {/* 수영 기록 입력 */}
      <div className="input-section">
        <div className="input-group">
          <input
            type="number"
            value={distanceInput}
            onChange={(e) => setDistanceInput(e.target.value)}
            placeholder="거리 입력 (m)"
            min="0"
            step="1"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveRecord()}
          />
          <button className="btn-primary" onClick={handleSaveRecord}>기록하기</button>
        </div>
      </div>

      {/* 현재 선택 지역/코스 정보 */}
      <div className="current-region-card">
        <div className="region-header">
          <span className="region-name">{formatRegionLabel(region)}</span>
          <select
            className="region-select-pill"
            value={region}
            onChange={(e) => handleSelectRegion(e.target.value)}
            aria-label="지역 선택"
          >
            {Object.keys(REGIONS).map((regionName) => (
              <option key={regionName} value={regionName}>{formatRegionLabel(regionName)}</option>
            ))}
          </select>
        </div>

        {/* 코스 진행 상세 정보 */}
        <div className="course-progress-detail">
          <div className="course-step">{getCourseName(region, courseIndex)}</div>
          <div className="course-name">{formatRegionLabel(region)}</div>
          <div className="course-goal">목표: {formatDistanceExact(courseGoal)}</div>
        </div>

        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="progress-text">
            <span>{formatDistanceExact(progress.currentProgress)}</span> / <span>{formatDistanceExact(courseGoal)}</span>
          </div>
        </div>
      </div>

      <HomeCoursesSection
        region={region}
        regionData={regionData}
        progress={progress}
        selectedCourseIdx={selectedCourseIdx}
        setSelectedCourseIdx={setSelectedCourseIdx}
        showAllCourses={showAllCourses}
        setShowAllCourses={setShowAllCourses}
      />

      {/* 최근 기록 */}
      <div className="recent-records">
        <h3 className="section-subtitle">최근 기록</h3>
        <ul className="recent-list">
          {state.records.length === 0 ? (
            <li style={{ color: '#888', textAlign: 'center' }}>아직 기록이 없습니다. 첫 수영 기록을 입력해보세요!</li>
          ) : (
            state.records.map((r, idx) => (
              <li key={idx}>
                <div className="record-info">
                  <span className="record-region">{REGIONS[r.region]?.emoji} {r.region}</span>
                  <span className="record-date">{r.date}</span>
                </div>
                <span className="record-distance">+{formatDistanceExact(r.distance)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* AI 수영 코치 버튼 */}
      <button className="btn-ai-coach" onClick={onOpenChatbot}>
        🏊‍♂️ AI 수영 코치와 대화하기
      </button>

      {/* 초기화 버튼 */}
      <button className="btn-reset" onClick={handleReset}>모든 기록 초기화</button>
    </section>
  );
}

// 지도 탭 컴포넌트
function MapTab({ state, updateState, setActiveTab }: { state: GameState; updateState: (fn: (prev: GameState) => GameState) => void; setActiveTab: (tab: 'home' | 'map' | 'passport' | 'badges') => void }) {
  return (
    <section id="map-tab" className="tab-content active">
      <h2 className="section-title">대한민국 수영 여행 지도</h2>
      <p className="map-desc">당신의 수영 기록이 새로운 지역을 엽니다.</p>

      {/* 실제 한국 지도 이미지 */}
      <div className="custom-map image-map">
        <div className="map-image-wrapper">
          <img src="/swim-map.png" alt="대한민국 수영 여행 지도" className="korea-map-img" />
          {Object.entries(REGIONS).map(([regionName, regionData]) => {
            const progress = state.regionProgress[regionName];
            const xPct = (regionData.mapPos.x / 500) * 100;
            const yPct = (regionData.mapPos.y / 600) * 100;
            let markerClass = 'map-point';
            if (regionName === state.currentRegion) markerClass += ' current';
            else if (progress.completed) markerClass += ' completed';
            else if (progress.visited) markerClass += ' visited';

            return (
              <div
                key={regionName}
                className={markerClass}
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
                onClick={() => {
                  updateState(prev => ({ ...prev, currentRegion: regionName, selectedCourseRegion: regionName }));
                  setActiveTab('home');
                }}
                title={regionName}
              />
            );
          })}
        </div>
      </div>

      {/* 지역 선택 리스트 */}
      <div className="region-list">
        <h3 className="section-subtitle">지역 선택</h3>
        <div className="region-buttons">
          {Object.keys(REGIONS).map((regionName) => {
            const progress = state.regionProgress[regionName];
            let className = 'region-btn';
            if (regionName === state.currentRegion) className += ' active';
            else if (progress.completed) className += ' completed';
            else if (progress.visited) className += ' visited';

            return (
              <button
                key={regionName}
                className={className}
                onClick={() => {
                  updateState(prev => ({ ...prev, currentRegion: regionName, selectedCourseRegion: regionName }));
                  setActiveTab('home');
                }}
              >
                {REGIONS[regionName]?.emoji} {regionName}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// 홈 안 코스 섹션
function HomeCoursesSection({
  region,
  regionData,
  progress,
  selectedCourseIdx,
  setSelectedCourseIdx,
  showAllCourses,
  setShowAllCourses,
}: {
  region: string;
  regionData: RegionData;
  progress: RegionProgress;
  selectedCourseIdx: number | null;
  setSelectedCourseIdx: (idx: number | null) => void;
  showAllCourses: boolean;
  setShowAllCourses: (show: boolean) => void;
}) {
  const visibleCourseIndexes = showAllCourses ? [0, 1, 2, 3, 4] : [0, 1];

  const renderCourseItem = (i: number) => {
    const courseGoal = regionData.courses[i];
    const courseProgress = progress.courseProgress[i];
    const isCompleted = progress.completedCourses[i];
    const isCurrent = (i === progress.currentCourse && !isCompleted);
    const isLocked = (i >= 2 && !progress.completedCourses[i - 1] && !progress.completedCourses[i - 2]);
    let cardClass = '';
    let statusText = '';
    if (isCompleted) { cardClass = 'completed'; statusText = '완료'; }
    else if (isCurrent) { cardClass = 'current'; statusText = '진행중'; }
    else if (isLocked) { cardClass = 'locked'; statusText = '잠김'; }
    else { statusText = '대기'; }
    const progressPercent = Math.min((courseProgress / courseGoal) * 100, 100);

    return (
      <button
        key={i}
        className={`course-item ${cardClass} ${selectedCourseIdx === i ? 'selected' : ''}`}
        onClick={() => setSelectedCourseIdx(i)}
        type="button"
      >
        <div className="course-item-head">
          <span className="course-item-index">{i + 1}</span>
          <div className="course-item-title-wrap">
            <strong className="course-item-title">{getCourseName(region, i)}</strong>
            <span className="course-item-distance">{formatDistanceExact(courseGoal)}</span>
          </div>
          <span className="course-item-status">{statusText}</span>
        </div>
        <div className="course-item-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="course-item-progress-text">
            {formatDistanceExact(courseProgress)} / {formatDistanceExact(courseGoal)}
          </span>
        </div>
      </button>
    );
  };

  const handleToggleMoreCourses = () => {
    if (showAllCourses && selectedCourseIdx !== null && selectedCourseIdx >= 2) {
      setSelectedCourseIdx(null);
    }
    setShowAllCourses(!showAllCourses);
  };

  return (
    <div className="home-courses-section">
      {/* 코스 목록 */}
      <div className="course-list-container">
        <h3 className="section-subtitle">{formatRegionLabel(region)} 지역 코스</h3>
        <div className="course-list">
          {visibleCourseIndexes.map(renderCourseItem)}

          <button className="course-more-btn" onClick={handleToggleMoreCourses}>
            {showAllCourses ? '접기' : '나머지 3개 코스 더보기'}
          </button>
        </div>
      </div>

      {/* 선택된 코스 상세 */}
      {selectedCourseIdx !== null && (
        <CourseDetail
          region={region}
          regionData={regionData}
          courseIdx={selectedCourseIdx}
          progress={progress}
        />
      )}
    </div>
  );
}

// 코스 상세 정보 컴포넌트 - RouteMap + 코스 정보
function CourseDetail({ region, regionData, courseIdx, progress }: {
  region: string;
  regionData: RegionData;
  courseIdx: number;
  progress: { courseProgress: number[]; completedCourses: boolean[]; currentProgress: number; currentCourse: number };
}) {
  const courseGoal = regionData.courses[courseIdx];
  const courseProgressVal = progress.courseProgress[courseIdx];
  const isCompleted = progress.completedCourses[courseIdx];
  const progressRatio = Math.min(courseProgressVal / courseGoal, 1);
  const progressPct = formatProgressPercent(progressRatio);
  const courseName = getCourseName(region, courseIdx);

  return (
    <div className="course-map-detail">
      <div className="course-detail-layout">
        {/* 왼쪽: 간결한 텍스트 정보 */}
        <div className="course-detail-info">
          <h4>코스 상세</h4>
          <div className="course-detail-stats">
            <div className="course-detail-stat">
              <span className="stat-label-small">코스</span>
              <span className="stat-value-small">{courseName}</span>
            </div>
            <div className="course-detail-stat">
              <span className="stat-label-small">목표</span>
              <span className="stat-value-small">{formatDistanceExact(courseGoal)}</span>
            </div>
            <div className="course-detail-stat">
              <span className="stat-label-small">진행</span>
              <span className="stat-value-small">{formatDistanceExact(courseProgressVal)} ({progressPct}%)</span>
            </div>
            <div className="course-detail-stat">
              <span className="stat-label-small">상태</span>
              <span className="stat-value-small">{isCompleted ? '✅ 완료' : '🔄 진행중'}</span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 코스 이미지 + 감성 동선 */}
        <div className="course-detail-map">
          <RouteMap
            imageSrc={regionData.courseImages[courseIdx]}
            imageAlt={regionData.courseImageAlts[courseIdx]}
            routePath={regionData.courseArtRoutes[courseIdx]}
            progress={progressRatio}
            endLabel={courseName}
          />
        </div>
      </div>
    </div>
  );
}

// 스탬프 탭 컴포넌트
function PassportTab({ state }: { state: GameState }) {
  return (
    <section id="passport-tab" className="tab-content active">
      <h2 className="section-title">지역 스탬프</h2>
      <p className="passport-desc">각 지역을 방문하고 완주하면 스탬프를 받습니다.</p>
      <div id="passport-cards">
        {Object.keys(REGIONS).map((regionName) => {
          const regionData = REGIONS[regionName];
          const progress = state.regionProgress[regionName];
          const completedCount = progress.completedCourses.filter(c => c).length;
          let cardClass = 'stamp-card';
          let stampIcon = '○';
          let statusText = '미방문';
          if (progress.completed) {
            cardClass += ' completed';
            stampIcon = '★';
            statusText = '완주';
          } else if (progress.visited) {
            cardClass += ' visited';
            stampIcon = '◉';
            statusText = '방문';
          }

          return (
            <div key={regionName} className={cardClass} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '15px',
              background: progress.completed ? '#fff3cd' : progress.visited ? '#d4edda' : '#f8f9fa',
              borderRadius: '10px',
              marginBottom: '10px',
              gap: '15px'
            }}>
              <div style={{ fontSize: '24px' }}>{stampIcon}</div>
              <div>
                <div style={{ fontSize: '24px' }}>{regionData.emoji}</div>
                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{regionData.emoji} {regionName}</div>
                <div style={{ color: '#666', fontSize: '14px' }}>{statusText}</div>
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: progress.completedCourses[i] ? '#28a745' : '#e0e0e0',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px'
                    }}>
                      {progress.completedCourses[i] ? '✓' : i + 1}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', fontWeight: 'bold', fontSize: '18px' }}>{completedCount}/5</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 배지 탭 컴포넌트
function BadgesTab({ state }: { state: GameState }) {
  return (
    <section id="badges-tab" className="tab-content active">
      <h2 className="section-title">나의 배지</h2>
      <div className="badges-grid">
        {BADGES.map((badge) => {
          const earned = state.badges.includes(badge.id);
          return (
            <div key={badge.id} className="badge-item" style={{
              opacity: earned ? 1 : 0.5,
              border: earned ? '2px solid #ffc107' : '2px solid #e0e0e0'
            }}>
              <div className="badge-icon">{badge.icon}</div>
              <div className="badge-name">{badge.name}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>{badge.desc}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
