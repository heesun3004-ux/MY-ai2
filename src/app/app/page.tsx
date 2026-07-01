'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { REGIONS, getCourseName, formatDistanceExact, RegionData } from '@/lib/gameData';
import { getFirebaseServices, isFirebaseConfigured, upsertUserProfile } from '@/lib/firebaseClient';
import RouteMap from '../components/RouteMap';
import ChatbotPopup from '../components/ChatbotPopup';
import TopAuthControls from '../components/TopAuthControls';

// 타입 정의
type SwimRecordSource = 'manual';
interface CalendarDayEntry {
  photo?: string;
  photoPath?: string;
  distance?: string;
  duration?: string;
  heartRate?: string;
  poolLength?: string;
  updatedAt?: string;
}
type CalendarEntries = Record<string, CalendarDayEntry>;

interface AppUser {
  uid: string;
  email: string | null;
  isLocalTest?: boolean;
}

interface MonthlyGoal {
  id: string;
  text: string;
  completed: boolean;
}

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
  source?: SwimRecordSource;
  externalId?: string;
  createdAt?: string;
}

interface RecentSwimRecord {
  id: string;
  title: string;
  date: string;
  distance: number;
  duration?: string;
  heartRate?: string;
  poolLength?: string;
  sourceLabel: string;
  sortTime: number;
  fallbackOrder: number;
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

const MAP_IMAGE_WIDTH = 1122;
const MAP_IMAGE_HEIGHT = 1402;
const CALENDAR_START_YEAR = 2026;
const CALENDAR_START_MONTH = 5;
const CALENDAR_END_YEAR = 2100;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CALENDAR_PHOTOS_KEY = 'swimmingCalendarPhotos';
const MONTHLY_GOALS_KEY = 'monthlySwimGoals';
const LOCAL_TEST_USER_KEY = 'swimmingLocalTestUser';
const MIN_MONTHLY_GOALS = 3;
const MAX_MONTHLY_GOALS = 10;
const COURSE_BACKGROUND_IMAGES = Object.values(REGIONS)
  .flatMap((region) => region.courseImages)
  .filter(Boolean);
const COURSE_BACKGROUND_ROTATION = [
  0, 7, 14, 21, 28, 35, 2, 9, 16, 23, 30, 37, 4, 11, 18, 25, 32, 39,
  6, 13, 20, 27, 34, 41, 1, 8, 15, 22, 29, 36, 3, 10, 17, 24, 31, 38,
  5, 12, 19, 26, 33, 40, 42, 43, 44,
].filter((index) => index < COURSE_BACKGROUND_IMAGES.length);

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

function getCalendarInitialMonth() {
  const today = new Date();
  const startDate = new Date(CALENDAR_START_YEAR, CALENDAR_START_MONTH, 1);
  if (today < startDate) {
    return { year: CALENDAR_START_YEAR, month: CALENDAR_START_MONTH };
  }
  return { year: today.getFullYear(), month: today.getMonth() };
}

function getMonthDates(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return {
    firstWeekday,
    days: Array.from({ length: daysInMonth }, (_, index) => index + 1),
  };
}

function isBeforeCalendarStart(year: number, month: number) {
  return year < CALENDAR_START_YEAR || (year === CALENDAR_START_YEAR && month < CALENDAR_START_MONTH);
}

function formatCalendarDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseCalendarDistance(distance?: string) {
  if (!distance) return 0;
  const parsedDistance = parseFloat(distance);
  return Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : 0;
}

function getCalendarEntrySortTime(dateKey: string, entry: CalendarDayEntry) {
  const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : NaN;
  if (Number.isFinite(updatedTime)) return updatedTime;

  const dateTime = new Date(`${dateKey}T23:59:59`).getTime();
  return Number.isFinite(dateTime) ? dateTime : 0;
}

function getSwimRecordSortTime(record: SwimRecord) {
  const createdTime = record.createdAt ? new Date(record.createdAt).getTime() : NaN;
  if (Number.isFinite(createdTime)) return createdTime;

  const parsedDate = record.date.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!parsedDate) return 0;

  const [, month, day, hour, minute] = parsedDate;
  return new Date(
    new Date().getFullYear(),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  ).getTime();
}

function buildRecentSwimRecords(records: SwimRecord[], calendarEntries: CalendarEntries): RecentSwimRecord[] {
  const mapRecords = records.map((record, index) => {
    return {
      id: `map-${record.externalId ?? index}`,
      title: `${REGIONS[record.region]?.emoji ?? ''} ${record.region}`.trim(),
      date: record.date,
      distance: record.distance,
      sourceLabel: '전국 수영일주',
      sortTime: getSwimRecordSortTime(record),
      fallbackOrder: index,
    };
  });

  const calendarRecords = Object.entries(calendarEntries)
    .filter(([, entry]) => Object.values(entry).some(Boolean))
    .map(([dateKey, entry], index) => ({
      id: `calendar-${dateKey}`,
      title: 'Swim Log',
      date: dateKey,
      distance: parseCalendarDistance(entry.distance),
      duration: entry.duration,
      heartRate: entry.heartRate,
      poolLength: entry.poolLength,
      sourceLabel: '캘린더',
      sortTime: getCalendarEntrySortTime(dateKey, entry),
      fallbackOrder: records.length + index,
    }));

  return [...mapRecords, ...calendarRecords]
    .sort((a, b) => b.sortTime - a.sortTime || a.fallbackOrder - b.fallbackOrder)
    .slice(0, 10);
}

function loadCalendarEntries(): CalendarEntries {
  if (typeof window === 'undefined') return {};

  try {
    const savedEntries = localStorage.getItem(CALENDAR_PHOTOS_KEY);
    if (!savedEntries) return {};

    const parsed = JSON.parse(savedEntries) as Record<string, string | CalendarDayEntry>;
    return Object.fromEntries(
      Object.entries(parsed).map(([dateKey, value]) => [
        dateKey,
        typeof value === 'string' ? { photo: value } : value,
      ])
    );
  } catch {
    return {};
  }
}

