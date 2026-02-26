import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info, Hash, Activity, Layers, Filter, ChevronLeft, ChevronRight, X, Maximize2, RefreshCcw, Box, Globe, Compass, Zap } from "lucide-react";
import * as d3 from "d3";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MAX_N = 1680;
const WAVES = [2, 3, 5, 7]; // sum = 17

// ─── MATH ENGINE ──────────────────────────────────────────────────────────────
const IS_PRIME = (() => {
  const p = new Array(MAX_N + 1).fill(true);
  p[0] = p[1] = false;
  for (let i = 2; i * i <= MAX_N; i++)
    if (p[i]) for (let j = i * i; j <= MAX_N; j += i) p[j] = false;
  return p;
})();

const PRIME_COUNT = (() => {
  const c = new Array(MAX_N + 1).fill(0);
  for (let i = 1; i <= MAX_N; i++) c[i] = c[i - 1] + (IS_PRIME[i] ? 1 : 0);
  return c;
})();

function isPrimePower(abs: number) {
  if (abs < 2) return false;
  for (let p = 2; p <= abs; p++) {
    if (!IS_PRIME[p]) continue;
    if (abs % p !== 0) continue;
    let m = abs;
    while (m % p === 0) m /= p;
    return m === 1;
  }
  return false;
}

// Triangle wave: position of n in wave of size k → returns left value (0..k)
function waveLeft(n: number, k: number) {
  const m = Math.abs(n) % (2 * k);
  return k - Math.min(m, 2 * k - m);
}

// 17-split: sum of left values across all four waves
function getSplit(n: number, dimension: number = 0) {
  const w2 = waveLeft(n, 2);
  const w3 = waveLeft(n, 3);
  const w5 = waveLeft(n, 5);
  const w7 = waveLeft(n, 7);
  const baseL = w3 + w5 + w7;
  
  // Dimension-based offsets for the 2-beat anchor
  // 0: 17|0, 1: 16|1, 2: 15|2, 3: 0|17, 4: 1|16, 5: 2|15
  const offsets = [2, 1, 0, -2, -1, -0];
  const off = offsets[dimension];
  
  let L: number;
  if (dimension < 3) {
    L = baseL + off;
  } else {
    // Inverses
    L = 17 - (baseL + Math.abs(off));
  }
  
  const R = 17 - L;
  
  // Orthogonal 6-value output
  const orthogonal = [
    { L, R },
    { L: Math.max(0, L - 1), R: Math.min(17, R + 1) },
    { L: Math.max(0, L - 2), R: Math.min(17, R + 2) },
    { L: R, R: L },
    { L: Math.min(17, R + 1), R: Math.max(0, L - 1) },
    { L: Math.min(17, R + 2), R: Math.max(0, L - 2) }
  ];
  
  return { L, R, orthogonal, baseL, w2, w3, w5, w7 };
}

function getFactorization(n: number) {
  const abs = Math.abs(n);
  if (abs < 2) return {} as Record<number, number>;
  const f: Record<number, number> = {};
  let m = abs;
  for (let p = 2; p * p <= m; p++)
    while (m % p === 0) { f[p] = (f[p] || 0) + 1; m /= p; }
  if (m > 1) f[m] = (f[m] || 0) + 1;
  return f;
}

// Transparency: prime count parity (odd count = transparent)
function isTransparent(n: number) {
  const abs = Math.abs(n);
  return abs > 1 && PRIME_COUNT[abs] % 2 === 1;
}

// Even/odd parity axis
function getPolarityAxis(n: number) {
  const abs = Math.abs(n);
  if (abs === 0) return "ORIGIN";
  const t = isTransparent(abs);
  if (abs % 2 === 0) return t ? "TOP (T)" : "BOTTOM (O)";
  return n >= 0 ? (t ? "RIGHT+ (T)" : "LEFT+ (O)") : (t ? "LEFT− (T)" : "RIGHT− (O)");
}

