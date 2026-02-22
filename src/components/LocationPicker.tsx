import React, { useState, useEffect } from 'react';
import { Location } from '../types';

interface LocationPickerProps {
  location: Location | null;
  onLocationChange: (location: Location) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  onLocationChange
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('smartsnow-location');
    if (saved && !location) {
      try {
        const savedLocation = JSON.parse(saved);
        onLocationChange(savedLocation);
      } catch (e) {
        console.warn('Failed to load saved location:', e);
      }
    }
  }, [location, onLocationChange]);

  useEffect(() => {
    if (location) {
      localStorage.setItem('smartsnow-location', JSON.stringify(location));
    }
  }, [location]);

  const handleGeolocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          
          let locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          
          if (response.ok) {
            const data = await response.json();
            locationName = data.city && data.principalSubdivision 
              ? `${data.city}, ${data.principalSubdivision}`
              : locationName;
          }

          const newLocation: Location = {
            lat: latitude,
            lon: longitude,
            name: locationName
          };

          onLocationChange(newLocation);
        } catch (e) {
          console.warn('Geocoding failed, using coordinates:', e);
          const newLocation: Location = {
            lat: latitude,
            lon: longitude,
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          };
          onLocationChange(newLocation);
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        setIsLoading(false);
        setError(`Location access denied: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const coordMatch = manualInput.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          const newLocation: Location = {
            lat,
            lon,
            name: manualInput.trim()
          };
          onLocationChange(newLocation);
          setManualInput('');
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualInput)}&limit=1&countrycodes=us`
      );

      if (response.ok) {
        const results = await response.json();
        if (results.length > 0) {
          const result = results[0];
          const newLocation: Location = {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            name: result.display_name.split(',').slice(0, 2).join(', ')
          };
          onLocationChange(newLocation);
          setManualInput('');
        } else {
          setError('Location not found. Try "City, State" or "lat, lon" format.');
        }
      } else {
        setError('Geocoding service unavailable. Try coordinates format: "lat, lon"');
      }
    } catch (e) {
      setError('Failed to find location. Try coordinates format: "lat, lon"');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">
        Location
      </h2>

      {location && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Current:</strong> {location.name}
          </p>
          <p className="text-xs text-blue-600">
            {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleGeolocation}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Getting location...' : 'Use Current Location'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Enter city (New York City for example), state or coordinates (lat, lon) so if you want to know if it will snow in the ocean if you really want"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !manualInput.trim()}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Setting location...' : 'Set Location'}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};
