'use client';

import { useId } from 'react';

interface RouteMapProps {
  imageSrc: string;
  imageAlt: string;
  routePath: string;
  progress: number;
  endLabel?: string;
}

function getPathPoint(path: string, fallback: { x: number; y: number }, fromEnd = false) {
  const matches = Array.from(path.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g));
  const match = fromEnd ? matches[matches.length - 1] : matches[0];
  if (!match) return fallback;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function getPathXBounds(path: string, fallback: { minX: number; maxX: number }) {
  const matches = Array.from(path.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g));
  if (matches.length === 0) return fallback;

  const xValues = matches.map((match) => Number(match[1]));
  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
  };
}

export default function RouteMap({
  imageSrc,
  imageAlt,
  routePath,
  progress,
  endLabel = 'GOAL',
}: RouteMapProps) {
  const progressClipId = `route-progress-${useId().replace(/:/g, '')}`;

  if (!imageSrc || !routePath) {
    return (
      <div className="route-map route-map-empty">
        <span>코스 이미지 없음</span>
      </div>
    );
  }

  const routeProgressPct = Math.min(Math.max(progress, 0), 1) * 100;
  const progressLabel = Number.isInteger(routeProgressPct)
    ? String(routeProgressPct)
    : routeProgressPct.toFixed(1);
  const start = getPathPoint(routePath, { x: 12, y: 64 });
  const end = getPathPoint(routePath, { x: 88, y: 42 }, true);
  const { minX: routeMinX, maxX: routeMaxX } = getPathXBounds(routePath, {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
  });
  const routeWidth = routeMaxX - routeMinX;
  const clipX = routeProgressPct >= 100 ? 0 : routeMinX;
  const clipWidth = routeProgressPct >= 100
    ? 100
    : (routeWidth * routeProgressPct) / 100;

  return (
    <div className="route-map">
      <img className="route-map-image" src={imageSrc} alt={imageAlt} loading="lazy" />
      <div className="route-map-vignette" />

      <svg className="route-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={progressClipId}>
            <rect
              className="route-art-progress-clip"
              x={clipX}
              y="0"
              width={clipWidth}
              height="100"
            />
          </clipPath>
        </defs>
        <path className="route-art-shadow" d={routePath} pathLength={100} />
        <path className="route-art-remain" d={routePath} pathLength={100} />
        <path
          className="route-art-progress"
          d={routePath}
          pathLength={100}
          clipPath={`url(#${progressClipId})`}
        />
        <circle className="route-art-start" cx={start.x} cy={start.y} r="2.7" />
        <circle className="route-art-end" cx={end.x} cy={end.y} r="2.9" />
      </svg>

      <div className="route-map-labels">
        <span className="route-label route-label-start">출발</span>
        <span className="route-label route-label-end">{endLabel}</span>
      </div>

      <div className="route-map-badge">{progressLabel}%</div>
    </div>
  );
}
