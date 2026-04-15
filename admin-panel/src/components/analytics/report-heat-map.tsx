'use client';

import dynamic from 'next/dynamic';

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

interface HeatPoint {
  bairro: string;
  count: number;
  lat: number;
  lng: number;
}

interface ReportHeatMapProps {
  data: HeatPoint[];
  cidade: string;
}

export function ReportHeatMap({ data, cidade }: ReportHeatMapProps) {
  if (!data || data.length === 0) return null;

  // Calculate center from data points
  const centerLat = data.reduce((s, p) => s + p.lat, 0) / data.length;
  const centerLng = data.reduce((s, p) => s + p.lng, 0) / data.length;
  const maxCount = Math.max(...data.map(p => p.count), 1);

  return (
    <div className="rounded-xl border overflow-hidden">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div style={{ height: 400 }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {data.map((point, i) => {
            const intensity = point.count / maxCount;
            const radius = 8 + intensity * 22;
            const color = intensity > 0.6 ? '#EF4444' : intensity > 0.3 ? '#F97316' : '#1A8F9A';

            return (
              <CircleMarker
                key={i}
                center={[point.lat, point.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.5,
                  color: color,
                  weight: 1,
                  opacity: 0.7,
                }}
              >
                <Tooltip>
                  <strong>{point.bairro}</strong>
                  <br />
                  {point.count} ocorrencia{point.count !== 1 ? 's' : ''}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground text-center">
        Mapa de ocorrencias — {cidade}
      </div>
    </div>
  );
}