const COLOR_MAP = [
  { label: "Zero",     bg: "#0D0D1A", text: "#4A4A6A", glow: "" },
  { label: "One",      bg: "#0F0F1F", text: "#3A3A5A", glow: "" },
  { label: "Prime",    bg: "#0A0A12", text: "#5A5A72", glow: "rgba(150,150,200,0.15)" },
  { label: "PrimePow", bg: "#0C0C18", text: "#4A4A62", glow: "rgba(120,120,180,0.1)" },
  { label: "Colorless",bg: "#08080C", text: "#3A3A4A", glow: "" },
  
  // Base Colors (2, 3, 7)
  { label: "Blue",     bg: "#001E48", text: "#60B4FF", glow: "rgba(60,140,255,0.4)" },   // 2
  { label: "Yellow",   bg: "#3A2F00", text: "#FFE040", glow: "rgba(255,220,0,0.4)" },   // 3
  { label: "Red",      bg: "#3A0008", text: "#FF7080", glow: "rgba(255,60,80,0.4)" },    // 7
  
  // Combinations
  { label: "Green",    bg: "#003D20", text: "#80FFB0", glow: "rgba(0,255,100,0.3)" },   // 2 & 3 (not red)
  { label: "Purple",   bg: "#25004A", text: "#D090FF", glow: "rgba(160,80,255,0.35)" },  // 2 & 7 (not yellow)
  { label: "Orange",   bg: "#4A2000", text: "#FFAA60", glow: "rgba(255,140,0,0.35)" },  // 3 & 7 (not blue)
  { label: "Brown",    bg: "#3E1A0A", text: "#D7A080", glow: "rgba(180,100,40,0.3)" },   // 2 & 3 & 7 (42)
  
  // 5-based
  { label: "Silver",   bg: "#404050", text: "#D0D0E0", glow: "rgba(192,192,220,0.25)" }, // 5
  { label: "Gold",     bg: "#7A6000", text: "#FFE57F", glow: "rgba(255,215,0,0.4)" },    // 2 & 5
  { label: "Golden Brown", bg: "#7C5800", text: "#FFE082", glow: "rgba(255,200,0,0.3)" }, // 2 & 3 & 5 & 7
  
  { label: "Composite",bg: "#141420", text: "#606080", glow: "" },
];

function isColorless(n: number) {
  const abs = Math.abs(n);
  if (abs < 2 || IS_PRIME[abs]) return false;
  
  // Single digit primes are never colorless
  if (abs === 2 || abs === 3 || abs === 5 || abs === 7) return false;
  
  // Rule: exempt any prime times any prime that is even (i.e. even numbers)
  if (abs % 2 === 0) return false;
  
  const factors = getFactorization(abs);
  const keys = Object.keys(factors).map(Number);
  const totalFactors = Object.values(factors).reduce((a, b) => a + b, 0);
  
  // Rule: prime to any prime except for even primes
  if (keys.length === 1) {
    const p = keys[0];
    const q = factors[p];
    if (IS_PRIME[q] && q % 2 === 0) return false;
    if (IS_PRIME[q] && q % 2 !== 0) return true;
  }
  
  // Rule: prime times any none even prime
  if (totalFactors === 2) {
    if (keys.length === 2) return true;
  }
  
  return false;
}

function getColorInfo(n: number, dimension: number = 0) {
  const abs = Math.abs(n);
  const isNeg = n < 0;
  
  if (abs === 0) return COLOR_MAP[0];
  if (abs === 1) return COLOR_MAP[1];
  
  // Dimension-based color shifts for Blue(5), Yellow(6), Red(7)
  const shifts = [
    [5, 6, 7], // Dim 0
    [6, 7, 5], // Dim 1
    [7, 5, 6], // Dim 2
    [5, 7, 6], // Dim 3
    [6, 5, 7], // Dim 4
    [7, 6, 5], // Dim 5
  ];
  const [c2, c3, c7] = shifts[dimension];
  
  // Derived combination colors
  const cGreen = 8, cPurple = 9, cOrange = 10, cBrown = 11;

  // Multiples of 2, 3, 5, 7 are Golden Brown
  if (abs % 2 === 0 && abs % 3 === 0 && abs % 5 === 0 && abs % 7 === 0) return COLOR_MAP[14];

  // Multiples of 2 and 5 are Gold
  if (abs % 2 === 0 && abs % 5 === 0) return COLOR_MAP[13];
  
  // Multiples of 5 are Silver
  if (abs % 5 === 0) return COLOR_MAP[12];
  
  // Multiples of 2, 3, 7
  const b2 = abs % 2 === 0, b3 = abs % 3 === 0, b7 = abs % 7 === 0;
  
  if (isNeg) {
    if (b2 && b3 && b7) return COLOR_MAP[cBrown];
    if (b3 && b7) return COLOR_MAP[c2];        // Opposite of 3&7
    if (b2 && b3) return COLOR_MAP[c7];        // Opposite of 2&3
    if (b2 && b7) return COLOR_MAP[c3];        // Opposite of 2&7
    if (b2) return COLOR_MAP[cOrange];         // Opposite of 2
    if (b3) return COLOR_MAP[cPurple];         // Opposite of 3
    if (b7) return COLOR_MAP[cGreen];          // Opposite of 7
  } else {
    if (b2 && b3 && b7) return COLOR_MAP[cBrown];
    if (b3 && b7) return COLOR_MAP[cOrange];
    if (b2 && b3) return COLOR_MAP[cGreen];
    if (b2 && b7) return COLOR_MAP[cPurple];
    if (b2) return COLOR_MAP[c2];
    if (b3) return COLOR_MAP[c3];
    if (b7) return COLOR_MAP[c7];
  }
  
  if (abs === 2) return COLOR_MAP[c2];
  if (abs === 3) return COLOR_MAP[c3];
  if (abs === 7) return COLOR_MAP[c7];
  
  if (isColorless(n)) return COLOR_MAP[4];
  if (IS_PRIME[abs]) return COLOR_MAP[2];
  if (isPrimePower(abs)) return COLOR_MAP[3];

  return COLOR_MAP[15];
}

