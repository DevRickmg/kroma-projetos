"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Circle, CircleMarker } from "leaflet";

export interface Point { lat: number; lng: number }

/** Mapa Leaflet + OpenStreetMap (grátis). Clique marca o centro; o círculo mostra o raio. */
export default function MapPicker({ point, radiusM, onPick, flyTo }: {
  point: Point | null; radiusM: number; onPick: (p: Point) => void; flyTo?: { p: Point; key: number } | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const circle = useRef<Circle | null>(null);
  const dot = useRef<CircleMarker | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (disposed || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { center: [-15.8, -47.9], zoom: 4, zoomControl: true, attributionControl: true });
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(m);
      m.on("click", (e) => pickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      setTimeout(() => m.invalidateSize(), 50);
    })();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // desenha / atualiza o círculo
  useEffect(() => {
    const m = map.current;
    const leaflet = L.current;
    if (!m || !leaflet) return;
    if (!point) {
      circle.current?.remove(); circle.current = null;
      dot.current?.remove(); dot.current = null;
      return;
    }
    const ll: [number, number] = [point.lat, point.lng];
    if (!circle.current) {
      circle.current = leaflet.circle(ll, { radius: radiusM, color: "#00e5ff", weight: 1.5, fillColor: "#00e5ff", fillOpacity: 0.08 }).addTo(m);
      dot.current = leaflet.circleMarker(ll, { radius: 6, color: "#0d0f12", weight: 2, fillColor: "#00e5ff", fillOpacity: 1 }).addTo(m);
    } else {
      circle.current.setLatLng(ll).setRadius(radiusM);
      dot.current?.setLatLng(ll);
    }
  }, [point, radiusM]);

  // centraliza quando vem de busca por texto
  useEffect(() => {
    const m = map.current;
    const leaflet = L.current;
    if (!m || !leaflet || !flyTo) return;
    const b = leaflet.latLng(flyTo.p.lat, flyTo.p.lng).toBounds(radiusM * 2.4);
    m.flyToBounds(b, { duration: 0.8 });
  }, [flyTo]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="h-[320px] w-full sm:h-[360px]" />;
}
