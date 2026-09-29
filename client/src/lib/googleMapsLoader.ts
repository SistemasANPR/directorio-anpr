import { Loader } from "@googlemaps/js-api-loader";

// Singleton del Google Maps Loader para evitar crear múltiples instancias
let loaderInstance: Loader | null = null;

export const getGoogleMapsLoader = () => {
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
      version: "weekly",
      libraries: ["places", "geocoding", "geometry", "marker"]
    });
  }
  return loaderInstance;
};
