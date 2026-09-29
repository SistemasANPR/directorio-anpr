/// <reference types="@types/google.maps" />
import { useEffect, useState, useRef } from "react";
import { MapPin, Search, Navigation, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getGoogleMapsLoader } from "@/lib/googleMapsLoader";

interface LocationInfo {
  lat: number;
  lng: number;
  address: string;
  country?: string;
  state?: string;
  city?: string;
}

interface MapLocationPickerProps {
  ciudad: string;
  onLocationSelect: (location: LocationInfo) => void;
  initialLocation?: LocationInfo | null;
  direccionFisica?: string;
}

export default function MapLocationPicker({ ciudad, onLocationSelect, initialLocation, direccionFisica }: MapLocationPickerProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationInfo | null>(
    initialLocation || null
  );
  const [manualCoords, setManualCoords] = useState({
    lat: initialLocation?.lat?.toString() || "",
    lng: initialLocation?.lng?.toString() || "",
    address: initialLocation?.address || ""
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Coordenadas de referencia para ciudades mexicanas
  const cityReferences: Record<string, { lat: number; lng: number }> = {
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
    if (!ciudad || typeof ciudad !== 'string') {
      return cityReferences["México"];
    }
    const cityName = ciudad.split(',')[0];
    return cityReferences[cityName] || cityReferences["México"];
  };

  // Extraer información de ubicación de los resultados de Google Geocoding
  const extractLocationInfo = (result: google.maps.GeocoderResult): Partial<LocationInfo> => {
    let country = '';
    let state = '';
    let city = '';

    result.address_components.forEach(component => {
      if (component.types.includes('country')) {
        country = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        state = component.long_name;
      }
      if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
    });

    return { country, state, city };
  };

  // Función para geocodificar dirección
  const geocodeAddress = async (address: string): Promise<LocationInfo | null> => {
    if (!address || address.trim().length < 5 || !geocoderRef.current) return null;
    
    setIsGeocoding(true);
    try {
      const result = await geocoderRef.current.geocode({ address: address.trim() });
      
      if (result.results && result.results.length > 0) {
        const firstResult = result.results[0];
        const location = firstResult.geometry.location;
        const locationInfo = extractLocationInfo(firstResult);
        
        return {
          lat: location.lat(),
          lng: location.lng(),
          address: firstResult.formatted_address,
          ...locationInfo
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  // Función para geocodificación inversa
  const reverseGeocode = async (lat: number, lng: number): Promise<LocationInfo> => {
    if (!geocoderRef.current) {
      return {
        lat,
        lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      };
    }

    try {
      const result = await geocoderRef.current.geocode({
        location: { lat, lng }
      });
      
      if (result.results && result.results.length > 0) {
        const firstResult = result.results[0];
        const locationInfo = extractLocationInfo(firstResult);
        
        return {
          lat,
          lng,
          address: firstResult.formatted_address,
          ...locationInfo
        };
      }
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
    }

    return {
      lat,
      lng,
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    };
  };

  // Inicializar el mapa
  useEffect(() => {
    if (!mapRef.current) return;

    const loader = getGoogleMapsLoader();

    let isMounted = true;

    loader.load().then(() => {
      if (!isMounted || !mapRef.current) return;

      try {
        // Crear geocoder
        geocoderRef.current = new google.maps.Geocoder();

        // Obtener coordenadas de referencia de la ciudad
        const cityRef = getCityReference();
        const center = selectedLocation ? 
          { lat: selectedLocation.lat, lng: selectedLocation.lng } : 
          { lat: cityRef.lat, lng: cityRef.lng };

        // Crear el mapa
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: selectedLocation ? 15 : 10,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;

        // Agregar marcador si hay ubicación inicial
        if (selectedLocation) {
          const marker = new google.maps.Marker({
            position: { lat: selectedLocation.lat, lng: selectedLocation.lng },
            map,
            draggable: true,
            title: selectedLocation.address || `${selectedLocation.lat}, ${selectedLocation.lng}`
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px;">${selectedLocation.address || `${selectedLocation.lat}, ${selectedLocation.lng}`}</div>`
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });

          // Manejar el evento de arrastre
          marker.addListener("dragend", async () => {
            const position = marker.getPosition();
            if (!position) return;

            setIsGeocoding(true);
            const newLocation = await reverseGeocode(position.lat(), position.lng());
            
            infoWindow.setContent(`<div style="padding: 8px;">📍 ${newLocation.address}</div>`);
            infoWindow.open(map, marker);
            
            setSelectedLocation(newLocation);
            setManualCoords({
              lat: newLocation.lat.toString(),
              lng: newLocation.lng.toString(),
              address: newLocation.address
            });
            onLocationSelect(newLocation);
            setIsGeocoding(false);
          });
          
          markerRef.current = marker;
        }

        // Evento de clic en el mapa para seleccionar ubicación
        map.addListener("click", async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;

          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          
          setIsGeocoding(true);
          const location = await reverseGeocode(lat, lng);

          // Remover marcador anterior
          if (markerRef.current) {
            markerRef.current.setMap(null);
          }

          // Crear nuevo marcador
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            animation: google.maps.Animation.DROP,
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px;">📍 ${location.address}</div>`
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });

          // Manejar el evento de arrastre
          marker.addListener("dragend", async () => {
            const position = marker.getPosition();
            if (!position) return;

            setIsGeocoding(true);
            const newLocation = await reverseGeocode(position.lat(), position.lng());
            
            infoWindow.setContent(`<div style="padding: 8px;">📍 ${newLocation.address}</div>`);
            infoWindow.open(map, marker);
            
            setSelectedLocation(newLocation);
            setManualCoords({
              lat: newLocation.lat.toString(),
              lng: newLocation.lng.toString(),
              address: newLocation.address
            });
            onLocationSelect(newLocation);
            setIsGeocoding(false);
          });

          infoWindow.open(map, marker);
          markerRef.current = marker;

          setSelectedLocation(location);
          setManualCoords({
            lat: lat.toString(),
            lng: lng.toString(),
            address: location.address
          });
          onLocationSelect(location);
          setIsGeocoding(false);
        });

        setMapLoaded(true);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }).catch(error => {
      console.error('Error loading Google Maps:', error);
    });

    return () => {
      isMounted = false;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, []);

  // Actualizar marcador cuando cambie la ubicación inicial
  useEffect(() => {
    if (mapInstanceRef.current && initialLocation && mapLoaded && geocoderRef.current) {
      // Remover marcador anterior
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      // Crear nuevo marcador
      const marker = new google.maps.Marker({
        position: { lat: initialLocation.lat, lng: initialLocation.lng },
        map: mapInstanceRef.current,
        draggable: true,
        title: initialLocation.address || `${initialLocation.lat}, ${initialLocation.lng}`
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px;">${initialLocation.address || `${initialLocation.lat}, ${initialLocation.lng}`}</div>`
      });

      marker.addListener("click", () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      // Manejar el evento de arrastre
      marker.addListener("dragend", async () => {
        const position = marker.getPosition();
        if (!position) return;

        setIsGeocoding(true);
        const newLocation = await reverseGeocode(position.lat(), position.lng());
        
        infoWindow.setContent(`<div style="padding: 8px;">📍 ${newLocation.address}</div>`);
        infoWindow.open(mapInstanceRef.current, marker);
        
        setSelectedLocation(newLocation);
        setManualCoords({
          lat: newLocation.lat.toString(),
          lng: newLocation.lng.toString(),
          address: newLocation.address
        });
        onLocationSelect(newLocation);
        setIsGeocoding(false);
      });
      
      markerRef.current = marker;
      mapInstanceRef.current.setCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
      mapInstanceRef.current.setZoom(15);

      setSelectedLocation(initialLocation);
      setManualCoords({
        lat: initialLocation.lat.toString(),
        lng: initialLocation.lng.toString(),
        address: initialLocation.address
      });
    }
  }, [initialLocation, mapLoaded]);

  // Geocodificar automáticamente cuando cambie la dirección física
  useEffect(() => {
    const handleAddressGeocoding = async () => {
      if (direccionFisica && 
          direccionFisica.trim().length > 10 && 
          direccionFisica !== lastGeocodedAddress &&
          !isGeocoding &&
          geocoderRef.current) {
        
        const location = await geocodeAddress(direccionFisica);
        
        if (location) {
          setLastGeocodedAddress(direccionFisica);
          
          setSelectedLocation(location);
          setManualCoords({
            lat: location.lat.toString(),
            lng: location.lng.toString(),
            address: location.address
          });

          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: location.lat, lng: location.lng });
            mapInstanceRef.current.setZoom(15);
            
            if (markerRef.current) {
              markerRef.current.setMap(null);
            }

            const marker = new google.maps.Marker({
              position: { lat: location.lat, lng: location.lng },
              map: mapInstanceRef.current,
              draggable: true,
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding: 8px;">📍 ${location.address}</div>`
            });

            marker.addListener("click", () => {
              infoWindow.open(mapInstanceRef.current, marker);
            });

            marker.addListener("dragend", async () => {
              const position = marker.getPosition();
              if (!position) return;

              setIsGeocoding(true);
              const newLocation = await reverseGeocode(position.lat(), position.lng());
              
              infoWindow.setContent(`<div style="padding: 8px;">📍 ${newLocation.address}</div>`);
              infoWindow.open(mapInstanceRef.current, marker);
              
              setSelectedLocation(newLocation);
              setManualCoords({
                lat: newLocation.lat.toString(),
                lng: newLocation.lng.toString(),
                address: newLocation.address
              });
              onLocationSelect(newLocation);
              setIsGeocoding(false);
            });
            
            markerRef.current = marker;
          }

          onLocationSelect(location);
        }
      }
    };

    const timer = setTimeout(handleAddressGeocoding, 1000);
    return () => clearTimeout(timer);
  }, [direccionFisica, lastGeocodedAddress, isGeocoding, onLocationSelect]);

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    
    const location = await geocodeAddress(searchValue);
    
    if (location && mapInstanceRef.current) {
      setSelectedLocation(location);
      setManualCoords({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        address: location.address
      });

      mapInstanceRef.current.setCenter({ lat: location.lat, lng: location.lng });
      mapInstanceRef.current.setZoom(15);
      
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstanceRef.current,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px;">📍 ${location.address}</div>`
      });

      marker.addListener("click", () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      marker.addListener("dragend", async () => {
        const position = marker.getPosition();
        if (!position) return;

        setIsGeocoding(true);
        const newLocation = await reverseGeocode(position.lat(), position.lng());
        
        infoWindow.setContent(`<div style="padding: 8px;">📍 ${newLocation.address}</div>`);
        infoWindow.open(mapInstanceRef.current, marker);
        
        setSelectedLocation(newLocation);
        setManualCoords({
          lat: newLocation.lat.toString(),
          lng: newLocation.lng.toString(),
          address: newLocation.address
        });
        onLocationSelect(newLocation);
        setIsGeocoding(false);
      });

      infoWindow.open(mapInstanceRef.current, marker);
      markerRef.current = marker;
      onLocationSelect(location);
    }
  };

  const handleManualCoordUpdate = () => {
    const lat = parseFloat(manualCoords.lat);
    const lng = parseFloat(manualCoords.lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert("Por favor ingresa coordenadas válidas");
      return;
    }

    const location: LocationInfo = {
      lat,
      lng,
      address: manualCoords.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    };

    setSelectedLocation(location);
    onLocationSelect(location);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
      mapInstanceRef.current.setZoom(15);
      
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        draggable: true,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px;">📍 ${location.address}</div>`
      });

      marker.addListener("click", () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      marker.addListener("dragend", async () => {
        const position = marker.getPosition();
        if (!position) return;

        setIsGeocoding(true);
        const newLocation = await reverseGeocode(position.lat(), position.lng());
        
        infoWindow.setContent(`<div style="padding: 8px;">📍 ${newLocation.address}</div>`);
        infoWindow.open(mapInstanceRef.current, marker);
        
        setSelectedLocation(newLocation);
        setManualCoords({
          lat: newLocation.lat.toString(),
          lng: newLocation.lng.toString(),
          address: newLocation.address
        });
        onLocationSelect(newLocation);
        setIsGeocoding(false);
      });
      
      markerRef.current = marker;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Ubicación Geográfica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGeocoding && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <Globe className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-800">Geocodificando ubicación...</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="search-address" className="text-sm font-medium">
            Buscar dirección
          </Label>
          <div className="flex gap-2">
            <Input
              id="search-address"
              data-testid="input-search-address"
              placeholder="Ej: Av. Insurgentes 123, Ciudad de México"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="flex-1"
            />
            <Button 
              type="button"
              onClick={handleSearch} 
              disabled={isGeocoding}
              data-testid="button-search-address"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div 
          ref={mapRef} 
          className="w-full border rounded-lg"
          style={{ height: '400px', minHeight: '400px' }}
        />

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Haz clic en el mapa o arrastra el marcador para seleccionar una ubicación
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="manual-lat" className="text-xs">Latitud</Label>
              <Input
                id="manual-lat"
                data-testid="input-latitude"
                placeholder="19.4326"
                value={manualCoords.lat}
                onChange={(e) => setManualCoords({ ...manualCoords, lat: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="manual-lng" className="text-xs">Longitud</Label>
              <Input
                id="manual-lng"
                data-testid="input-longitude"
                placeholder="-99.1332"
                value={manualCoords.lng}
                onChange={(e) => setManualCoords({ ...manualCoords, lng: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
                className="text-sm"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="manual-address" className="text-xs">Dirección</Label>
            <Input
              id="manual-address"
              data-testid="input-manual-address"
              placeholder="Dirección completa"
              value={manualCoords.address}
              onChange={(e) => setManualCoords({ ...manualCoords, address: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
              className="text-sm"
            />
          </div>

          <Button 
            type="button"
            onClick={handleManualCoordUpdate} 
            variant="outline" 
            size="sm" 
            className="w-full"
            data-testid="button-update-coordinates"
          >
            Actualizar coordenadas manualmente
          </Button>
        </div>

        {selectedLocation && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm font-medium text-green-800 mb-1">✓ Ubicación seleccionada:</p>
            <p className="text-xs text-green-700">{selectedLocation.address}</p>
            <p className="text-xs text-green-600 mt-1">
              {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
