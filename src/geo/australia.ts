/**
 * Simplified geography of Australia for the map view: coastline, state borders, towns weighted by
 * adult population, and per-state gambling context. Coordinates are [longitude, latitude].
 * Outlines are hand-simplified (~80 points) — good enough for a schematic map, not for GIS.
 */
export type LonLat = [number, number];

export const REGIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type RegionId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const REGION_NAMES = ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'ACT', 'Northern Territory'];

/**
 * Relative exposure to gambling availability by state (1 = national average, population-weighted).
 * Driven mainly by electronic gaming machine (pokies) density outside casinos: NSW has about half of
 * Australia's pokies; WA has almost none outside the Perth casino. ASSUMPTION calibrated loosely to
 * Australian Gambling Statistics (QGSO) machine counts per adult.
 */
export const REGION_AVAILABILITY = [1.2, 0.95, 1.05, 0.6, 1.0, 0.95, 0.9, 1.2];
/** Label anchor for each state on the map. */
export const REGION_LABEL: LonLat[] = [[146.5, -32.2], [144.0, -37.0], [144.5, -22.5], [121.5, -26.0], [135.5, -30.0], [146.7, -42.2], [149.6, -35.6], [133.5, -19.5]];

export const MAINLAND: LonLat[] = [
  [142.5, -10.7], [143.5, -12.5], [143.8, -14.0], [145.3, -15.0], [145.5, -16.5], [146.0, -17.6], [146.3, -18.8], [148.8, -20.3], [149.5, -21.5],
  [150.8, -22.5], [151.3, -23.8], [152.8, -25.3], [153.1, -26.5], [153.6, -28.2], [153.4, -29.5], [153.0, -31.0], [152.5, -32.5], [151.3, -33.8],
  [150.9, -34.5], [150.2, -35.8], [150.0, -37.4], [149.0, -37.8], [147.8, -37.9], [146.3, -39.1], [145.0, -38.5], [144.6, -38.2], [143.5, -38.8],
  [142.0, -38.4], [140.9, -38.0], [139.8, -37.3], [139.6, -36.2], [138.5, -35.6], [138.5, -34.9], [138.0, -34.0], [137.8, -33.0], [137.4, -34.2],
  [137.0, -35.2], [136.0, -34.8], [135.6, -34.9], [135.2, -33.5], [134.2, -32.7], [133.0, -32.0], [131.0, -31.5], [129.0, -31.6], [126.0, -32.3],
  [124.0, -33.0], [122.0, -33.9], [119.9, -34.0], [118.0, -35.0], [116.0, -34.9], [115.0, -34.3], [115.6, -33.3], [115.7, -31.9], [115.0, -30.0],
  [114.6, -28.8], [113.5, -26.5], [113.7, -24.0], [113.8, -22.0], [115.5, -21.5], [117.0, -20.7], [118.6, -20.3], [121.0, -19.5], [122.2, -18.0],
  [123.0, -16.5], [124.5, -15.5], [126.0, -14.0], [127.7, -14.5], [128.5, -15.0], [129.4, -14.9], [130.0, -13.3], [130.8, -12.4], [132.0, -11.5],
  [133.5, -11.8], [135.0, -12.2], [136.8, -12.2], [136.0, -13.5], [135.5, -15.0], [137.0, -16.0], [138.0, -16.6], [139.5, -17.4], [140.8, -17.5],
  [141.5, -15.5], [141.6, -13.0], [141.9, -11.0],
];
export const TASMANIA: LonLat[] = [[144.6, -40.7], [146.0, -41.1], [148.3, -40.9], [148.3, -42.2], [147.9, -43.2], [146.9, -43.6], [146.0, -43.5], [145.2, -42.2], [144.7, -41.2]];

const QLD_NSW: LonLat[] = [[141, -29], [148.9, -29], [150.5, -28.6], [152, -28.4], [153.55, -28.2]];
const MURRAY: LonLat[] = [[141, -34.1], [142.4, -34.6], [143.5, -35.3], [144.9, -36.0], [146.6, -36.0], [147.9, -36.1], [148.2, -36.8], [149.9, -37.5]];
const ACT: LonLat[] = [[148.8, -35.15], [149.25, -35.1], [149.4, -35.35], [149.2, -35.9], [148.9, -35.75]];
export const BORDERS: LonLat[][] = [
  [[129, -14.9], [129, -31.6]], // WA
  [[129, -26], [141, -26]], // NT / SA / QLD
  [[138, -16.6], [138, -26]], // NT / QLD
  [[141, -26], [141, -38.0]], // SA / QLD, NSW, VIC
  QLD_NSW, MURRAY, [...ACT, ACT[0]],
];

