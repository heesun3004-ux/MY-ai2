// 지역 데이터
export interface RegionData {
  emoji: string;
  courses: number[];
  courseNames: string[];
  courseImages: string[];
  courseImageAlts: string[];
  courseArtRoutes: string[];
  mapPos: { x: number; y: number };
}

export const REGIONS: Record<string, RegionData> = {
  "서울": {
    "emoji": "🗼",
    "courses": [
      1600,
      2800,
      3700,
      5200,
      6800
    ],
    "courseNames": [
      "성수 수변 카페길",
      "한강 반포 물길",
      "잠실 석촌호수",
      "여의도 한강 물길",
      "난지 한강 갈대길"
    ],
    "courseImages": [
      "/course-images/seoul-seongsu-cafe-waterfront.png",
      "/course-images/seoul-banpo-hangang.png",
      "/course-images/seoul-seokchon-lake.png",
      "/course-images/seoul-yeouido-hangang.png",
      "/course-images/seoul-nanji-hangang.png"
    ],
    "courseImageAlts": [
      "성수 카페거리와 한강 수변을 담은 감성 수영 코스 이미지",
      "반포대교와 한강 물길을 담은 야간 수영 코스 이미지",
      "잠실 석촌호수의 고요한 수면을 담은 수영 코스 이미지",
      "여의도 한강공원의 노을 물길을 담은 수영 코스 이미지",
      "난지 한강 갈대와 강물을 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 12 66 C 24 55, 34 58, 43 49 S 64 37, 82 31",
      "M 10 60 C 26 51, 36 48, 48 43 S 70 41, 88 29",
      "M 18 66 C 30 45, 50 42, 61 55 S 78 66, 86 43",
      "M 9 70 C 27 64, 38 54, 53 49 S 72 42, 90 35",
      "M 11 62 C 24 68, 38 58, 47 50 S 66 34, 87 39"
    ],
    "mapPos": {
      "x": 362,
      "y": 292
    }
  },
  "제주": {
    "emoji": "🍊",
    "courses": [
      1700,
      2900,
      3900,
      5500,
      7000
    ],
    "courseNames": [
      "협재 바다",
      "애월 해안 물길",
      "성산 일출봉 해안",
      "우도 바람 물길",
      "중문 파도길"
    ],
    "courseImages": [
      "/course-images/jeju-hyeopjae-beach.png",
      "/course-images/jeju-aewol-coast.png",
      "/course-images/jeju-seongsan-coast.png",
      "/course-images/jeju-udo-island.png",
      "/course-images/jeju-jungmun-beach.png"
    ],
    "courseImageAlts": [
      "협재 바다의 에메랄드 수면을 담은 수영 코스 이미지",
      "애월 해안의 현무암과 바다를 담은 수영 코스 이미지",
      "성산 일출봉 해안 물길을 담은 수영 코스 이미지",
      "우도 바람과 섬 바다를 담은 수영 코스 이미지",
      "중문 파도와 절벽 바다를 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 13 62 C 27 50, 40 52, 51 44 S 70 36, 87 42",
      "M 11 58 C 22 47, 38 45, 48 53 S 66 65, 86 52",
      "M 16 68 C 26 55, 39 46, 54 50 S 74 56, 88 38",
      "M 12 56 C 28 41, 45 40, 56 49 S 72 62, 88 50",
      "M 10 65 C 26 70, 32 48, 47 51 S 62 68, 86 47"
    ],
    "mapPos": {
      "x": 435,
      "y": 1249
    }
  },
  "부산": {
    "emoji": "🌉",
    "courses": [
      1500,
      2700,
      3800,
      5100,
      6700
    ],
    "courseNames": [
      "광안리 해변",
      "해운대 달맞이 바다",
      "영도 흰여울 해안",
      "송도 바다 물길",
      "다대포 낙조 물길"
    ],
    "courseImages": [
      "/course-images/busan-gwangalli-beach.png",
      "/course-images/busan-haeundae-beach.png",
      "/course-images/busan-yeongdo-coast.png",
      "/course-images/busan-songdo-beach.png",
      "/course-images/busan-dadaepo-beach.png"
    ],
    "courseImageAlts": [
      "광안리와 광안대교 야경 바다를 담은 수영 코스 이미지",
      "해운대와 달맞이 해안의 새벽 바다를 담은 수영 코스 이미지",
      "영도 흰여울 해안 절벽과 바다를 담은 수영 코스 이미지",
      "송도 해변과 해상 케이블카 바다를 담은 수영 코스 이미지",
      "다대포 낙조와 얕은 바다를 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 10 64 C 25 55, 35 51, 47 47 S 70 42, 88 34",
      "M 12 67 C 27 60, 39 48, 52 45 S 73 47, 88 37",
      "M 14 59 C 23 51, 35 62, 48 53 S 65 39, 86 45",
      "M 11 70 C 25 58, 42 59, 53 50 S 68 42, 87 53",
      "M 9 61 C 26 66, 41 63, 54 55 S 72 47, 90 51"
    ],
    "mapPos": {
      "x": 865,
      "y": 936
    }
  },
  "경주": {
    "emoji": "🏯",
    "courses": [
      1600,
      2500,
      3600,
      5400,
      6600
    ],
    "courseNames": [
      "보문호수 물길",
      "감포 나정 바다",
      "오류 고아라 해변",
      "봉길 대왕암 물길",
      "전촌 솔밭 바다"
    ],
    "courseImages": [
      "/course-images/gyeongju-bomun-lake.png",
      "/course-images/gyeongju-gampo-najeong.png",
      "/course-images/gyeongju-oryu-beach.png",
      "/course-images/gyeongju-bonggil-daewangam.png",
      "/course-images/gyeongju-jeonchon-solbat.png"
    ],
    "courseImageAlts": [
      "경주 보문호수의 고요한 수면을 담은 수영 코스 이미지",
      "감포 나정 해변의 동해 바다를 담은 수영 코스 이미지",
      "오류 고아라 해변의 맑은 바다를 담은 수영 코스 이미지",
      "봉길 대왕암 해안의 일출 바다를 담은 수영 코스 이미지",
      "전촌 솔밭 해변의 소나무와 바다를 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 18 65 C 30 49, 47 47, 58 58 S 78 64, 86 42",
      "M 12 58 C 29 48, 40 53, 52 45 S 73 36, 88 44",
      "M 10 63 C 25 54, 38 56, 50 49 S 70 39, 89 42",
      "M 15 70 C 29 63, 37 46, 51 51 S 69 61, 87 39",
      "M 12 61 C 28 66, 39 57, 52 52 S 69 48, 87 55"
    ],
    "mapPos": {
      "x": 955,
      "y": 743
    }
  },
  "강원": {
    "emoji": "⛰️",
    "courses": [
      1700,
      2800,
      4000,
      5600,
      6900
    ],
    "courseNames": [
      "속초 바다",
      "강릉 경포 물길",
      "양양 서피 바다",
      "춘천 의암호",
      "정동진 일출 바다"
    ],
    "courseImages": [
      "/course-images/gangwon-sokcho-beach.png",
      "/course-images/gangwon-gyeongpo-beach.png",
      "/course-images/gangwon-yangyang-surfyy.png",
      "/course-images/gangwon-uiam-lake.png",
      "/course-images/gangwon-jeongdongjin-beach.png"
    ],
    "courseImageAlts": [
      "속초 해변과 설악 능선을 담은 수영 코스 이미지",
      "강릉 경포 해변의 소나무와 바다를 담은 수영 코스 이미지",
      "양양 서피 해변의 파도를 담은 수영 코스 이미지",
      "춘천 의암호의 안개 낀 호수를 담은 수영 코스 이미지",
      "정동진 일출 바다를 담은 장거리 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 10 62 C 25 51, 38 48, 50 43 S 71 35, 88 41",
      "M 13 66 C 26 57, 42 55, 53 49 S 71 43, 87 50",
      "M 12 70 C 23 55, 38 62, 47 50 S 65 38, 86 44",
      "M 18 61 C 31 47, 45 44, 57 54 S 76 65, 87 43",
      "M 9 67 C 25 63, 37 52, 51 48 S 72 39, 90 34"
    ],
    "mapPos": {
      "x": 725,
      "y": 252
    }
  },
  "목포": {
    "emoji": "🚢",
    "courses": [
      1500,
      2400,
      3500,
      4800,
      6400
    ],
    "courseNames": [
      "목포항 물길",
      "갓바위 해안",
      "삼학도 바람 물길",
      "평화광장 바다",
      "외달도 섬 바다"
    ],
    "courseImages": [
      "/course-images/mokpo-harbor.png",
      "/course-images/mokpo-gatbawi-coast.png",
      "/course-images/mokpo-samhakdo.png",
      "/course-images/mokpo-peace-plaza.png",
      "/course-images/mokpo-oedaldo-beach.png"
    ],
    "courseImageAlts": [
      "목포항의 잔잔한 항구 물길을 담은 수영 코스 이미지",
      "목포 갓바위 해안과 바다를 담은 수영 코스 이미지",
      "삼학도 수변과 잔잔한 만을 담은 수영 코스 이미지",
      "목포 평화광장 야간 바다를 담은 수영 코스 이미지",
      "외달도 섬 해변과 남해 바다를 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 12 63 C 24 56, 36 58, 48 50 S 70 39, 86 45",
      "M 13 67 C 26 53, 39 47, 53 52 S 68 63, 87 48",
      "M 11 59 C 28 46, 43 50, 54 58 S 73 63, 88 47",
      "M 10 68 C 27 61, 39 54, 52 52 S 70 46, 89 38",
      "M 14 64 C 26 49, 42 44, 55 48 S 73 58, 86 42"
    ],
    "mapPos": {
      "x": 225,
      "y": 996
    }
  },
  "전주": {
    "emoji": "🥘",
    "courses": [
      1600,
      2300,
      3400,
      4900,
      6300
    ],
    "courseNames": [
      "전주천 물길",
      "덕진공원 연꽃 물길",
      "삼천 물길",
      "아중호수 물길",
      "완산저수지 물길"
    ],
    "courseImages": [
      "/course-images/jeonju-jeonjucheon.png",
      "/course-images/jeonju-deokjin-pond.png",
      "/course-images/jeonju-samcheon-stream.png",
      "/course-images/jeonju-ajung-lake.png",
      "/course-images/jeonju-wansan-reservoir.png"
    ],
    "courseImageAlts": [
      "전주천 도심 수변을 담은 수영 코스 이미지",
      "덕진공원 연꽃 연못을 담은 수영 코스 이미지",
      "전주 삼천의 갈대와 물길을 담은 수영 코스 이미지",
      "아중호수의 저녁 수면을 담은 수영 코스 이미지",
      "완산저수지의 안개 낀 물길을 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 10 66 C 26 58, 38 52, 52 49 S 72 45, 89 36",
      "M 17 64 C 29 47, 47 45, 58 58 S 77 66, 86 43",
      "M 12 59 C 24 51, 38 56, 50 48 S 70 38, 88 46",
      "M 15 67 C 31 57, 42 48, 55 52 S 72 61, 87 45",
      "M 13 62 C 28 48, 43 45, 55 53 S 72 58, 88 40"
    ],
    "mapPos": {
      "x": 359,
      "y": 687
    }
  },
  "광주": {
    "emoji": "🎨",
    "courses": [
      1500,
      2600,
      3800,
      5300,
      6900
    ],
    "courseNames": [
      "광주천 물길",
      "영산강 물길",
      "풍암호수 물길",
      "운천저수지 물길",
      "황룡강 물길"
    ],
    "courseImages": [
      "/course-images/gwangju-gwangjucheon.png",
      "/course-images/gwangju-yeongsan-river.png",
      "/course-images/gwangju-pungam-lake.png",
      "/course-images/gwangju-uncheon-reservoir.png",
      "/course-images/gwangju-hwangryong-river.png"
    ],
    "courseImageAlts": [
      "광주천 도심 물길을 담은 수영 코스 이미지",
      "영산강의 넓은 강물을 담은 수영 코스 이미지",
      "풍암호수공원의 잔잔한 호수를 담은 수영 코스 이미지",
      "운천저수지의 새벽 수면을 담은 수영 코스 이미지",
      "황룡강의 자연 강물을 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 11 64 C 26 56, 38 53, 51 48 S 70 42, 88 46",
      "M 9 69 C 25 61, 40 53, 54 50 S 72 45, 90 37",
      "M 16 62 C 28 47, 45 45, 57 56 S 76 64, 86 42",
      "M 13 66 C 30 55, 42 47, 55 51 S 72 59, 88 44",
      "M 10 60 C 24 49, 39 47, 52 54 S 69 66, 89 51"
    ],
    "mapPos": {
      "x": 350,
      "y": 875
    }
  },
  "대구": {
    "emoji": "🍎",
    "courses": [
      1600,
      2500,
      3700,
      5400,
      6800
    ],
    "courseNames": [
      "신천 물길",
      "금호강 물길",
      "수성못 야경 물길",
      "강정고령보 낙동강",
      "달성습지 물길"
    ],
    "courseImages": [
      "/course-images/daegu-sincheon-stream.png",
      "/course-images/daegu-geumho-river.png",
      "/course-images/daegu-suseong-lake.png",
      "/course-images/daegu-gangjeong-weir.png",
      "/course-images/daegu-dalseong-wetlands.png"
    ],
    "courseImageAlts": [
      "대구 신천 야간 물길을 담은 수영 코스 이미지",
      "금호강의 노을 강물을 담은 수영 코스 이미지",
      "수성못 야경과 반짝이는 수면을 담은 수영 코스 이미지",
      "강정고령보 낙동강의 넓은 물길을 담은 수영 코스 이미지",
      "달성습지의 갈대와 강물을 담은 수영 코스 이미지"
    ],
    "courseArtRoutes": [
      "M 12 65 C 26 57, 39 52, 52 47 S 71 42, 88 50",
      "M 9 68 C 24 61, 39 56, 53 50 S 72 39, 90 42",
      "M 18 63 C 31 47, 48 46, 59 58 S 78 65, 87 44",
      "M 10 59 C 27 50, 42 47, 55 45 S 74 43, 90 36",
      "M 11 64 C 25 70, 39 62, 52 55 S 70 48, 88 52"
    ],
    "mapPos": {
      "x": 734,
      "y": 699
    }
  }
};

