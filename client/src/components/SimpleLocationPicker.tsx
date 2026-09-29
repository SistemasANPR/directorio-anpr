import { useState, useEffect } from "react";
import { MapPin, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface SimpleLocationPickerProps {
  ciudad: string;
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  initialLocation?: { lat: number; lng: number; address: string } | null;
}

export default function SimpleLocationPicker({ 
  ciudad, 
  onLocationSelect, 
  initialLocation 
}: SimpleLocationPickerProps) {
  const [coords, setCoords] = useState({
    lat: initialLocation?.lat?.toString() || "",
    lng: initialLocation?.lng?.toString() || "",
    address: initialLocation?.address || ""
  });

  useEffect(() => {
    if (initialLocation) {
      setCoords({
        lat: initialLocation.lat.toString(),
        lng: initialLocation.lng.toString(),
        address: initialLocation.address
      });
    }
  }, [initialLocation]);

  const handleCoordinateSubmit = () => {
    const lat = parseFloat(coords.lat);
    const lng = parseFloat(coords.lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert("Por favor ingrese coordenadas válidas");
      return;
    }

    if (lat < -90 || lat > 90) {
      alert("La latitud debe estar entre -90 y 90");
      return;
    }

    if (lng < -180 || lng > 180) {
      alert("La longitud debe estar entre -180 y 180");
      return;
    }

    const address = coords.address || `${lat}, ${lng}`;
    onLocationSelect({ lat, lng, address });
  };

  // Coordenadas de referencia para ciudades mexicanas populares
  const cityReferences = {
    "Ciudad de México": { lat: 19.4326, lng: -99.1332 },
    "México": { lat: 19.4326, lng: -99.1332 },
    "Guadalajara": { lat: 20.6597, lng: -103.3496 },
    "Monterrey": { lat: 25.6866, lng: -100.3161 },
    "Puebla": { lat: 19.0414, lng: -98.2063 },
    "Tijuana": { lat: 32.5149, lng: -117.0382 },
    "León": { lat: 21.1619, lng: -101.6974 },
    "Juárez": { lat: 31.6904, lng: -106.4245 },
    "Torreón": { lat: 25.5428, lng: -103.4068 },
    "Querétaro": { lat: 20.5888, lng: -100.3899 },
    "Mérida": { lat: 20.9674, lng: -89.5926 },
    "Cancún": { lat: 21.1619, lng: -86.8515 },
    "Acapulco": { lat: 16.8531, lng: -99.8237 },
    "Veracruz": { lat: 19.1738, lng: -96.1342 }
  };

  const getCityReference = () => {
    const cityName = ciudad.split(',')[0];
    return cityReferences[cityName as keyof typeof cityReferences] || cityReferences["México"];
  };

  const useCityReference = () => {
    const ref = getCityReference();
    setCoords({
      lat: ref.lat.toString(),
      lng: ref.lng.toString(),
      address: ciudad
    });
  };

  return (
    <div className="space-y-4">
      {/* Información de la ciudad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Seleccionar Ubicación para {ciudad}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botón de referencia de ciudad */}
          <div>
            <Button 
              onClick={useCityReference}
              variant="outline" 
              className="w-full"
            >
              <Globe className="h-4 w-4 mr-2" />
              Usar coordenadas de referencia para {ciudad.split(',')[0]}
            </Button>
          </div>

          {/* Campos de coordenadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitud</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="19.4326"
                value={coords.lat}
                onChange={(e) => setCoords(prev => ({ ...prev, lat: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Rango: -90 a 90</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitud</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="-99.1332"
                value={coords.lng}
                onChange={(e) => setCoords(prev => ({ ...prev, lng: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Rango: -180 a 180</p>
            </div>
          </div>

          {/* Campo de dirección */}
          <div className="space-y-2">
            <Label htmlFor="address">Dirección o Descripción</Label>
            <Input
              id="address"
              placeholder="Descripción de la ubicación"
              value={coords.address}
              onChange={(e) => setCoords(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          {/* Botón para confirmar */}
          <Button 
            onClick={handleCoordinateSubmit}
            className="w-full"
            disabled={!coords.lat || !coords.lng}
          >
            Confirmar Ubicación
          </Button>

          {/* Información actual */}
          {coords.lat && coords.lng && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Ubicación actual:</strong><br />
                Latitud: {coords.lat}<br />
                Longitud: {coords.lng}<br />
                {coords.address && (
                  <>Dirección: {coords.address}</>
                )}
              </p>
            </div>
          )}

          {/* Nota sobre Google Maps */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Nota:</strong> Puedes obtener coordenadas precisas desde Google Maps:
              busca tu ubicación, haz clic derecho en el punto exacto y selecciona las coordenadas que aparecen.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}