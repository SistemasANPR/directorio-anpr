/// <reference types="@types/google.maps" />
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { getGoogleMapsLoader } from "@/lib/googleMapsLoader";

interface CompanyLocation {
  id?: number;
  lat: number;
  lng: number;
  address: string;
  country?: string;
  state?: string;
  city?: string;
  isPrincipal: boolean;
}

interface MapLocation {
  lat: number;
  lng: number;
  name: string;
  address: string;
  isMain: boolean;
}

interface CompanyLocationMapProps {
  ubicacionGeografica?: { lat: number; lng: number; address?: string } | null;
  direccionFisica?: string;
  nombreEmpresa: string;
  ciudadesPresencia?: string[];
  locations?: CompanyLocation[];
}

export default function CompanyLocationMap({ 
  ubicacionGeografica, 
  direccionFisica, 
  nombreEmpresa,
  ciudadesPresencia = [],
  locations = []
}: CompanyLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const openInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Normalizar ubicacionGeografica - puede venir como string JSON o como objeto
  const normalizeUbicacion = (ubicacion: any): { lat: number; lng: number; address?: string } | null => {
    if (!ubicacion) return null;
    
    // Si es string, intentar parsear como JSON
    if (typeof ubicacion === 'string') {
      try {
        const parsed = JSON.parse(ubicacion);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing ubicacionGeografica:', e);
        return null;
      }
    }
    
    // Si ya es objeto, validar que tenga lat y lng válidos
    if (typeof ubicacion === 'object') {
      const lat = Number(ubicacion.lat);
      const lng = Number(ubicacion.lng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          lat,
          lng,
          address: ubicacion.address
        };
      }
    }
    
    return null;
  };

  const normalizedUbicacion = normalizeUbicacion(ubicacionGeografica);

  // Función para geocodificar ciudades usando Google Geocoding API
  const geocodeCity = async (city: string, geocoder: google.maps.Geocoder): Promise<{ lat: number; lng: number; display_name: string } | null> => {
    try {
      const result = await geocoder.geocode({ address: city });
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        return {
          lat: location.lat(),
          lng: location.lng(),
          display_name: result.results[0].formatted_address
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding city:', city, error);
      return null;
    }
  };

  useEffect(() => {
    // Si hay ubicaciones de la base de datos, usarlas. Si no, usar ubicacionGeografica
    const hasLocations = locations && locations.length > 0;
    const hasUbicacion = normalizedUbicacion !== null;
    
    if (!mapRef.current || (!hasLocations && !hasUbicacion)) {
      return;
    }

    const loader = getGoogleMapsLoader();
    let isMounted = true;

    const initializeMap = async () => {
      try {
        await loader.load();
        
        if (!isMounted || !mapRef.current) return;

        // Preparar ubicaciones para mostrar en el mapa
        const mapLocations: MapLocation[] = [];
        
        // PRIORIDAD 1: Usar ubicaciones de la base de datos si existen
        if (hasLocations) {
          locations.forEach((loc, index) => {
            mapLocations.push({
              lat: loc.lat,
              lng: loc.lng,
              name: loc.isPrincipal ? 'Ubicación Principal' : `Ubicación ${index + 1}`,
              address: loc.address || '',
              isMain: loc.isPrincipal
            });
          });
        } 
        // PRIORIDAD 2: Fallback a ubicacionGeografica antigua si no hay ubicaciones
        else if (normalizedUbicacion?.lat && normalizedUbicacion?.lng) {
          mapLocations.push({
            lat: normalizedUbicacion.lat,
            lng: normalizedUbicacion.lng,
            name: 'Ubicación Principal',
            address: direccionFisica || normalizedUbicacion.address || '',
            isMain: true
          });

          // Solo geocodificar ciudades si NO hay ubicaciones en la base de datos
          const geocoder = new google.maps.Geocoder();
          if (ciudadesPresencia && ciudadesPresencia.length > 0) {
            const ciudadesAGeocod = ciudadesPresencia.slice(0, 10);
            for (const ciudad of ciudadesAGeocod) {
              const location = await geocodeCity(ciudad, geocoder);
              if (location) {
                const isDuplicate = mapLocations.some(loc => {
                  const distance = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(loc.lat, loc.lng),
                    new google.maps.LatLng(location.lat, location.lng)
                  );
                  return distance < 5000;
                });
                
                if (!isDuplicate) {
                  mapLocations.push({
                    lat: location.lat,
                    lng: location.lng,
                    name: ciudad,
                    address: location.display_name,
                    isMain: false
                  });
                }
              }
            }
          }
        }

        if (mapLocations.length === 0) return;

        // Crear el mapa solo si no existe
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center: { lat: mapLocations[0].lat, lng: mapLocations[0].lng },
            zoom: 15,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          });
        }

        const map = mapInstanceRef.current;

        // Limpiar marcadores anteriores
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Crear bounds para ajustar el zoom
        const bounds = new google.maps.LatLngBounds();

        // Crear marcadores para todas las ubicaciones
        mapLocations.forEach((location) => {
          const position = { lat: location.lat, lng: location.lng };

          const infoContent = `
            <div style="text-align: center; min-width: 200px; max-width: 250px; padding: 8px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937; font-size: 16px;">${nombreEmpresa}</h3>
              <p style="margin: 0 0 4px 0; font-size: 14px; color: ${location.isMain ? '#dc2626' : '#059669'}; font-weight: 600;">
                ${location.name}
              </p>
              ${location.address ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">${location.address}</p>` : ''}
            </div>
          `;

          // Crear marcador con color diferente para oficina principal
          const marker = new google.maps.Marker({
            position,
            map,
            title: `${nombreEmpresa} - ${location.name}`,
            animation: google.maps.Animation.DROP,
            icon: location.isMain ? undefined : {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#059669',
              fillOpacity: 0.8,
              strokeColor: '#047857',
              strokeWeight: 2,
              scale: 8
            }
          });

          const infoWindow = new google.maps.InfoWindow({
            content: infoContent,
          });

          marker.addListener("click", () => {
            // Close any previously open InfoWindow before opening this one
            if (openInfoWindowRef.current) {
              openInfoWindowRef.current.close();
            }
            infoWindow.open(map, marker);
            openInfoWindowRef.current = infoWindow;
          });

          markersRef.current.push(marker);
          bounds.extend(position);
        });

        // Ajustar el mapa para mostrar todos los marcadores
        if (mapLocations.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(15);
        } else if (mapLocations.length > 1) {
          map.fitBounds(bounds);
        }

      } catch (error) {
        console.error('Error initializing Google Maps:', error);
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      // Close any open InfoWindow
      if (openInfoWindowRef.current) {
        openInfoWindowRef.current.close();
        openInfoWindowRef.current = null;
      }
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, [normalizedUbicacion, direccionFisica, nombreEmpresa, ciudadesPresencia, locations]);

  // Mostrar mensaje si no hay ubicaciones de ningún tipo
  if (!normalizedUbicacion && (!locations || locations.length === 0)) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Ubicación no disponible</p>
          {direccionFisica && (
            <p className="text-xs mt-1 text-gray-400">{direccionFisica}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ position: 'relative', zIndex: 1 }}>
      <div 
        ref={mapRef} 
        className="w-full h-64 border rounded-lg"
        style={{ minHeight: '256px', position: 'relative', zIndex: 1 }}
      />
      {direccionFisica && (
        <p className="text-sm text-gray-600 mt-2">
          <MapPin className="h-4 w-4 inline mr-1" />
          {direccionFisica}
        </p>
      )}
    </div>
  );
}
