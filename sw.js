/* 팀. 피오르드 — 오프라인 지원 서비스워커
   전략:
   - HTML 문서: 네트워크 우선(온라인이면 항상 최신) → 오프라인이면 캐시
   - 정적 자원(아이콘·Leaflet 등): 캐시 우선 → 네트워크 폴백
   - 지도 타일: 캐시 안 함(용량이 큼) → 온라인에서만 표시
   앱을 업데이트하면 아래 CACHE 버전을 올려 예전 캐시를 비운다. */
const CACHE = 'nordic-trip-v1';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(CORE.map((u) => c.add(u))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 지도 타일은 캐시하지 않고 네트워크 기본 처리
  if (/tile|openstreetmap|arcgisonline|basemaps|cartocdn|osm/i.test(url.href)) return;

  // HTML 문서(네비게이션): 네트워크 우선
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 그 외 정적 자원: 캐시 우선 → 네트워크 폴백(성공 시 캐시 갱신)
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 &&
            (url.origin === location.origin || /cdnjs|unpkg/.test(url.href))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