function saveCalendarEntries(entries: CalendarEntries) {
  if (typeof window === 'undefined') return true;

  try {
    localStorage.setItem(CALENDAR_PHOTOS_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function createMonthlyGoal(index: number): MonthlyGoal {
  return {
    id: `goal-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    completed: false,
  };
}

function getDefaultMonthlyGoals(): MonthlyGoal[] {
  return Array.from({ length: MIN_MONTHLY_GOALS }, (_, index) => createMonthlyGoal(index));
}

function normalizeMonthlyGoals(goals: MonthlyGoal[]) {
  const normalizedGoals = goals
    .slice(0, MAX_MONTHLY_GOALS)
    .map((goal, index) => ({
      id: goal.id || createMonthlyGoal(index).id,
      text: goal.text ?? '',
      completed: Boolean(goal.completed),
    }));

  while (normalizedGoals.length < MIN_MONTHLY_GOALS) {
    normalizedGoals.push(createMonthlyGoal(normalizedGoals.length));
  }

  return normalizedGoals;
}

function loadMonthlyGoals(): MonthlyGoal[] {
  if (typeof window === 'undefined') return getDefaultMonthlyGoals();

  try {
    const savedGoals = localStorage.getItem(MONTHLY_GOALS_KEY);
    if (!savedGoals) return getDefaultMonthlyGoals();
    return normalizeMonthlyGoals(JSON.parse(savedGoals) as MonthlyGoal[]);
  } catch {
    return getDefaultMonthlyGoals();
  }
}

function saveMonthlyGoals(goals: MonthlyGoal[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MONTHLY_GOALS_KEY, JSON.stringify(goals));
}

function normalizeGameState(state: Partial<GameState> | null | undefined): GameState {
  const defaultState = getDefaultState();
  const incoming = state ?? {};
  const normalizedRegionProgress: GameState['regionProgress'] = {};

  for (const regionName of Object.keys(REGIONS)) {
    const defaultProgress = defaultState.regionProgress[regionName];
    const incomingProgress = incoming.regionProgress?.[regionName];
    normalizedRegionProgress[regionName] = {
      ...defaultProgress,
      ...incomingProgress,
      completedCourses: Array.from({ length: 5 }, (_, index) => Boolean(incomingProgress?.completedCourses?.[index])),
      courseProgress: Array.from({ length: 5 }, (_, index) => Number(incomingProgress?.courseProgress?.[index] ?? 0)),
    };
  }

  const todayString = getTodayString();
  const monthKey = getMonthKey();
  const normalizedState: GameState = {
    ...defaultState,
    ...incoming,
    regionProgress: normalizedRegionProgress,
    records: Array.isArray(incoming.records) ? incoming.records.slice(0, 5) : [],
    badges: Array.isArray(incoming.badges) ? incoming.badges : [],
  };

  if (normalizedState.todayDate !== todayString) {
    normalizedState.todayDistance = 0;
    normalizedState.todayDate = todayString;
  }
  if (normalizedState.monthKey !== monthKey) {
    normalizedState.monthDistance = 0;
    normalizedState.monthKey = monthKey;
  }

  return normalizedState;
}

function hasLocalDataToMigrate() {
  if (typeof window === 'undefined') return false;

  try {
    const savedState = localStorage.getItem('swimmingGameState');
    const savedCalendarEntries = localStorage.getItem(CALENDAR_PHOTOS_KEY);
    const savedGoals = localStorage.getItem(MONTHLY_GOALS_KEY);
    return Boolean(
      savedState ||
      (savedCalendarEntries && Object.keys(JSON.parse(savedCalendarEntries)).length > 0) ||
      (savedGoals && (JSON.parse(savedGoals) as MonthlyGoal[]).some((goal) => goal.text || goal.completed))
    );
  } catch {
    return true;
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64Data] = dataUrl.split(',');
  const mimeType = meta.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function uploadCalendarPhoto(userId: string, dateKey: string, dataUrl: string) {
  const firebase = getFirebaseServices();
  if (!firebase || !dataUrl.startsWith('data:')) {
    return { photo: dataUrl, photoPath: undefined };
  }

  const blob = dataUrlToBlob(dataUrl);
  const path = `calendar-photos/${userId}/${dateKey}-${Date.now()}.jpg`;
  const photoRef = ref(firebase.storage, path);
  await uploadBytes(photoRef, blob, {
    contentType: blob.type || 'image/jpeg',
  });
  const downloadUrl = await getDownloadURL(photoRef);

  return { photo: downloadUrl, photoPath: path };
}

function serializeRemoteDate(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return undefined;
}

async function loadRemoteUserData(userId: string) {
  const firebase = getFirebaseServices();
  if (!firebase) return null;

  const [stateResult, calendarResult, goalsResult] = await Promise.all([
    getDoc(doc(firebase.db, 'users', userId, 'appState', 'current')),
    getDocs(collection(firebase.db, 'users', userId, 'calendarEntries')),
    getDocs(query(collection(firebase.db, 'users', userId, 'monthlyGoals'), orderBy('position', 'asc'))),
  ]);

  const calendarEntries: CalendarEntries = Object.fromEntries(
    calendarResult.docs.map((entryDoc) => {
      const entry = entryDoc.data();
      return [
        entryDoc.id,
      {
        photo: entry.photo ?? undefined,
        photoPath: entry.photoPath ?? undefined,
        distance: entry.distance ?? undefined,
        duration: entry.duration ?? undefined,
        heartRate: entry.heartRate ?? undefined,
        poolLength: entry.poolLength ?? undefined,
        updatedAt: serializeRemoteDate(entry.updatedAt),
      },
      ];
    })
  );

  const goals = goalsResult.docs.map((goalDoc) => {
    const goal = goalDoc.data();
    return {
    id: goalDoc.id,
    text: goal.text ?? '',
    completed: Boolean(goal.completed),
    };
  });
  const remoteState = stateResult.exists() ? stateResult.data().state : null;

  return {
    state: remoteState ? normalizeGameState(remoteState as Partial<GameState>) : null,
    calendarEntries,
    goals: goals.length > 0 ? normalizeMonthlyGoals(goals) : null,
    hasCloudData: Boolean(remoteState || Object.keys(calendarEntries).length > 0 || goals.length > 0),
  };
}

async function saveRemoteGameState(userId: string, state: GameState) {
  const firebase = getFirebaseServices();
  if (!firebase) return;

  await setDoc(doc(firebase.db, 'users', userId, 'appState', 'current'), {
    state,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function saveRemoteCalendarEntry(userId: string, dateKey: string, entry: CalendarDayEntry | null) {
  const firebase = getFirebaseServices();
  if (!firebase) return;
  const entryRef = doc(firebase.db, 'users', userId, 'calendarEntries', dateKey);

  if (!entry || !Object.values(entry).some(Boolean)) {
    await deleteDoc(entryRef);
    return;
  }

  await setDoc(entryRef, {
    photo: entry.photo ?? null,
    photoPath: entry.photoPath ?? null,
    distance: entry.distance ?? null,
    duration: entry.duration ?? null,
    heartRate: entry.heartRate ?? null,
    poolLength: entry.poolLength ?? null,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  }, { merge: true });
}

async function saveRemoteMonthlyGoals(userId: string, goals: MonthlyGoal[]) {
  const firebase = getFirebaseServices();
  if (!firebase) return;

  const goalsCollection = collection(firebase.db, 'users', userId, 'monthlyGoals');
  const existingGoals = await getDocs(goalsCollection);
  const batch = writeBatch(firebase.db);

  existingGoals.docs.forEach((goalDoc) => batch.delete(goalDoc.ref));
  goals.forEach((goal, index) => {
    batch.set(doc(firebase.db, 'users', userId, 'monthlyGoals', goal.id), {
      text: goal.text,
      completed: goal.completed,
      position: index,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

async function clearRemoteUserData(userId: string) {
  const firebase = getFirebaseServices();
  if (!firebase) return;

  const [calendarResult, goalsResult] = await Promise.all([
    getDocs(collection(firebase.db, 'users', userId, 'calendarEntries')),
    getDocs(collection(firebase.db, 'users', userId, 'monthlyGoals')),
  ]);
  const batch = writeBatch(firebase.db);

  batch.delete(doc(firebase.db, 'users', userId, 'appState', 'current'));
  calendarResult.docs.forEach((entryDoc) => batch.delete(entryDoc.ref));
  goalsResult.docs.forEach((goalDoc) => batch.delete(goalDoc.ref));
  await batch.commit();
}

function clearLocalUserData() {
  localStorage.removeItem('swimmingGameState');
  localStorage.removeItem(CALENDAR_PHOTOS_KEY);
  localStorage.removeItem(MONTHLY_GOALS_KEY);
}

const CALENDAR_PHOTO_MAX_SIZE = 640;
const CALENDAR_PHOTO_QUALITY = 0.76;
const IMAGE_LOAD_TIMEOUT_MS = 20000;

function isHeicPhoto(file: File) {
  return /hei(c|f)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('사진을 읽을 수 없습니다.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error('이미지 로딩 시간이 초과되었습니다.'));
      }
    }, IMAGE_LOAD_TIMEOUT_MS);

    image.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      }
    };
    image.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        reject(new Error('이미지 파일을 불러올 수 없습니다.'));
      }
    };
    image.src = objectUrl;
  });
}

async function convertHeicToJpegBlob(file: File): Promise<Blob> {
  let heic2anyModule;
  try {
    heic2anyModule = await import('heic2any');
  } catch {
    throw new Error('HEIC 변환 라이브러리를 불러올 수 없습니다.');
  }

  const converted = await heic2anyModule.default({
    blob: file,
    toType: 'image/jpeg',
    quality: CALENDAR_PHOTO_QUALITY,
  });

  const result = Array.isArray(converted) ? converted[0] : converted;
  if (!result || result.size === 0) {
    throw new Error('HEIC 사진 변환에 실패했습니다.');
  }
  return result;
}

async function resizePhotoBlobToDataUrl(blob: Blob): Promise<string> {
  const image = await loadImageFromBlob(blob);
  const scale = Math.min(CALENDAR_PHOTO_MAX_SIZE / image.width, CALENDAR_PHOTO_MAX_SIZE / image.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    return readBlobAsDataUrl(blob);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', CALENDAR_PHOTO_QUALITY);

  // 모바일 브라우저 canvas 크기 제한으로 빈 data URL이 반환되는 경우 대응
  if (!dataUrl || dataUrl === 'data:' || dataUrl.length < 100) {
    return readBlobAsDataUrl(blob);
  }

  return dataUrl;
}

async function readPhotoAsCalendarImage(file: File): Promise<string> {
  // 1단계: 일반 이미지로 로드 시도
  // (모바일에서 HEIC가 자동 변환된 경우, 브라우저가 바로 렌더링 가능)
  try {
    return await resizePhotoBlobToDataUrl(file);
  } catch {
    // 일반 로드 실패 → HEIC 변환 시도
  }

  // 2단계: HEIC 변환 시도
  // (HEIC로 감지된 파일이거나, 일반 로드가 실패한 미지원 포맷인 경우)
  if (isHeicPhoto(file) || !file.type || file.type === 'application/octet-stream') {
    try {
      const convertedBlob = await convertHeicToJpegBlob(file);
      return await resizePhotoBlobToDataUrl(convertedBlob);
    } catch {
      // HEIC 변환도 실패 → 최후의 수단
    }
  }

  // 3단계: data URL로 직접 읽기 (최후의 수단)
  if (file.type.startsWith('image/') || !file.type) {
    try {
      return await readBlobAsDataUrl(file);
    } catch {
      // 모든 방법 실패
    }
  }

  throw new Error('사진을 읽을 수 없습니다. 다른 이미지로 시도해주세요.');
}

function loadState(): GameState {
  if (typeof window === 'undefined') return getDefaultState();

  const saved = localStorage.getItem('swimmingGameState');
  if (saved) {
    return normalizeGameState(JSON.parse(saved) as Partial<GameState>);
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
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntries>({});
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>(getDefaultMonthlyGoals);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [hasPendingMigration, setHasPendingMigration] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'badges'>('home');
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const firebaseReady = isFirebaseConfigured();

  // AI 코치에게 전달할 수영 기록 요약 생성
  const buildSwimmingContext = (s: GameState, entries: CalendarEntries): string => {
    const lines: string[] = [];
    const todayKey = getTodayString();
    const monthKey = getMonthKey();
    const calendarTodayDistance = parseCalendarDistance(entries[todayKey]?.distance);
    const calendarMonthDistance = Object.entries(entries).reduce((total, [dateKey, entry]) => {
      if (!dateKey.startsWith(monthKey)) return total;
      return total + parseCalendarDistance(entry.distance);
    }, 0);
    const calendarTotalDistance = Object.values(entries).reduce(
      (total, entry) => total + parseCalendarDistance(entry.distance),
      0
    );
    const recentSwimRecords = buildRecentSwimRecords(s.records, entries);

    lines.push(`- 오늘 거리: ${formatDistanceExact(s.todayDistance + calendarTodayDistance)} (전국 수영일주 ${formatDistanceExact(s.todayDistance)}, 캘린더 ${formatDistanceExact(calendarTodayDistance)})`);
    lines.push(`- 이번 달 거리: ${formatDistanceExact(s.monthDistance + calendarMonthDistance)} (전국 수영일주 ${formatDistanceExact(s.monthDistance)}, 캘린더 ${formatDistanceExact(calendarMonthDistance)})`);
    lines.push(`- 총 거리: ${formatDistanceExact(s.totalDistance + calendarTotalDistance)} (전국 수영일주 ${formatDistanceExact(s.totalDistance)}, 캘린더 ${formatDistanceExact(calendarTotalDistance)})`);
    lines.push(`- 현재 지역: ${s.currentRegion}`);
    if (recentSwimRecords.length > 0) {
      lines.push('- 최근 기록 전체 (최신순, 전국 수영일주 + Swim Log 캘린더):');
      recentSwimRecords.forEach((record) => {
        const details = [
          `거리 ${record.distance > 0 ? formatDistanceExact(record.distance) : '미입력'}`,
          record.duration ? `시간 ${record.duration}` : null,
          record.heartRate ? `심박 ${record.heartRate}bpm` : null,
          record.poolLength ? `수영장 ${record.poolLength}m` : null,
        ].filter(Boolean);
        lines.push(`  · ${record.date} | ${record.sourceLabel} | ${record.title} | ${details.join(' | ')}`);
      });

      // 최근 운동량(거리) 변화 추세 계산
      const distances = recentSwimRecords
        .filter((record) => record.distance > 0)
        .map((record) => record.distance)
        .reverse();
      if (distances.length >= 2) {
        const recent = distances[distances.length - 1];
        const prev = distances[distances.length - 2];
        const diff = recent - prev;
        if (diff > 0) {
          lines.push(`- 최근 운동량은 이전 기록보다 +${formatDistanceExact(diff)} 증가했습니다.`);
        } else if (diff < 0) {
          lines.push(`- 최근 운동량은 이전 기록보다 ${formatDistanceExact(Math.abs(diff))} 감소했습니다.`);
        } else {
          lines.push('- 최근 운동량은 이전 기록과 동일합니다.');
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
      localStorage.setItem('swimmingAppVersion', APP_VERSION);
    }
    setState(loadState());
    setCalendarEntries(loadCalendarEntries());
    setMonthlyGoals(loadMonthlyGoals());
    setHasPendingMigration(hasLocalDataToMigrate());
    const popupShown = localStorage.getItem('welcomePopupShown');
    setShowWelcome(popupShown !== 'true');
  }, []);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) {
      const savedLocalUser = localStorage.getItem(LOCAL_TEST_USER_KEY);
      if (savedLocalUser) {
        setUser({
          uid: 'local-test-user',
          email: savedLocalUser,
          isLocalTest: true,
        });
      }
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebase.auth, (nextUser) => {
      setUser(nextUser ? { uid: nextUser.uid, email: nextUser.email } : null);
      if (nextUser) {
        void upsertUserProfile(nextUser);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;

    if (user.isLocalTest) {
      setSyncStatus('로컬 테스트 계정입니다. 기록은 이 브라우저에만 저장됩니다.');
      return;
    }

    let isActive = true;
    setSyncStatus('계정 기록을 불러오는 중...');

    loadRemoteUserData(user.uid)
      .then((remoteData) => {
        if (!isActive || !remoteData) return;

        if (remoteData.hasCloudData) {
          if (remoteData.state) {
            setState(remoteData.state);
            saveState(remoteData.state);
          }
          if (Object.keys(remoteData.calendarEntries).length > 0) {
            setCalendarEntries(remoteData.calendarEntries);
            saveCalendarEntries(remoteData.calendarEntries);
          }
          if (remoteData.goals) {
            setMonthlyGoals(remoteData.goals);
            saveMonthlyGoals(remoteData.goals);
          }
          setSyncStatus('계정 기록을 불러왔습니다.');
        } else {
          setSyncStatus('계정에 저장된 기록이 아직 없습니다.');
        }

        setHasPendingMigration(hasLocalDataToMigrate());
      })
      .catch(() => {
        if (!isActive) return;
        setSyncStatus('계정 기록을 불러오지 못했습니다. Firebase 설정을 확인해주세요.');
      });

    return () => {
      isActive = false;
    };
  }, [mounted, user]);

  const updateState = useCallback((updater: (prev: GameState) => GameState) => {
    setState((prev) => {
      const newState = updater(prev);
      saveState(newState);
      if (user && !user.isLocalTest) {
        saveRemoteGameState(user.uid, newState)
          .then(() => setSyncStatus('계정에 저장되었습니다.'))
          .catch(() => setSyncStatus('계정 저장에 실패했습니다. 다시 시도해주세요.'));
      }
      return newState;
    });
  }, [user]);

  const saveCalendarEntry = async (dateKey: string, nextEntry: CalendarDayEntry | null) => {
    let entryToSave = nextEntry;

    if (user && !user.isLocalTest && entryToSave?.photo?.startsWith('data:')) {
      const uploadedPhoto = await uploadCalendarPhoto(user.uid, dateKey, entryToSave.photo);
      entryToSave = { ...entryToSave, ...uploadedPhoto };
    }

    const nextEntries = { ...calendarEntries };
    if (entryToSave && Object.values(entryToSave).some(Boolean)) {
      nextEntries[dateKey] = entryToSave;
    } else {
      delete nextEntries[dateKey];
    }

    const didSave = saveCalendarEntries(nextEntries);
    if (!didSave) {
      throw new Error('사진 용량이 커서 저장하지 못했습니다.');
    }

    setCalendarEntries(nextEntries);

    if (user && !user.isLocalTest) {
      await saveRemoteCalendarEntry(user.uid, dateKey, entryToSave);
      setSyncStatus('캘린더 기록이 계정에 저장되었습니다.');
    } else if (user?.isLocalTest) {
      setSyncStatus('로컬 테스트 계정에 저장되었습니다.');
    }
  };

  const saveGoalsForCurrentUser = (nextGoals: MonthlyGoal[]) => {
    const normalizedGoals = normalizeMonthlyGoals(nextGoals);
    setMonthlyGoals(normalizedGoals);
    saveMonthlyGoals(normalizedGoals);

    if (user && !user.isLocalTest) {
      saveRemoteMonthlyGoals(user.uid, normalizedGoals)
        .then(() => setSyncStatus('목표가 계정에 저장되었습니다.'))
        .catch(() => setSyncStatus('목표 저장에 실패했습니다. 다시 시도해주세요.'));
    } else if (user?.isLocalTest) {
      setSyncStatus('로컬 테스트 계정에 목표가 저장되었습니다.');
    }
  };

  const handleMigrateLocalData = async () => {
    if (!user || user.isLocalTest) return;
    if (!confirm('이 기기에 저장된 기록을 현재 로그인 계정으로 옮길까요?\n같은 날짜의 계정 기록은 이 기기 기록으로 덮어쓸 수 있습니다.')) {
      return;
    }

    try {
      setSyncStatus('기존 기록을 계정으로 옮기는 중...');
      const localState = loadState();
      const localCalendarEntries = loadCalendarEntries();
      const localGoals = loadMonthlyGoals();
      const uploadedEntries: CalendarEntries = {};

      for (const [dateKey, entry] of Object.entries(localCalendarEntries)) {
        if (entry.photo?.startsWith('data:')) {
          uploadedEntries[dateKey] = {
            ...entry,
            ...(await uploadCalendarPhoto(user.uid, dateKey, entry.photo)),
          };
        } else {
          uploadedEntries[dateKey] = entry;
        }
      }

      await saveRemoteGameState(user.uid, localState);
      await Promise.all(
        Object.entries(uploadedEntries).map(([dateKey, entry]) =>
          saveRemoteCalendarEntry(user.uid, dateKey, entry)
        )
      );
      await saveRemoteMonthlyGoals(user.uid, localGoals);

      setState(localState);
      setCalendarEntries(uploadedEntries);
      setMonthlyGoals(localGoals);
      saveCalendarEntries(uploadedEntries);
      setHasPendingMigration(false);
      setSyncStatus('기존 기록을 계정으로 옮겼습니다.');
    } catch {
      setSyncStatus('기존 기록 마이그레이션에 실패했습니다. Firebase 설정과 Storage 규칙을 확인해주세요.');
    }
  };

  const handleResetAllRecords = async () => {
    if (!confirm('모든 기록을 초기화하시겠습니까?\n로그인 중이면 계정에 저장된 기록도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      if (user && !user.isLocalTest) {
        await clearRemoteUserData(user.uid);
      }
      clearLocalUserData();
      const defaultState = getDefaultState();
      const defaultGoals = getDefaultMonthlyGoals();
      setState(defaultState);
      setCalendarEntries({});
      setMonthlyGoals(defaultGoals);
      setSyncStatus(user?.isLocalTest ? '로컬 테스트 기록을 초기화했습니다.' : user ? '계정 기록을 초기화했습니다.' : '');
    } catch {
      setSyncStatus('기록 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleLocalTestSignIn = (email = 'test@swimlog.local') => {
    localStorage.setItem(LOCAL_TEST_USER_KEY, email);
    setUser({
      uid: 'local-test-user',
      email,
      isLocalTest: true,
    });
    setSyncStatus('로컬 테스트 계정으로 로그인했습니다. Firebase 키를 넣으면 실제 계정 저장으로 전환됩니다.');
  };

  const handleLocalTestSignOut = () => {
    localStorage.removeItem(LOCAL_TEST_USER_KEY);
    setUser(null);
    setSyncStatus('로컬 테스트 계정에서 로그아웃했습니다.');
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('welcomePopupShown', 'true');
  };

  const handleTabChange = (nextTab: 'home' | 'map' | 'badges') => {
    if (nextTab !== activeTab && COURSE_BACKGROUND_ROTATION.length > 0) {
      setBackgroundIndex((prev) => (prev + 1) % COURSE_BACKGROUND_ROTATION.length);
    }
    setActiveTab(nextTab);
  };

  if (!mounted) {
    return null;
  }

  const backgroundImage =
    COURSE_BACKGROUND_IMAGES[COURSE_BACKGROUND_ROTATION[backgroundIndex] ?? 0] ??
    COURSE_BACKGROUND_IMAGES[0];

  return (
    <>
      {backgroundImage && (
        <div
          className="app-background"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          aria-hidden="true"
        />
      )}

      {/* 환영 팝업 */}
      {showWelcome && (
        <div className="welcome-popup">
          <div className="popup-content">
            <h1 className="popup-title">Swim Log</h1>
            <button className="popup-btn" onClick={closeWelcome}>시작하기</button>
          </div>
        </div>
      )}

      {/* 메인 앱 컨테이너 */}
      <div className="app-container">
        {/* 헤더 */}
        <header className="app-header">
          <Link className="app-landing-link" href="/" aria-label="랜딩페이지로 돌아가기">
            <span aria-hidden="true">{'<'}</span>
          </Link>
          <div className="app-header-copy">
            <div className="app-logo-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1 className="app-title">
              Swim Log
              <span className="app-title-wave" aria-hidden="true" />
            </h1>
            <p className="app-subtitle">수영 기록부터 목표 관리, AI 코칭까지 한곳에서 관리하는 나만의 수영 캘린더</p>
          </div>
          <div className="app-header-visual" aria-hidden="true">
            <img src="/images/swim-hero-athlete.png" alt="" />
          </div>
          <TopAuthControls />
        </header>

        {/* 탭 네비게이션 */}
        <nav className="tab-nav">
          <button className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')}>홈</button>
          <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => handleTabChange('map')}>전국 수영일주</button>
          <button className={`tab-btn ${activeTab === 'badges' ? 'active' : ''}`} onClick={() => handleTabChange('badges')}>이달의 목표</button>
        </nav>

        {/* 홈 탭 */}
        {activeTab === 'home' && (
          <HomeTab
            state={state}
            calendarEntries={calendarEntries}
            onSaveCalendarEntry={saveCalendarEntry}
            onResetRecords={handleResetAllRecords}
            onOpenChatbot={() => setShowChatbot(true)}
          />
        )}

        {/* 지도 탭 */}
        {activeTab === 'map' && <MapTab state={state} updateState={updateState} />}

        {/* 이달의 목표 탭 */}
        {activeTab === 'badges' && (
          <MonthlyGoalsTab
            goals={monthlyGoals}
            onGoalsChange={saveGoalsForCurrentUser}
          />
        )}
      </div>

      {/* AI 수영 코치 챗봇 팝업 */}
      <ChatbotPopup
        isOpen={showChatbot}
        onClose={() => setShowChatbot(false)}
        swimmingContext={buildSwimmingContext(state, calendarEntries)}
      />
    </>
  );
}

// 홈 탭 컴포넌트 - 최근 기록 + AI 수영 코치
function HomeTab({
  state,
  calendarEntries,
  onSaveCalendarEntry,
  onResetRecords,
  onOpenChatbot,
}: {
  state: GameState;
  calendarEntries: CalendarEntries;
  onSaveCalendarEntry: (dateKey: string, entry: CalendarDayEntry | null) => Promise<void>;
  onResetRecords: () => Promise<void>;
  onOpenChatbot: () => void;
}) {
  const initialCalendarMonth = getCalendarInitialMonth();
  const [calendarYear, setCalendarYear] = useState(initialCalendarMonth.year);
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth.month);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarDraft, setCalendarDraft] = useState<CalendarDayEntry>({});
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const today = new Date();
  const { firstWeekday, days } = getMonthDates(calendarYear, calendarMonth);
  const calendarMonthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
  const calendarMonthTotal = Object.entries(calendarEntries).reduce((total, [dateKey, entry]) => {
    if (!dateKey.startsWith(calendarMonthKey)) return total;
    return total + parseCalendarDistance(entry.distance);
  }, 0);
  const recentSwimRecords = buildRecentSwimRecords(state.records, calendarEntries);
  const calendarYears = Array.from(
    { length: CALENDAR_END_YEAR - CALENDAR_START_YEAR + 1 },
    (_, index) => CALENDAR_START_YEAR + index
  );

  const handleYearChange = (nextYear: number) => {
    setCalendarYear(nextYear);
    if (isBeforeCalendarStart(nextYear, calendarMonth)) {
      setCalendarMonth(CALENDAR_START_MONTH);
    }
  };

  const openCalendarDetail = (dateKey: string) => {
    setSelectedCalendarDate(dateKey);
    setCalendarDraft(calendarEntries[dateKey] ?? {});
  };

  const closeCalendarDetail = () => {
    setSelectedCalendarDate(null);
    setCalendarDraft({});
  };

  const updateCalendarDraft = (field: keyof CalendarDayEntry, value: string) => {
    setCalendarDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleCalendarPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoProcessing(true);
    try {
      const imageDataUrl = await readPhotoAsCalendarImage(file);
      setCalendarDraft((prev) => ({ ...prev, photo: imageDataUrl }));
    } catch {
      alert('사진을 저장하지 못했습니다. 다른 이미지로 다시 시도해주세요.');
    } finally {
      setPhotoProcessing(false);
      event.target.value = '';
    }
  };

  const handleSaveCalendarDetail = async () => {
    if (!selectedCalendarDate) return;

    const nextEntryData: CalendarDayEntry = {
      photo: calendarDraft.photo,
      distance: calendarDraft.distance?.trim(),
      duration: calendarDraft.duration?.trim(),
      heartRate: calendarDraft.heartRate?.trim(),
      poolLength: calendarDraft.poolLength?.trim(),
    };
    const hasEntryData = Object.values(nextEntryData).some(Boolean);
    const nextEntry = hasEntryData
      ? { ...nextEntryData, updatedAt: new Date().toISOString() }
      : nextEntryData;

    try {
      await onSaveCalendarEntry(selectedCalendarDate, hasEntryData ? nextEntry : null);
      closeCalendarDetail();
    } catch {
      alert('사진 또는 기록을 저장하지 못했습니다. Firebase 설정과 사진 용량을 확인해주세요.');
    }
  };

  const handleRemoveCalendarPhoto = () => {
    setCalendarDraft((prev) => ({ ...prev, photo: undefined }));
  };

  return (
    <section id="home-tab" className="tab-content active">
      {/* 달력 */}
      <div className="home-calendar">
        <div className="calendar-header">
          <div>
            <h3 className="section-subtitle">나만의 수영 캘린더</h3>
            <p className="calendar-month-total">Total : {formatDistanceExact(calendarMonthTotal)}</p>
          </div>
          <div className="calendar-selectors" aria-label="달력 년도와 월 선택">
            <select
              className="calendar-select"
              value={calendarYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              aria-label="년도 선택"
            >
              {calendarYears.map((year) => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              className="calendar-select"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(Number(e.target.value))}
              aria-label="월 선택"
            >
              {Array.from({ length: 12 }, (_, month) => (
                <option
                  key={month}
                  value={month}
                  disabled={isBeforeCalendarStart(calendarYear, month)}
                >
                  {month + 1}월
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="calendar-grid calendar-weekdays">
          {WEEKDAY_LABELS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="calendar-grid calendar-days">
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span key={`empty-${index}`} className="calendar-day empty" />
          ))}
          {days.map((day) => {
            const dateKey = formatCalendarDateKey(calendarYear, calendarMonth, day);
            const photoSrc = calendarEntries[dateKey]?.photo;
            const isToday =
              calendarYear === today.getFullYear() &&
              calendarMonth === today.getMonth() &&
              day === today.getDate();

            return (
              <button
                key={day}
                className={`calendar-day photo-slot ${photoSrc ? 'has-photo' : ''} ${isToday ? 'today' : ''}`}
                type="button"
                onClick={() => openCalendarDetail(dateKey)}
                aria-label={`${calendarYear}년 ${calendarMonth + 1}월 ${day}일`}
              >
                {photoSrc ? (
                  <img src={photoSrc} alt={`${calendarYear}년 ${calendarMonth + 1}월 ${day}일 수영 사진`} className="calendar-photo" />
                ) : (
                  <span className="calendar-photo-placeholder">+</span>
                )}
                <span className="calendar-day-number">{day}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedCalendarDate && (
        <div className="calendar-detail-backdrop" role="dialog" aria-modal="true" aria-labelledby="calendar-detail-title">
          <div className="calendar-detail-panel">
            <div className="calendar-detail-header">
              <div>
                <h3 id="calendar-detail-title">수영 기록 상세</h3>
                <p>{selectedCalendarDate}</p>
              </div>
              <button className="calendar-detail-close" type="button" onClick={closeCalendarDetail} aria-label="상세정보창 닫기">
                ×
              </button>
            </div>

            <div className="calendar-detail-photo">
              {photoProcessing ? (
                <div className="calendar-detail-photo-empty">사진 처리 중... 잠시만 기다려주세요.</div>
              ) : calendarDraft.photo ? (
                <img src={calendarDraft.photo} alt={`${selectedCalendarDate} 수영 사진 미리보기`} />
              ) : (
                <div className="calendar-detail-photo-empty">사진을 첨부해 기록을 남겨보세요</div>
              )}
            </div>

            <div className="calendar-detail-actions">
              <label className={`btn-calendar-photo btn-calendar-photo-upload ${photoProcessing ? 'disabled' : ''}`}>
                {photoProcessing ? '처리 중...' : '사진 첨부'}
                <input
                  className="calendar-photo-input"
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleCalendarPhotoChange}
                  disabled={photoProcessing}
                />
              </label>
              {calendarDraft.photo && !photoProcessing && (
                <button className="btn-calendar-photo ghost" type="button" onClick={handleRemoveCalendarPhoto}>
                  사진 삭제
                </button>
              )}
            </div>

            <div className="calendar-detail-form">
              <label>
                거리
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={calendarDraft.distance ?? ''}
                  onChange={(e) => updateCalendarDraft('distance', e.target.value)}
                  placeholder="예: 1500m"
                />
              </label>
              <label>
                총 소요시간
                <input
                  type="text"
                  value={calendarDraft.duration ?? ''}
                  onChange={(e) => updateCalendarDraft('duration', e.target.value)}
                  placeholder="예: 45분 30초"
                />
              </label>
              <label>
                심박수
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={calendarDraft.heartRate ?? ''}
                  onChange={(e) => updateCalendarDraft('heartRate', e.target.value)}
                  placeholder="예: 132bpm"
                />
              </label>
              <label>
                수영장 길이
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={calendarDraft.poolLength ?? ''}
                  onChange={(e) => updateCalendarDraft('poolLength', e.target.value)}
                  placeholder="예: 25m"
                />
              </label>
            </div>

            <div className="calendar-detail-footer">
              <button className="btn-calendar-cancel" type="button" onClick={closeCalendarDetail}>취소</button>
              <button className="btn-calendar-save" type="button" onClick={handleSaveCalendarDetail}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 최근 기록 */}
      <div className="recent-records">
        <h3 className="section-subtitle">최근 기록</h3>
        <ul className="recent-list">
          {recentSwimRecords.length === 0 ? (
            <li style={{ color: '#888', textAlign: 'center' }}>아직 기록이 없습니다. 전국 수영일주나 캘린더에서 첫 기록을 남겨보세요!</li>
          ) : (
            recentSwimRecords.map((record) => (
              <li key={record.id}>
                <div className="record-info">
                  <span className="record-region">{record.title}</span>
                  <span className="record-date">
                    {record.date} · {record.sourceLabel}
                  </span>
                </div>
                <span className="record-distance">
                  {record.distance > 0 ? `+${formatDistanceExact(record.distance)}` : '기록'}
                </span>
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
      <button className="btn-reset" onClick={onResetRecords}>모든 기록 초기화</button>
    </section>
  );
}

// 지도 탭 컴포넌트 - 홈의 모든 기능 + 지도
function MapTab({ state, updateState }: { state: GameState; updateState: (fn: (prev: GameState) => GameState) => void }) {
  const [distanceInput, setDistanceInput] = useState('');
  const [selectedCourseIdx, setSelectedCourseIdx] = useState<number | null>(null);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const region = state.currentRegion;
  const regionData = REGIONS[region];
  const progress = state.regionProgress[region];

  const handleSelectRegion = (regionName: string) => {
    setSelectedCourseIdx(null);
    setDistanceInput('');
    setShowAllCourses(false);
    updateState(prev => ({
      ...prev,
      currentRegion: regionName,
      selectedCourseRegion: regionName,
    }));
  };

  const applySwimmingRecord = (distance: number, courseIdx: number, source: SwimRecordSource = 'manual', externalId?: string) => {
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
      const region = newState.currentRegion;
      const regionData = REGIONS[region];
      const progress = newState.regionProgress[region];

      // 배지 체크
      if (!newState.badges.includes('first_swim')) {
        newState.badges = [...newState.badges, 'first_swim'];
      }

      newState.totalDistance += distance;
      newState.todayDistance += distance;
      newState.monthDistance += distance;

      // 기록 추가
      const now = new Date();
      const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      newState.records = [{ region, distance, date: dateStr, source, externalId, createdAt: now.toISOString() }, ...newState.records].slice(0, 5);

      // 배지 체크
      if (newState.totalDistance >= 10000 && !newState.badges.includes('total_10km')) {
        newState.badges = [...newState.badges, 'total_10km'];
      }
      if (newState.totalDistance >= 30000 && !newState.badges.includes('total_30km')) {
        newState.badges = [...newState.badges, 'total_30km'];
      }

      // 선택한 코스에만 기록 누적 (자동으로 다음 코스로 넘어가지 않음)
      const targetCourse = courseIdx;
      const courseGoal = regionData.courses[targetCourse];
      progress.courseProgress[targetCourse] += distance;

      // 현재 진행 중인 코스(currentCourse)인 경우 currentProgress도 동기화
      if (progress.currentCourse === targetCourse) {
        progress.currentProgress = progress.courseProgress[targetCourse];
      }

      // 목표 도달 시 완료 처리 (초과해서 누적 가능)
      if (progress.courseProgress[targetCourse] >= courseGoal && !progress.completedCourses[targetCourse]) {
        progress.completedCourses[targetCourse] = true;
        if (!newState.badges.includes('first_course')) {
          newState.badges = [...newState.badges, 'first_course'];
        }
        // 다음 미완료 코스로 currentCourse 이동 (자동 누적 X, 표시용)
        if (progress.currentCourse === targetCourse) {
          let nextCourse = targetCourse + 1;
          while (nextCourse < 5 && progress.completedCourses[nextCourse]) nextCourse++;
          if (nextCourse < 5) {
            progress.currentCourse = nextCourse;
            progress.currentProgress = 0;
          }
        }
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
  };

  const handleSaveRecord = () => {
    const distance = parseFloat(distanceInput);
    if (isNaN(distance) || distance <= 0) return;
    if (selectedCourseIdx === null) {
      alert('기록을 저장할 코스를 먼저 선택해주세요.');
      return;
    }

    applySwimmingRecord(distance, selectedCourseIdx, 'manual');
    setDistanceInput('');
  };

  return (
    <section id="map-tab" className="tab-content active">
      {/* 오늘의 코스 멘트 */}
      <h2 className="pool-plain-title">오늘의 코스는?</h2>

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

      {/* 지도 + 지역 선택 좌우 분할 */}
      <div className="map-region-split">
        {/* 왼쪽: 한국 지도 (40% 축소) */}
        <div className="custom-map image-map map-small">
          <div className="map-image-wrapper">
            <img src="/swim-map.png" alt="대한민국 수영 지도" className="korea-map-img" />
            {Object.entries(REGIONS).map(([regionName, regionData]) => {
              const progress = state.regionProgress[regionName];
              const xPct = (regionData.mapPos.x / MAP_IMAGE_WIDTH) * 100;
              const yPct = (regionData.mapPos.y / MAP_IMAGE_HEIGHT) * 100;
              let markerClass = 'map-point';
              if (regionName === state.currentRegion) markerClass += ' current';

              return (
                <div
                  key={regionName}
                  className={markerClass}
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                  onClick={() => handleSelectRegion(regionName)}
                  title={regionName}
                />
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 지역 선택 리스트 */}
        <div className="region-list-side">
          <h3 className="section-subtitle">지역 선택</h3>
          <div className="region-buttons-vertical">
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
                  onClick={() => handleSelectRegion(regionName)}
                >
                  {REGIONS[regionName]?.emoji} {regionName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <HomeCoursesSection
        region={region}
        regionData={regionData}
        progress={progress}
        selectedCourseIdx={selectedCourseIdx}
        setSelectedCourseIdx={setSelectedCourseIdx}
        distanceInput={distanceInput}
        setDistanceInput={setDistanceInput}
        onSaveRecord={handleSaveRecord}
        showAllCourses={showAllCourses}
        setShowAllCourses={setShowAllCourses}
      />
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
  distanceInput,
  setDistanceInput,
  onSaveRecord,
  showAllCourses,
  setShowAllCourses,
}: {
  region: string;
  regionData: RegionData;
  progress: RegionProgress;
  selectedCourseIdx: number | null;
  setSelectedCourseIdx: (idx: number | null) => void;
  distanceInput: string;
  setDistanceInput: Dispatch<SetStateAction<string>>;
  onSaveRecord: () => void;
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
        onClick={() => {
          setSelectedCourseIdx(i);
          setDistanceInput('');
        }}
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
        {isCompleted && <span className="course-achievement-stamp">달성</span>}
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
          distanceInput={distanceInput}
          setDistanceInput={setDistanceInput}
          onSaveRecord={onSaveRecord}
        />
      )}
    </div>
  );
}

// 코스 상세 정보 컴포넌트 - RouteMap + 코스 정보
function CourseDetail({
  region,
  regionData,
  courseIdx,
  progress,
  distanceInput,
  setDistanceInput,
  onSaveRecord,
}: {
  region: string;
  regionData: RegionData;
  courseIdx: number;
  progress: { courseProgress: number[]; completedCourses: boolean[]; currentProgress: number; currentCourse: number };
  distanceInput: string;
  setDistanceInput: Dispatch<SetStateAction<string>>;
  onSaveRecord: () => void;
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

          <div className="course-record-form">
            <label htmlFor={`course-distance-${region}-${courseIdx}`}>이 코스에 기록 추가</label>
            <div className="course-record-group">
              <input
                id={`course-distance-${region}-${courseIdx}`}
                type="number"
                value={distanceInput}
                onChange={(event) => setDistanceInput(event.target.value)}
                placeholder="거리 입력 (m)"
                min="0"
                step="1"
                onKeyDown={(event) => event.key === 'Enter' && onSaveRecord()}
              />
              <button className="btn-primary" type="button" onClick={onSaveRecord}>기록하기</button>
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

// 이달의 목표 탭 컴포넌트
function MonthlyGoalsTab({
  goals,
  onGoalsChange,
}: {
  goals: MonthlyGoal[];
  onGoalsChange: (goals: MonthlyGoal[]) => void;
}) {
  const completedGoalCount = goals.filter((goal) => goal.completed).length;
  const completionRate = goals.length > 0 ? Math.round((completedGoalCount / goals.length) * 100) : 0;
  const canAddGoal = goals.length < MAX_MONTHLY_GOALS;

  const updateGoals = (updater: (prev: MonthlyGoal[]) => MonthlyGoal[]) => {
    onGoalsChange(normalizeMonthlyGoals(updater(goals)));
  };

  const handleToggleGoal = (goalId: string) => {
    updateGoals((prev) =>
      prev.map((goal) =>
        goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
      )
    );
  };

  const handleGoalTextChange = (goalId: string, text: string) => {
    updateGoals((prev) =>
      prev.map((goal) =>
        goal.id === goalId ? { ...goal, text } : goal
      )
    );
  };

  const handleAddGoal = () => {
    if (!canAddGoal) return;
    updateGoals((prev) => [...prev, createMonthlyGoal(prev.length)]);
  };

  return (
    <section id="monthly-goals-tab" className="tab-content active">
      <h2 className="section-title">이달의 목표</h2>

      <div className="monthly-goals-panel">
        <div className="monthly-goals-list">
          {goals.map((goal, index) => (
            <label key={goal.id} className={`monthly-goal-item ${goal.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                checked={goal.completed}
                onChange={() => handleToggleGoal(goal.id)}
                aria-label={`${index + 1}번째 목표 완료 체크`}
              />
              <textarea
                value={goal.text}
                onChange={(event) => handleGoalTextChange(goal.id, event.target.value)}
                placeholder={`${index + 1}번째 목표를 적어주세요`}
                rows={2}
              />
            </label>
          ))}
        </div>

        <button
          className="monthly-goal-add"
          type="button"
          onClick={handleAddGoal}
          disabled={!canAddGoal}
        >
          {canAddGoal ? '+ 목표 추가' : '최대 10개까지 생성 가능'}
        </button>

        <div className="monthly-goals-progress" aria-label={`목표 달성률 ${completionRate}%`}>
          <span>{completedGoalCount}/{goals.length} 완료</span>
          <strong>{completionRate}%</strong>
        </div>
      </div>
    </section>
  );
}