// 배지 데이터
export interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const BADGES: Badge[] = [
  { id: 'first_swim', name: '첫 수영 완료', desc: '첫 기록을 입력하세요', icon: '🏊' },
  { id: 'first_course', name: '첫 코스 완주', desc: '첫 코스를 완주하세요', icon: '🏅' },
  { id: 'first_unlock', name: '첫 잠금 해금', desc: '잠긴 코스를 해금하세요', icon: '🔓' },
  { id: 'first_visit', name: '첫 지역 방문', desc: '지역 방문 상태를 달성하세요', icon: '📍' },
  { id: 'first_complete', name: '첫 지역 완주', desc: '지역을 완주하세요', icon: '🏆' },
  { id: 'total_10km', name: '총 10km 달성', desc: '총 10km를 수영하세요', icon: '💪' },
  { id: 'total_30km', name: '총 30km 달성', desc: '총 30km를 수영하세요', icon: '🌟' },
  { id: 'visit_3', name: '지역 3개 방문', desc: '3개 지역을 방문하세요', icon: '🗺️' },
  { id: 'complete_3', name: '지역 3개 완주', desc: '3개 지역을 완주하세요', icon: '👑' },
];

// 코스 이름 가져오기
export function getCourseName(region: string, courseIndex: number): string {
  const regionData = REGIONS[region];
  if (regionData?.courseNames?.[courseIndex]) {
    return regionData.courseNames[courseIndex];
  }
  return ['워밍업 코스', '기본 코스', '시그니처 코스', '롱 코스', '챌린지 코스'][courseIndex];
}

// 거리 포맷팅
export function formatDistanceExact(meters: number): string {
  return `${Math.trunc(meters).toLocaleString('ko-KR')}m`;
}
