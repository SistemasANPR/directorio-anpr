import { useState, useEffect, useRef } from "react";
import { MapPin, Plus, Trash2, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MapLocationPicker from "./MapLocationPicker";

// Tipo para ubicaciones que vienen del backend o props (sin localId)
interface LocationInput {
  id?: number;
  localId?: string;
  lat: number;
  lng: number;
  address: string;
  country?: string;
  state?: string;
  city?: string;
  isPrincipal: boolean;
}

// Tipo interno con localId obligatorio para renderizado estable
interface Location extends LocationInput {
  localId: string; // ID local OBLIGATORIO para el key de React
}

interface MultiLocationPickerProps {
  companyId?: number;
  initialLocations?: LocationInput[];
  onChange: (locations: LocationInput[]) => void;
}

// Generar ID único para ubicaciones locales
const generateLocalId = () => `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Normalizar ubicaciones: garantizar que TODAS tengan localId
const normalizeLocations = (locs: LocationInput[]): Location[] => {
  if (locs.length === 0) {
    // Si no hay ubicaciones, crear una ubicación principal vacía
    return [{
      lat: 19.4326,
      lng: -99.1332,
      address: "",
      isPrincipal: true,
      localId: generateLocalId()
    }];
  }
  
  return locs.map(loc => ({
    ...loc,
    localId: loc.localId || generateLocalId()
  }));
};

export default function MultiLocationPicker({ 
  companyId, 
  initialLocations = [], 
  onChange 
}: MultiLocationPickerProps) {
  // Normalizar ubicaciones ANTES del primer render para keys estables
  const [locations, setLocations] = useState<Location[]>(() => normalizeLocations(initialLocations));
  const [showAddLocation, setShowAddLocation] = useState(false);

  // Ref para rastrear si es la primera vez que se ejecuta el efecto
  const isFirstRender = useRef(true);
  const prevInitialLocations = useRef(initialLocations);

  useEffect(() => {
    // Solo actualizar si initialLocations realmente cambió desde afuera
    // (no por el onChange que nosotros mismos disparamos)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevInitialLocations.current = initialLocations;
      return;
    }

    // Verificar si initialLocations cambió de verdad (comparación profunda simple por longitud y IDs)
    const hasChanged = 
      initialLocations.length !== prevInitialLocations.current.length ||
      initialLocations.some((loc, idx) => {
        const prev = prevInitialLocations.current[idx];
        return !prev || loc.id !== prev.id || loc.lat !== prev.lat || loc.lng !== prev.lng;
      });

    if (!hasChanged) {
      return; // No hacer nada si no cambió realmente
    }

    prevInitialLocations.current = initialLocations;

    // Actualizar ubicaciones cuando initialLocations cambie, preservando localId existentes
    // Crear dos mapas: uno por localId (prioridad) y otro por DB id (fallback)
    const byLocalId = new Map(locations.map(loc => [loc.localId, loc]));
    const byDbId = new Map(locations.filter(loc => loc.id).map(loc => [loc.id!, loc]));
    
    const normalized = normalizeLocations(initialLocations).map(loc => {
      // Prioridad 1: Si ya tiene localId, preservarlo
      if ((loc as any).localId && byLocalId.has((loc as any).localId)) {
        return { ...loc, localId: byLocalId.get((loc as any).localId)!.localId };
      }
      // Prioridad 2: Si tiene DB id y existe en el estado previo, usar su localId
      if (loc.id && byDbId.has(loc.id)) {
        return { ...loc, localId: byDbId.get(loc.id)!.localId };
      }
      // Prioridad 3: Es una ubicación nueva, mantener su localId recién generado
      return loc;
    });
    
    setLocations(normalized);
  }, [initialLocations]);

  useEffect(() => {
    onChange(locations);
  }, [locations]);

  const addLocation = () => {
    const newLocation: Location = {
      lat: 19.4326,
      lng: -99.1332,
      address: "",
      isPrincipal: false,
      localId: generateLocalId()
    };
    setLocations([...locations, newLocation]);
    setShowAddLocation(false);
  };

  const updateLocation = (index: number, updatedLocation: Partial<Location>) => {
    const newLocations = [...locations];
    newLocations[index] = { ...newLocations[index], ...updatedLocation };
    setLocations(newLocations);
  };

  const removeLocation = (index: number) => {
    if (locations.length === 1) {
      return; // No permitir eliminar la última ubicación
    }
    
    const newLocations = locations.filter((_, i) => i !== index);
    
    // Si eliminamos la ubicación principal, hacer la primera ubicación la nueva principal
    if (locations[index].isPrincipal && newLocations.length > 0) {
      newLocations[0].isPrincipal = true;
    }
    
    setLocations(newLocations);
  };

  const setPrincipal = (index: number) => {
    const newLocations = locations.map((loc, i) => ({
      ...loc,
      isPrincipal: i === index
    }));
    setLocations(newLocations);
  };

  return (
    <div className="space-y-6">
      {locations.map((location, index) => (
        <Card 
          key={location.localId} 
          className={`${location.isPrincipal ? 'border-2 border-blue-500 shadow-lg' : 'border border-gray-200'}`}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {location.isPrincipal ? (
                  <span className="flex items-center gap-2">
                    Ubicación Principal
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </span>
                ) : (
                  <span>Ubicación {index + 1}</span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {!location.isPrincipal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPrincipal(index)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Marcar como principal"
                  >
                    <StarOff className="h-4 w-4" />
                  </Button>
                )}
                {locations.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLocation(index)}
                    className="text-red-600 hover:text-red-700"
                    title="Eliminar ubicación"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] bg-white border border-gray-200 rounded-lg overflow-hidden">
              <MapLocationPicker
                ciudad="México"
                onLocationSelect={(selectedLocation) => {
                  updateLocation(index, {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng,
                    address: selectedLocation.address,
                    country: selectedLocation.country,
                    state: selectedLocation.state,
                    city: selectedLocation.city
                  });
                }}
                initialLocation={location}
              />
            </div>
            {location.address && (
              <div className="text-xs text-gray-600 mt-2">
                📍 {location.address}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={addLocation}
          className="flex items-center gap-2"
          data-testid="button-add-location"
        >
          <Plus className="h-4 w-4" />
          Agregar ubicación
        </Button>
      </div>
    </div>
  );
}
