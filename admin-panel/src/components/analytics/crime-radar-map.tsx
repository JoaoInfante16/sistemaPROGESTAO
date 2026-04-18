'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Leaflet precisa ser importado dinamicamente (nao funciona com SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then(m => m.CircleMarker),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('react-leaflet').then(m => m.Tooltip),
  { ssr: false }
);

// Mesma paleta + ordem do mobile (category_colors.dart)
const CATEGORY_COLORS: Record<string, string> = {
  patrimonial: '#F97316',
  seguranca: '#EF4444',
  operacional: '#3B82F6',
  fraude: '#8B5CF6',
  institucional: '#64748B',
};
const CATEGORY_LABELS: Record<string, string> = {
  patrimonial: 'Patrimonial',
  seguranca: 'Segurança',
  operacional: 'Operacional',
  fraude: 'Fraude',
  institucional: 'Institucional',
};
const CATEGORY_ORDER = ['seguranca', 'patrimonial', 'operacional', 'fraude', 'institucional'];

interface CrimePoint {
  id: string;
  lat: number;
  lng: number;
  categoria: string;
  tipo_crime: string;
  data: string;
  bairro: string | null;
  rua: string | null;
  precisao: 'rua' | 'bairro' | 'cidade';
}

interface Props {
  points: CrimePoint[];
  cidade: string;
}

// Jitter determinístico (±50m bairro, ±300m cidade) pra pontos empilhados.
// Não aplica em rua (já tem coord precisa).
function jitter(p: CrimePoint): [number, number] {
  if (p.precisao === 'rua') return [p.lat, p.lng];
  const seed = hashCode(p.id);
  const rng = seededRandom(seed);
  const radius = p.precisao === 'bairro' ? 0.0005 : 0.003;
  const dLat = (rng() - 0.5) * 2 * radius;
  const dLng = (rng() - 0.5) * 2 * radius;
  return [p.lat + dLat, p.lng + dLng];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function CrimeRadarMap({ points, cidade }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (!points || points.length === 0) return null;

  const visible = points.filter(p => !hidden.has(p.categoria));
  const basis = visible.length > 0 ? visible : points;
  const centerLat = basis.reduce((s, p) => s + p.lat, 0) / basis.length;
  const centerLng = basis.reduce((s, p) => s + p.lng, 0) / basis.length;

  const availableCats = new Set(points.map(p => p.categoria));
  const orderedCats = CATEGORY_ORDER.filter(c => availableCats.has(c));

  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      {/* Chips de filtro por categoria */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b bg-slate-50">
        {orderedCats.map(cat => {
          const isOn = !hidden.has(cat);
          const color = CATEGORY_COLORS[cat];
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setHidden(prev => {
                  const next = new Set(prev);
                  if (isOn) next.add(cat); else next.delete(cat);
                  return next;
                });
              }}
              className="text-xs font-semibold px-3 py-1 rounded-full border transition-colors"
              style={{
                backgroundColor: isOn ? color : 'transparent',
                color: isOn ? '#fff' : color,
                borderColor: color,
              }}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          );
        })}
      </div>

      <div style={{ height: 400 }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            // Necessário pra html2canvas (PDF) não marcar canvas como tainted.
            // CartoDB serve tiles com Access-Control-Allow-Origin: *.
            crossOrigin="anonymous"
          />
          {/* Halo glow — precisão rua destaca, cidade fica difuso */}
          {visible.map(p => {
            const color = CATEGORY_COLORS[p.categoria] || '#64748B';
            const radius = p.precisao === 'rua' ? 14 : p.precisao === 'bairro' ? 10 : 8;
            const opacity = p.precisao === 'rua' ? 0.28 : p.precisao === 'bairro' ? 0.18 : 0.10;
            const [lat, lng] = jitter(p);
            return (
              <CircleMarker
                key={`halo-${p.id}`}
                center={[lat, lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: opacity,
                  stroke: false,
                }}
              />
            );
          })}
          {/* Ponto sólido */}
          {visible.map(p => {
            const color = CATEGORY_COLORS[p.categoria] || '#64748B';
            const radius = p.precisao === 'rua' ? 5.5 : p.precisao === 'bairro' ? 4 : 3;
            const fillOpacity = p.precisao === 'rua' ? 1.0 : p.precisao === 'bairro' ? 0.9 : 0.6;
            const [lat, lng] = jitter(p);
            return (
              <CircleMarker
                key={`pt-${p.id}`}
                center={[lat, lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity,
                  color: '#fff',
                  weight: p.precisao === 'rua' ? 1.2 : 0.8,
                  opacity: p.precisao === 'rua' ? 0.9 : 0.6,
                }}
              >
                <Tooltip>
                  <div className="text-xs">
                    <strong>{CATEGORY_LABELS[p.categoria] || p.categoria}</strong>
                    {' · '}{p.tipo_crime.replace(/_/g, ' ')}
                    <br />
                    {p.bairro || 'Local não identificado'}
                    <br />
                    <span className="text-slate-500">{p.data}</span>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center border-t">
        Mapa de ocorrências — {cidade}
      </div>
    </div>
  );
}