// Pre-compute everything for speed
const CELL_DATA = Array.from({ length: MAX_N + 1 }, (_, n) => {
  const { L, R, orthogonal } = getSplit(n);
  const ci = getColorInfo(n);
  const tr = isTransparent(n);
  return { n, L, R, orthogonal, ci, tr };
});

const NEG_CELL_DATA = Array.from({ length: MAX_N }, (_, i) => {
  const n = -(i + 1);
  const { L, R, orthogonal } = getSplit(n);
  const ci = getColorInfo(n);
  const tr = isTransparent(n);
  return { n, L, R, orthogonal, ci, tr };
}).reverse();

const ALL_DATA = [...NEG_CELL_DATA, ...CELL_DATA];

// ─── SVG WAVE CURVE ───────────────────────────────────────────────────────────
function WaveSVG({ n, k, color }: { n: number; k: number; color: string }) {
  const W = 220, H = 48;
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    svg.call(zoom);
    
    // Initial center
    svg.call(zoom.transform, d3.zoomIdentity);
  }, []);

  const resetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  };

  const period = 2 * k;
  const steps = period * 3;
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const x = (i / steps) * W;
    const pos = i % period;
    const lv = k - Math.min(pos, period - pos);
    const y = H - 4 - ((lv / k) * (H - 12));
    return `${x},${y}`;
  });
  
  const cyclePos = Math.abs(n) % period;

  return (
    <div className="relative group">
      <svg 
        ref={svgRef}
        width="100%" 
        height={H} 
        viewBox={`0 0 ${W} ${H}`}
        className="block overflow-hidden cursor-grab active:cursor-grabbing touch-none bg-black/20 rounded-lg border border-white/5"
      >
        <defs>
          <linearGradient id={`wg${k}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="40%" stopColor={color} stopOpacity="0.8" />
            <stop offset="60%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <g transform={transform.toString()}>
          <polyline
            points={pts.join(" ")}
            fill="none"
            stroke={`url(#wg${k})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {(() => {
            const mx = (cyclePos / period) * (W / 3) + W / 3;
            const lv = waveLeft(n, k);
            const my = H - 4 - ((lv / k) * (H - 12));
            return (
              <g>
                <line 
                  x1={mx} y1={-H * 10} x2={mx} y2={H * 10} 
                  stroke={color} strokeWidth="0.5" strokeDasharray="2,3" strokeOpacity="0.4" 
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={mx} cy={my} r="3" fill={color} className="drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
              </g>
            );
          })()}
        </g>
      </svg>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={resetZoom}
          className="p-1 bg-black/60 rounded border border-white/10 hover:bg-black/80 transition-colors"
          title="Reset Zoom"
        >
          <RefreshCcw className="w-2.5 h-2.5 text-white/60" />
        </button>
      </div>
    </div>
  );
}

// ─── NUMBER CELL ──────────────────────────────────────────────────────────────
const GRID_COLS = 14;
const PAGE_SIZE = GRID_COLS * 10;

