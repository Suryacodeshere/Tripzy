import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function Map({
  pickupLoc,
  dropLoc,
  driverLoc,
  nearbyDrivers = [],
  routeGeometry,
  onMapClick,
  onMapLoaded
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  
  // Layers refs
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const nearbyDriversGroupRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    if (mapContainerRef.current._leaflet_id) {
      mapContainerRef.current._leaflet_id = null;
    }

    // Bangalore default center coords
    const defaultCenter = [12.9716, 77.5946];
    
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
      fadeAnimation: true,
      zoomAnimation: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // CartoDB Voyager tiles (high performance, modern street details, reliable CDN)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapRef.current = map;
    nearbyDriversGroupRef.current = L.layerGroup().addTo(map);

    // Size invalidation triggers to guarantee tiles render properly even in flex layouts
    const t1 = setTimeout(() => {
      if (map) map.invalidateSize();
    }, 50);
    const t2 = setTimeout(() => {
      if (map) map.invalidateSize();
    }, 250);
    const t3 = setTimeout(() => {
      if (map) map.invalidateSize();
    }, 750);

    const handleResize = () => {
      if (map) map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    // Attempt browser Geolocation to center map on user's real location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.setView([latitude, longitude], 14);
          if (onMapLoaded) {
            onMapLoaded([longitude, latitude]);
          }
        },
        (error) => {
          console.warn('Geolocation failed or denied, centering default.', error);
          if (onMapLoaded) {
            onMapLoaded([defaultCenter[1], defaultCenter[0]]);
          }
        }
      );
    } else {
      if (onMapLoaded) {
        onMapLoaded([defaultCenter[1], defaultCenter[0]]);
      }
    }

    // Bind map click handler
    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick([e.latlng.lng, e.latlng.lat]);
      }
    });

    // Cleanup on unmount
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (mapContainerRef.current) {
        mapContainerRef.current._leaflet_id = null;
      }
    };
  }, []);

  // Guarantee map size is invalidated whenever pins or routes change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [pickupLoc, dropLoc, routeGeometry]);

  // Sync Pickup Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickupLoc && pickupLoc.coordinates) {
      const [lng, lat] = pickupLoc.coordinates;
      
      const pickupIcon = L.divIcon({
        className: 'custom-pickup-marker',
        html: `<div class="marker-pin-pickup pulse-primary">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([lat, lng]);
      } else {
        pickupMarkerRef.current = L.marker([lat, lng], { icon: pickupIcon }).addTo(map);
      }
      
      // Pan to pickup if it's set and there's no route yet
      if (!routeGeometry) {
        map.panTo([lat, lng]);
      }
    } else {
      if (pickupMarkerRef.current) {
        map.removeLayer(pickupMarkerRef.current);
        pickupMarkerRef.current = null;
      }
    }
  }, [pickupLoc, routeGeometry]);

  // Sync Drop Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (dropLoc && dropLoc.coordinates) {
      const [lng, lat] = dropLoc.coordinates;
      
      const dropIcon = L.divIcon({
        className: 'custom-drop-marker',
        html: `<div class="marker-pin-drop">🏁</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      if (dropMarkerRef.current) {
        dropMarkerRef.current.setLatLng([lat, lng]);
      } else {
        dropMarkerRef.current = L.marker([lat, lng], { icon: dropIcon }).addTo(map);
      }
    } else {
      if (dropMarkerRef.current) {
        map.removeLayer(dropMarkerRef.current);
        dropMarkerRef.current = null;
      }
    }
  }, [dropLoc]);

  // Sync Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeGeometry && routeGeometry.coordinates && routeGeometry.coordinates.length > 0) {
      // OSRM returns coordinates as [lng, lat]. Leaflet needs [lat, lng].
      const latLngs = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);

      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs(latLngs);
      } else {
        routePolylineRef.current = L.polyline(latLngs, {
          color: '#6366f1',
          weight: 5,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(map);
      }

      // Fit map bounds to show the entire route
      map.fitBounds(routePolylineRef.current.getBounds(), {
        padding: [50, 50]
      });
    } else {
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
    }
  }, [routeGeometry]);

  // Sync Assigned Driver Live Tracking Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driverLoc && (driverLoc.lat !== undefined || driverLoc.coordinates)) {
      let lat, lng;
      if (driverLoc.coordinates) {
        [lng, lat] = driverLoc.coordinates;
      } else {
        ({ lat, lng } = driverLoc);
      }

      const driverIcon = L.divIcon({
        className: 'custom-driver-tracking-marker',
        html: `<div class="marker-pin-driver pulse-success">🚕</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([lat, lng]);
      } else {
        driverMarkerRef.current = L.marker([lat, lng], { icon: driverIcon }).addTo(map);
      }
    } else {
      if (driverMarkerRef.current) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
    }
  }, [driverLoc]);

  // Sync Nearby Idle Drivers (For Passenger screen before request)
  useEffect(() => {
    const map = mapRef.current;
    const group = nearbyDriversGroupRef.current;
    if (!map || !group) return;

    // Clear existing markers
    group.clearLayers();

    // Do not show nearby drivers if the user is already on an active trip with an assigned driver
    if (driverLoc) return;

    nearbyDrivers.forEach(driver => {
      if (driver.currentLoc && driver.currentLoc.coordinates) {
        const [lng, lat] = driver.currentLoc.coordinates;

        const idleDriverIcon = L.divIcon({
          className: 'custom-idle-driver-marker',
          html: `<div class="marker-pin-idle-driver" title="${driver.vehicleName || 'Driver'}">🚗</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([lat, lng], { icon: idleDriverIcon });
        group.addLayer(marker);
      }
    });
  }, [nearbyDrivers, driverLoc]);

  return (
    <div
      ref={mapContainerRef}
      id="tripzy-map-canvas"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 'calc(100vh - 64px)',
        position: 'relative',
        zIndex: 1
      }}
    >
      {/* Decorative styling overlays injected via plain inline CSS for Leaflet divs */}
      <style>{`
        .custom-pickup-marker, .custom-drop-marker, .custom-driver-tracking-marker, .custom-idle-driver-marker {
          background: transparent !important;
          border: none !important;
        }
        .marker-pin-pickup {
          font-size: 1.8rem;
          text-align: center;
          line-height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .marker-pin-drop {
          font-size: 1.8rem;
          line-height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .marker-pin-driver {
          font-size: 1.8rem;
          background: rgba(16, 185, 129, 0.2);
          border: 2.5px solid #10b981;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
        }
        .marker-pin-idle-driver {
          font-size: 1.3rem;
          background: rgba(255, 255, 255, 0.15);
          border: 1.5px solid #6366f1;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 6px rgba(99, 102, 241, 0.3);
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
}