/** Towns: [lon, lat, share of national adults, region, spread in degrees]. Remaining population scatters near them. */
export const TOWNS: [number, number, number, RegionId, number][] = [
  [151.0, -33.85, 0.205, 0, 0.35], [151.75, -32.9, 0.02, 0, 0.15], [150.85, -34.42, 0.012, 0, 0.1], [148.6, -32.25, 0.006, 0, 0.3], [147.37, -35.1, 0.006, 0, 0.25],
  [146.9, -36.08, 0.005, 0, 0.2], [150.9, -31.1, 0.005, 0, 0.25], [153.1, -30.3, 0.007, 0, 0.25], [149.1, -33.28, 0.006, 0, 0.3], [152.9, -31.43, 0.005, 0, 0.2],
  [145.0, -37.8, 0.195, 1, 0.33], [144.35, -38.15, 0.012, 1, 0.12], [143.85, -37.56, 0.007, 1, 0.15], [144.28, -36.76, 0.007, 1, 0.15], [145.4, -36.38, 0.005, 1, 0.2],
  [146.5, -38.2, 0.005, 1, 0.2], [142.16, -34.2, 0.003, 1, 0.15], [142.48, -38.38, 0.004, 1, 0.15],
  [153.0, -27.45, 0.10, 2, 0.3], [153.4, -28.0, 0.028, 2, 0.12], [153.05, -26.65, 0.014, 2, 0.12], [146.8, -19.25, 0.007, 2, 0.15], [145.77, -16.9, 0.006, 2, 0.15],
  [151.95, -27.56, 0.006, 2, 0.2], [150.5, -23.38, 0.004, 2, 0.2], [149.18, -21.14, 0.004, 2, 0.2], [152.35, -24.87, 0.004, 2, 0.2], [139.49, -20.73, 0.001, 2, 0.2],
  [115.86, -31.95, 0.083, 3, 0.3], [115.64, -33.33, 0.004, 3, 0.15], [114.6, -28.77, 0.002, 3, 0.15], [121.47, -30.75, 0.002, 3, 0.2], [117.88, -35.02, 0.002, 3, 0.15],
  [122.24, -17.96, 0.001, 3, 0.2], [118.6, -20.31, 0.001, 3, 0.2],
  [138.6, -34.93, 0.054, 4, 0.25], [140.78, -37.83, 0.002, 4, 0.15], [137.58, -33.03, 0.002, 4, 0.15], [139.27, -35.12, 0.002, 4, 0.2], [135.86, -34.73, 0.001, 4, 0.15],
  [147.33, -42.88, 0.009, 5, 0.15], [147.14, -41.43, 0.004, 5, 0.15], [146.35, -41.18, 0.002, 5, 0.12], [145.9, -41.05, 0.002, 5, 0.12],
  [149.13, -35.28, 0.017, 6, 0.08],
  [130.85, -12.46, 0.0055, 7, 0.15], [133.88, -23.7, 0.0012, 7, 0.15], [132.26, -14.47, 0.0008, 7, 0.15],
];

export function inPoly(p: LonLat, poly: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const onLand = (p: LonLat) => inPoly(p, MAINLAND) || inPoly(p, TASMANIA);

const interp = (line: LonLat[], lon: number) => {
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    if (lon >= x0 && lon <= x1) return y0 + ((lon - x0) / (x1 - x0)) * (y1 - y0);
  }
  return line[line.length - 1][1];
};

/** Which state a point on land belongs to. */
export function classify(p: LonLat): RegionId {
  const [lon, lat] = p;
  if (inPoly(p, TASMANIA)) return 5;
  if (inPoly(p, ACT)) return 6;
  if (lon < 129) return 3;
  if (lon < 138) return lat > -26 ? 7 : 4;
  if (lon < 141) return lat > -26 ? 2 : 4;
  if (lat > interp(QLD_NSW, lon)) return 2;
  if (lat > interp(MURRAY, Math.min(lon, 149.9))) return 0;
  return 1;
}

/** Map projection: equirectangular, corrected for latitude ~27°S. Returns unit coordinates in [0,1]². */
export const BOUNDS = { lon0: 112.5, lon1: 154.5, lat0: -9.8, lat1: -44.2 };
export const ASPECT = ((BOUNDS.lon1 - BOUNDS.lon0) * Math.cos((27 * Math.PI) / 180)) / (BOUNDS.lat0 - BOUNDS.lat1);
export const project = ([lon, lat]: LonLat): [number, number] => [(lon - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0), (BOUNDS.lat0 - lat) / (BOUNDS.lat0 - BOUNDS.lat1)];

/** Draw a home location for a new agent. Deterministic given rnd. */
export function sampleHome(rnd: () => number): { lon: number; lat: number; region: RegionId } {
  let total = 0;
  for (const t of TOWNS) total += t[2];
  let u = rnd() * total, town = TOWNS[0];
  for (const t of TOWNS) { u -= t[2]; if (u <= 0) { town = t; break; } }
  for (let tries = 0; tries < 30; tries++) {
    // heavier-tailed spread: most people close to the centre, some in the hinterland
    const z1 = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const z2 = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const s = town[4] * (rnd() < 0.15 ? 3 : 1);
    const p: LonLat = [town[0] + z1 * s, town[1] + z2 * s * 0.85];
    if (onLand(p) && classify(p) === town[3]) return { lon: p[0], lat: p[1], region: town[3] };
  }
  return { lon: town[0], lat: town[1], region: town[3] };
}

/** Population-weighted share of each state (from TOWNS). */
export const REGION_SHARE: number[] = (() => {
  const s = new Array(8).fill(0); let tot = 0;
  for (const t of TOWNS) { s[t[3]] += t[2]; tot += t[2]; }
  return s.map((x) => x / tot);
})();