interface NumberCellProps {
  d: {
    n: number;
    L: number;
    R: number;
    ci: {
      label: string;
      bg: string;
      text: string;
      glow: string;
    };
    tr: boolean;
  };
  selected: number | null;
  onClick: (n: number) => void;
  key?: React.Key;
}

function NumberCell({ d, selected, onClick }: NumberCellProps) {
  const { n, L, R, ci, tr } = d;
  const isSelected = selected === n;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: tr ? 0.38 : 1, scale: 1 }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      onClick={() => onClick(n)}
      className={`relative p-1 text-center cursor-pointer transition-all duration-200 rounded-sm border ${
        isSelected ? "border-indigo-400 ring-2 ring-indigo-400/50 z-10" : "border-white/5"
      }`}
      style={{
        background: ci.bg,
        color: ci.text,
        boxShadow: isSelected
          ? "0 0 15px rgba(129, 140, 248, 0.5)"
          : ci.glow ? `0 0 8px ${ci.glow}` : "none",
      }}
      title={`${n}: ${ci.label} | ${L}|${R}`}
    >
      <div className="text-[0.65rem] font-bold tracking-tighter">{n}</div>
      <div className="text-[0.45rem] opacity-60 font-mono leading-none">
        {L}|{R}
      </div>
    </motion.div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function NumberVolumeSpace() {
  const [page, setPage] = useState(0);
  const [showNeg, setShowNeg] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [colorFilter, setColorFilter] = useState("all");
  const [splitFilter, setSplitFilter] = useState<number | null>(null);
  const [dimension, setDimension] = useState(0);

  // Re-compute data based on dimension
  const sourceData = useMemo(() => {
    const base = showNeg ? ALL_DATA : CELL_DATA;
    return base.map(d => {
      const { L, R, orthogonal } = getSplit(d.n, dimension);
      const ci = getColorInfo(d.n, dimension);
      return { ...d, L, R, orthogonal, ci };
    });
  }, [showNeg, dimension]);

  const filteredData = useMemo(() => {
    let d = sourceData;
    if (colorFilter !== "all")
      d = d.filter((x) => x.ci.label.toLowerCase() === colorFilter);
    if (splitFilter !== null)
      d = d.filter((x) => x.L === splitFilter);
    return d;
  }, [sourceData, colorFilter, splitFilter]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pageData = useMemo(
    () => filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredData, page]
  );

  const selectedDetail = useMemo(() => {
    if (selected === null) return null;
    const abs = Math.abs(selected);
    const { L, R, orthogonal, baseL, w2, w3, w5, w7 } = getSplit(selected, dimension);
    const ci = getColorInfo(selected, dimension);
    const tr = isTransparent(selected);
    const factors = getFactorization(selected);
    const axis = getPolarityAxis(selected);
    const waveBreakdown = [
      { k: 2, left: w2, right: 2 - w2 },
      { k: 3, left: w3, right: 3 - w3 },
      { k: 5, left: w5, right: 5 - w5 },
      { k: 7, left: w7, right: 7 - w7 },
    ];
    const isPrime = IS_PRIME[abs];
    
    // Prime Bending (210 cycle)
    const cyclePos = abs % 210;
    const bendingCounterpart = (210 - cyclePos) % 210;
    const isBendingPrime = [11, 13, 17, 19, 191, 193, 197, 199].includes(cyclePos);
    const bendingPair = isBendingPrime ? (210 - cyclePos) : null;
    
    return { n: selected, abs, L, R, orthogonal, baseL, ci, tr, factors, axis, waveBreakdown, isPrime, isCorner: isBendingPrime, cyclePos, bendingCounterpart, bendingPair };
  }, [selected, dimension]);

  const handleSelect = useCallback((n: number) => setSelected((s) => (s === n ? null : n)), []);

  // Split distribution for the current filtered set
  const splitDist = useMemo(() => {
    const counts = new Array(18).fill(0);
    filteredData.forEach((d) => counts[d.L]++);
    return counts;
  }, [filteredData]);

  const maxSplitCount = Math.max(...splitDist);

  const colorOptions = [
    "all", "prime", "primepow", "colorless", "blue", "yellow", "red",
    "green", "purple", "orange", "brown", "silver", "gold", "golden brown", "composite",
  ];

  return (
    <div className="flex flex-col h-screen bg-[#06060F] text-[#B0B0D0] font-mono overflow-hidden">
      {/* ── HEADER ── */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-[#0A0A1A]/80 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-1.5 sm:p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-bold tracking-widest text-[#C0B8E8] uppercase leading-none">Number Volume Space</h1>
            <p className="text-[0.5rem] sm:text-[0.6rem] text-indigo-400/60 mt-1">
              0–{MAX_N} • WAVES {WAVES.join("+")}=17
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
          {/* Dimension Navigator */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            {[0, 1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`w-7 h-7 flex items-center justify-center rounded text-[0.6rem] font-bold transition-all ${
                  dimension === d 
                    ? "bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                    : "text-indigo-300/40 hover:bg-white/5"
                }`}
                title={`Dimension ${d}: ${d < 3 ? 'Pos' : 'Inv'} ${d % 3}`}
              >
                D{d}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <label className="flex items-center gap-2 text-[0.65rem] sm:text-[0.7rem] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showNeg}
                onChange={(e) => { setShowNeg(e.target.checked); setPage(0); }}
                className="w-3 h-3 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-0"
              />
              ±{MAX_N}
            </label>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 opacity-40" />
              <select
                value={colorFilter}
                onChange={(e) => { setColorFilter(e.target.value); setPage(0); }}
                className="bg-transparent border-none text-[0.65rem] sm:text-[0.7rem] text-indigo-300 focus:ring-0 cursor-pointer p-0 pr-4"
              >
                {colorOptions.map((o) => (
                  <option key={o} value={o} className="bg-[#0E0E20]">{o === "all" ? "All Colors" : o.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 sm:p-1.5 rounded-md bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-indigo-300/80 min-w-[2.5rem] sm:min-w-[3rem] text-center">
              {page + 1}/{totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 sm:p-1.5 rounded-md bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* ── GRID AREA ── */}
        <section className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {/* Complex Volume Navigator */}
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[0, 1, 2, 3, 4, 5].map((d) => {
              const { L, R } = getSplit(0, d);
              const isActive = dimension === d;
              return (
                <button
                  key={d}
                  onClick={() => setDimension(d)}
                  className={`relative p-3 rounded-xl border transition-all duration-500 group overflow-hidden ${
                    isActive 
                      ? "bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20" 
                      : "bg-white/2 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[0.5rem] font-bold tracking-widest uppercase ${isActive ? 'text-indigo-300' : 'opacity-30'}`}>
                      Dim {d}
                    </span>
                    <Box className={`w-3 h-3 ${isActive ? 'text-indigo-400' : 'opacity-20'}`} />
                  </div>
                  <div className={`text-xl font-bold tracking-tighter ${isActive ? 'text-white' : 'opacity-40'}`}>
                    {L}|{R}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${isActive ? 'bg-indigo-400/40' : 'bg-white/5'}`} />
                    ))}
                  </div>
                  {isActive && (
                    <motion.div 
                      layoutId="dim-glow"
                      className="absolute inset-0 bg-indigo-500/5 pointer-events-none"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Split Distribution Bar */}
          <div className="mb-8 p-4 bg-white/2 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[0.65rem] font-bold tracking-widest uppercase opacity-60">17-Split Distribution</span>
              </div>
              <span className="text-[0.6rem] opacity-40 italic">Click bars to filter by split value</span>
            </div>
            <div className="flex gap-1 items-end h-12">
              {splitDist.map((cnt, L) => (
                <div
                  key={L}
                  onClick={() => {
                    setSplitFilter(splitFilter === L ? null : L);
                    setPage(0);
                  }}
                  className={`flex-1 transition-all duration-300 cursor-pointer relative group ${
                    splitFilter === L ? "bg-indigo-400" : "bg-indigo-400/20 hover:bg-indigo-400/40"
                  }`}
                  style={{
                    height: maxSplitCount > 0 ? `${Math.max(4, (cnt / maxSplitCount) * 100)}%` : "4%",
                    borderRadius: "2px 2px 0 0",
                  }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-[#1A1A2E] border border-white/10 px-1.5 py-0.5 rounded text-[0.5rem] whitespace-nowrap">
                      {L}|{17-L}: {cnt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[0.5rem] opacity-30 font-bold">
              <span>0|17</span>
              <span>8|9</span>
              <span>17|0</span>
            </div>
          </div>

          {/* Number Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-14 gap-1.5">
            <AnimatePresence mode="popLayout">
              {pageData.map((d) => (
                <NumberCell key={d.n} d={d} selected={selected} onClick={handleSelect} />
              ))}
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="mt-12 flex flex-wrap gap-3 p-4 bg-white/2 rounded-xl border border-white/5">
            {COLOR_MAP.filter((_, i) => i > 1).map((cm) => (
              <button
                key={cm.label}
                onClick={() => {
                  setColorFilter(colorFilter === cm.label.toLowerCase() ? "all" : cm.label.toLowerCase());
                  setPage(0);
                }}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md border transition-all duration-200 ${
                  colorFilter === cm.label.toLowerCase() 
                    ? "bg-white/10 border-white/20" 
                    : "bg-white/2 border-transparent hover:border-white/10"
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-sm border border-white/10" 
                  style={{ background: cm.bg, boxShadow: cm.glow ? `0 0 5px ${cm.glow}` : "none" }} 
                />
                <span className="text-[0.6rem] font-bold uppercase tracking-tighter" style={{ color: cm.text }}>
                  {cm.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── DETAIL PANEL ── */}
        <AnimatePresence>
          {selectedDetail && (
            <motion.aside 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full sm:w-80 lg:relative lg:inset-auto bg-[#08081A] border-l border-white/10 flex flex-col z-30 shadow-2xl lg:shadow-none"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[0.6rem] font-bold tracking-widest opacity-40 uppercase">Selected Number</span>
                    </div>
                    <h2 className="text-4xl font-bold tracking-tighter" style={{ color: selectedDetail.ci.text }}>
                      {selectedDetail.n}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setSelected(null)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 opacity-60" />
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-white/5 bg-white/2 space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[0.55rem] font-bold opacity-40 uppercase tracking-widest">Primary 17-Split</span>
                      <div className="text-2xl font-bold tracking-tight text-white">
                        {selectedDetail.L}<span className="opacity-20 mx-1">|</span>{selectedDetail.R}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-[0.55rem] font-bold opacity-40 uppercase tracking-widest">Parity</span>
                      <div className="text-[0.65rem] font-bold text-indigo-300">
                        {selectedDetail.tr ? "TRANSPARENT" : "OPAQUE"}
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(selectedDetail.L / 17) * 100}%` }}
                      className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[0.6rem] font-bold tracking-widest opacity-40 uppercase">Orthogonal Vectoring</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDetail.orthogonal.map((val, idx) => {
                      const isRight = val.L > val.R;
                      const isLeft = val.R > val.L;
                      return (
                        <div key={idx} className="p-2 bg-white/2 border border-white/5 rounded-lg text-center relative overflow-hidden group/opt">
                          <div className="text-[0.4rem] opacity-30 uppercase mb-1">
                            {idx < 3 ? `Pos ${idx}` : `Neg ${idx - 3}`}
                          </div>
                          <div className="text-[0.75rem] font-bold text-indigo-100">
                            {val.L}|{val.R}
                          </div>
                          <div className={`text-[0.35rem] font-bold mt-1 ${isRight ? 'text-emerald-400' : isLeft ? 'text-rose-400' : 'text-indigo-300'}`}>
                            {isRight ? 'RIGHT' : isLeft ? 'LEFT' : 'CENTER'}
                          </div>
                          {/* Visual vector indicator */}
                          <div className={`absolute bottom-0 left-0 h-0.5 bg-current opacity-20 transition-all duration-300 ${isRight ? 'w-full bg-emerald-400' : isLeft ? 'w-full bg-rose-400' : 'w-0'}`} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg flex justify-between items-center">
                    <span className="text-[0.55rem] opacity-40 uppercase font-bold">Base Split (3+5+7)</span>
                    <span className="text-[0.7rem] font-bold text-indigo-200">{selectedDetail.baseL}|{15 - selectedDetail.baseL}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[0.6rem] font-bold tracking-widest opacity-40 uppercase">Prime Bending (210 Unit)</span>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-white/2 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <span className="text-[0.5rem] opacity-40 uppercase">Cycle Position</span>
                        <div className="text-xl font-bold text-white">{selectedDetail.cyclePos}</div>
                      </div>
                      <div className="h-8 w-px bg-white/10" />
                      <div className="text-right space-y-1">
                        <span className="text-[0.5rem] opacity-40 uppercase">Bending Counterpart</span>
                        <div className="text-xl font-bold text-indigo-300">{selectedDetail.bendingCounterpart}</div>
                      </div>
                    </div>
                    
                    {/* Bending Visualization */}
                    <div className="relative h-12 flex items-center justify-center">
                      <div className="absolute inset-x-0 h-px bg-white/10 top-1/2 -translate-y-1/2" />
                      <div className="absolute left-0 w-1.5 h-1.5 rounded-full bg-white/20 top-1/2 -translate-y-1/2" />
                      <div className="absolute right-0 w-1.5 h-1.5 rounded-full bg-white/20 top-1/2 -translate-y-1/2" />
                      
                      {/* Bending Arc */}
                      <svg className="absolute inset-0 w-full h-full overflow-visible">
                        <path 
                          d={`M ${(selectedDetail.cyclePos / 210) * 100}% 24 Q 50% -10 ${(selectedDetail.bendingCounterpart / 210) * 100}% 24`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeDasharray="4,2"
                          className="text-indigo-500/40"
                        />
                        <circle cx={`${(selectedDetail.cyclePos / 210) * 100}%`} cy="24" r="3" fill="currentColor" className="text-white" />
                        <circle cx={`${(selectedDetail.bendingCounterpart / 210) * 100}%`} cy="24" r="3" fill="currentColor" className="text-indigo-400" />
                      </svg>
                    </div>

                    {selectedDetail.isCorner && (
                      <div className="p-2 bg-indigo-500/20 border border-indigo-500/40 rounded-lg flex items-center gap-3">
                        <Zap className="w-3.5 h-3.5 text-indigo-300" />
                        <div className="text-[0.6rem] font-bold text-indigo-100 uppercase tracking-tight">
                          Prime Quad Anchor: {selectedDetail.cyclePos} | {selectedDetail.bendingPair}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-[0.5rem] opacity-30 leading-relaxed italic">
                      The 11/199, 13/197, 17/193, 19/191 relationship "bends" the 210 medium to locate primes for vectoring.
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[0.6rem] font-bold tracking-widest opacity-40 uppercase">Properties</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="px-3 py-2 bg-white/2 border border-white/5 rounded-lg flex justify-between items-center">
                      <span className="text-[0.6rem] opacity-40 uppercase">Axis</span>
                      <span className="text-[0.65rem] font-bold text-indigo-200">{selectedDetail.axis}</span>
                    </div>
                    <div className="px-3 py-2 bg-white/2 border border-white/5 rounded-lg flex justify-between items-center">
                      <span className="text-[0.6rem] opacity-40 uppercase">Type</span>
                      <span className="text-[0.65rem] font-bold text-indigo-200">{selectedDetail.ci.label}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[0.6rem] font-bold tracking-widest opacity-40 uppercase">Wave Interference (Zoom/Pan)</span>
                  </div>
                  <div className="space-y-4">
                    {selectedDetail.waveBreakdown.map((w) => (
                      <div key={w.k} className="space-y-1">
                        <div className="flex justify-between text-[0.55rem] font-bold">
                          <span className="opacity-40">WAVE {w.k}</span>
                          <span className="text-indigo-300">{w.left} L | {w.right} R</span>
                        </div>
                        <div className="bg-white/2 rounded-lg border border-white/5 p-1 overflow-hidden">
                          <WaveSVG n={selectedDetail.n} k={w.k} color={selectedDetail.ci.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[0.6rem] font-bold tracking-widest opacity-40 uppercase">Prime Factors</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedDetail.factors).length > 0 ? (
                      Object.entries(selectedDetail.factors).map(([p, e]) => {
                        const pci = getColorInfo(parseInt(p));
                        const exp = e as number;
                        return (
                          <div 
                            key={p} 
                            className="px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2"
                            style={{ background: `${pci.bg}44` }}
                          >
                            <span className="text-xs font-bold" style={{ color: pci.text }}>{p}</span>
                            {exp > 1 && <span className="text-[0.5rem] opacity-40 font-bold">^{exp}</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[0.65rem] opacity-30 italic">No prime factors (0 or 1)</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      <footer className="px-4 py-2 sm:px-6 border-t border-white/5 bg-black/40 flex items-center justify-between text-[0.5rem] sm:text-[0.55rem] font-bold tracking-widest opacity-40 uppercase">
        <div className="truncate mr-4">System: Wave Sum 17 • Range 0-{MAX_N}</div>
        <div className="hidden sm:block">Visualizing the hidden geometry of integers</div>
      </footer>
    </div>
  );
}
