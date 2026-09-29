import { useLocation } from "wouter";
import { useEffect, useRef } from "react";

/**
 * ScrollRestoration component that automatically scrolls to top on route changes.
 * This component listens to wouter location changes and resets scroll position
 * when navigating to a new route (ignoring hash-only changes for anchor jumps).
 * 
 * Place this component once in App.tsx to handle all navigation scenarios:
 * - Link clicks
 * - Programmatic navigation
 * - Direct URL access
 * - Browser back/forward buttons
 */
export default function ScrollRestoration() {
  const [location] = useLocation();
  const prevLocationRef = useRef<string>("");

  useEffect(() => {
    // Extract pathname without hash
    const currentPath = location.split('#')[0];
    const prevPath = prevLocationRef.current.split('#')[0];

    // Only scroll if the path changed (not just the hash)
    if (currentPath !== prevPath && prevPath !== "") {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant' // Instant scroll, no smooth animation
        });
      });
    }

    // Update the previous location
    prevLocationRef.current = location;
  }, [location]);

  return null; // This component doesn't render anything
}
