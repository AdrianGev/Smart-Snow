import axios from 'axios';
import { Location, NWSBundle } from '../types';

const NWS_BASE_URL = 'https://api.weather.gov';
const CACHE_DURATION = 1 * 60 * 1000;

interface CacheEntry {
  data: NWSBundle;
  timestamp: number;
}

class NWSApiService {
  private cache = new Map<string, CacheEntry>();

  private getCacheKey(lat: number, lon: number): string {
    return `${lat.toFixed(4)},${lon.toFixed(4)}`;
  }

  clearCache(): void {
    console.log('Clearing NWS cache to force fresh data fetch');
    this.cache.clear();
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < CACHE_DURATION;
  }

  async fetchNWSBundle(location: Location): Promise<NWSBundle> {
    const cacheKey = this.getCacheKey(location.lat, location.lon);
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data;
    }

    try {
      const pointsResponse = await axios.get(
        `${NWS_BASE_URL}/points/${location.lat},${location.lon}`,
        {
          headers: {
            'User-Agent': 'SmartSnow/1.0 (contact@smartsnow.app)'
          }
        }
      );

      const points = pointsResponse.data;
      const { gridId, gridX, gridY } = points.properties;

      location.gridId = gridId;
      location.gridX = gridX;
      location.gridY = gridY;

      const gridDataResponse = await axios.get(
        `${NWS_BASE_URL}/gridpoints/${gridId}/${gridX},${gridY}`,
        {
          headers: {
            'User-Agent': 'SmartSnow/1.0 (contact@smartsnow.app)'
          }
        }
      );

      const hourlyResponse = await axios.get(
        `${NWS_BASE_URL}/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`,
        {
          headers: {
            'User-Agent': 'SmartSnow/1.0 (contact@smartsnow.app)'
          }
        }
      );

      const alertsResponse = await axios.get(
        `${NWS_BASE_URL}/alerts/active?point=${location.lat},${location.lon}`,
        {
          headers: {
            'User-Agent': 'SmartSnow/1.0 (contact@smartsnow.app)'
          }
        }
      );

      const bundle: NWSBundle = {
        points: points,
        forecastGridData: gridDataResponse.data,
        forecastHourly: hourlyResponse.data,
        alerts: alertsResponse.data.features || [],
        fetchedAt: new Date()
      };

      this.cache.set(cacheKey, {
        data: bundle,
        timestamp: Date.now()
      });

      return bundle;

    } catch (error) {
      console.error('Error fetching NWS data:', error);
      throw new Error(`Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getCacheStatus(location: Location): { cached: boolean; minutesOld?: number } {
    const cacheKey = this.getCacheKey(location.lat, location.lon);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return { cached: false };
    }

    const minutesOld = Math.floor((Date.now() - cached.timestamp) / (60 * 1000));
    return {
      cached: true,
      minutesOld
    };
  }

}

export const nwsApi = new NWSApiService();