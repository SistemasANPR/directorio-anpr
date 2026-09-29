/// <reference types="@types/google.maps" />
import { useEffect, useRef, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { getGoogleMapsLoader } from "@/lib/googleMapsLoader";
import { useQuery } from "@tanstack/react-query";
import type { CompanyWithDetails } from "@shared/schema";

interface CompanyLocation {
  id: number;
  companyId: number;
  lat: number;
  lng: number;
  address: string;
  country?: string;
  state?: string;
  city?: string;
  isPrincipal: boolean;
}

interface DirectoryMapProps {
  companies: CompanyWithDetails[];
}

export default function DirectoryMap({ companies }: DirectoryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // Cargar ubicaciones de todas las empresas con actualización automática
  const { data: allLocations = [] } = useQuery<CompanyLocation[]>({
    queryKey: ["/api/companies/locations/all"],
    queryFn: async () => {
      const response = await fetch("/api/companies/locations/all");
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });
  
  // Crear un mapa de ubicaciones principales por empresa
  const principalLocationsMap = useMemo(() => {
    const map = new Map<number, CompanyLocation>();
    allLocations.forEach(loc => {
      if (loc.isPrincipal) {
        map.set(loc.companyId, loc);
      }
    });
    return map;
  }, [allLocations]);

  // Filtrar empresas que tienen ubicación geográfica válida (memoizado para evitar recálculos innecesarios)
  const companiesWithLocation = useMemo(() => {
    return companies.filter(company => {
      // Prioridad 1: Verificar si tiene ubicación principal en la tabla company_locations
      if (principalLocationsMap.has(company.id)) {
        return true;
      }
      
      // Prioridad 2: Verificar ubicacionGeografica (campo antiguo)
      try {
        if (!company.ubicacionGeografica) {
          return false;
        }
        
        let ubicacion;
        
        if (typeof company.ubicacionGeografica === 'string') {
          if (company.ubicacionGeografica.trim() === '' || 
              company.ubicacionGeografica.trim() === '""' || 
              company.ubicacionGeografica.trim() === "''") {
            return false;
          }
          
          try {
            ubicacion = JSON.parse(company.ubicacionGeografica);
          } catch {
            return false;
          }
        } else if (typeof company.ubicacionGeografica === 'object') {
          ubicacion = company.ubicacionGeografica;
        } else {
          return false;
        }
        
        return ubicacion && 
               typeof ubicacion.lat === 'number' && 
               typeof ubicacion.lng === 'number' && 
               !isNaN(ubicacion.lat) && 
               !isNaN(ubicacion.lng) &&
               ubicacion.lat !== 0 && 
               ubicacion.lng !== 0;
      } catch (error) {
        console.warn(`Error filtering company ${company.id} (${company.nombreEmpresa}):`, error);
        return false;
      }
    });
  }, [companies, principalLocationsMap]);

  useEffect(() => {
    if (!mapRef.current || companiesWithLocation.length === 0) {
      return;
    }

    const loader = getGoogleMapsLoader();

    let isMounted = true;

    loader.load().then(() => {
      if (!isMounted || !mapRef.current) return;

      try {
        // Coordenadas del centro de México para ver todo el país
        const defaultCenter = { lat: 23.6345, lng: -102.5528 };
        
        // Crear el mapa solo si no existe
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center: defaultCenter,
            zoom: 5,
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
        const usedCoordinates = new Map<string, number>();

        // Agregar marcadores para cada empresa
        companiesWithLocation.forEach(company => {
          let ubicacion: { lat: number; lng: number; address?: string };
          
          // Prioridad 1: Usar ubicación principal de la tabla company_locations
          const principalLocation = principalLocationsMap.get(company.id);
          if (principalLocation) {
            ubicacion = {
              lat: principalLocation.lat,
              lng: principalLocation.lng,
              address: principalLocation.address
            };
          } 
          // Prioridad 2: Usar ubicacionGeografica (campo antiguo)
          else if (typeof company.ubicacionGeografica === 'string') {
            try {
              ubicacion = JSON.parse(company.ubicacionGeografica);
            } catch {
              return;
            }
          } else {
            ubicacion = company.ubicacionGeografica as { lat: number; lng: number; address?: string };
          }
          
          // Verificar si estas coordenadas ya se usaron y agregar offset si es necesario
          const coordKey = `${ubicacion.lat.toFixed(6)},${ubicacion.lng.toFixed(6)}`;
          let finalLat = ubicacion.lat;
          let finalLng = ubicacion.lng;
          
          if (usedCoordinates.has(coordKey)) {
            const offset = usedCoordinates.get(coordKey)!;
            finalLat += (offset * 0.0005);
            finalLng += (offset * 0.0005); 
            usedCoordinates.set(coordKey, offset + 1);
          } else {
            usedCoordinates.set(coordKey, 1);
          }
          
          const position = { lat: finalLat, lng: finalLng };

          // Crear marcador
          const marker = new google.maps.Marker({
            position,
            map,
            title: company.nombreEmpresa,
            animation: google.maps.Animation.DROP,
          });

          // Crear el contenido del InfoWindow
          const infoContent = `
            <div style="text-align: center; min-width: 200px; max-width: 250px; padding: 4px 8px;">
              ${company.logotipoUrl ? `<img src="${company.logotipoUrl}" alt="${company.nombreEmpresa}" style="max-width: 80px; max-height: 50px; object-fit: contain; margin: 0 auto 6px auto; display: block; border-radius: 4px;" onerror="this.style.display='none'" />` : ''}
              <h3 style="margin: 0 0 6px 0; font-weight: bold; color: #1f2937; font-size: 15px;">${company.nombreEmpresa}</h3>
              ${company.direccionFisica ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">${company.direccionFisica}</p>` : ''}
              ${company.categories && company.categories.length > 0 ? 
                `<p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af;">
                  ${company.categories.map(cat => cat.nombreCategoria).join(', ')}
                </p>` : ''
              }
              ${company.telefono1 ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #059669;">📞 ${company.telefono1}</p>` : ''}
              ${company.email1 ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #0284c7;">✉️ ${company.email1}</p>` : ''}
              <button 
                onclick="window.location.href='/empresa/${company.id}'" 
                style="margin-top: 8px; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;"
              >
                Ver detalles
              </button>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({
            content: infoContent,
          });

          marker.addListener("click", () => {
            // Cerrar el InfoWindow anterior si existe
            if (activeInfoWindowRef.current) {
              activeInfoWindowRef.current.close();
            }
            // Abrir el nuevo InfoWindow y guardarlo como activo
            infoWindow.open(map, marker);
            activeInfoWindowRef.current = infoWindow;
          });

          markersRef.current.push(marker);
          bounds.extend(position);
        });

        // Ajustar el mapa para mostrar todos los marcadores
        if (companiesWithLocation.length > 0) {
          map.fitBounds(bounds);
          
          // Limitar el zoom máximo para que siempre se vea contexto de México
          const listener = google.maps.event.addListener(map, "idle", () => {
            const currentZoom = map.getZoom();
            if (currentZoom && currentZoom > 10) {
              map.setZoom(10);
            }
            // Si el zoom es muy bajo (empresas muy dispersas), asegurar un mínimo
            if (currentZoom && currentZoom < 4) {
              map.setZoom(5);
            }
            google.maps.event.removeListener(listener);
          });
        }

      } catch (error) {
        console.error('Error initializing Google Maps:', error);
      }
    }).catch(error => {
      console.error('Error loading Google Maps:', error);
    });

    return () => {
      isMounted = false;
      // No destruir el mapa, solo limpiar marcadores
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, [companiesWithLocation]);

  if (companiesWithLocation.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Sin ubicaciones disponibles</h3>
          <p className="text-sm">
            No hay empresas con ubicación geográfica registrada para mostrar en el mapa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            Mostrando {companiesWithLocation.length} empresa{companiesWithLocation.length !== 1 ? 's' : ''} en el mapa
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Haz clic en los marcadores para ver más información
        </div>
      </div>
      
      <div 
        ref={mapRef} 
        className="w-full h-96 border rounded-lg shadow-sm"
        style={{ 
          minHeight: '400px',
          height: '400px',
          position: 'relative',
        }}
      />
    </div>
  );
}
