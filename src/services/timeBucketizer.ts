import { addHours, startOfHour, endOfDay, isFriday, nextFriday } from 'date-fns';
import { HourlyBucket, NWSBundle } from '../types';

export class TimeBucketizerService {
  
  /**
   * Creates hourly buckets from now until end of Friday (local time)
   */
  createHourlyTimeline(): Date[] {
    const now = new Date();
    const currentHour = startOfHour(now);
    
    let endDate: Date;
    if (isFriday(now)) {
      endDate = endOfDay(now);
    } else {
      endDate = endOfDay(nextFriday(now));
    }
    
    const hours: Date[] = [];
    let currentTime = currentHour;
    
    while (currentTime <= endDate) {
      hours.push(new Date(currentTime));
      currentTime = addHours(currentTime, 1);
    }
    
    return hours;
  }

  /**
   * Converts NWS grid data into hourly buckets
   */
  bucketizeNWSData(nwsBundle: NWSBundle): HourlyBucket[] {
    const hourlyTimeline = this.createHourlyTimeline();
    const gridData = nwsBundle.forecastGridData.properties;
    
    return hourlyTimeline.map(hour => {
      const bucket: HourlyBucket = {
        timestamp: hour
      };

      bucket.temperature = this.extractValueForHour(gridData.temperature, hour);
      bucket.windSpeed = this.extractValueForHour(gridData.windSpeed, hour);
      bucket.windGust = this.extractValueForHour(gridData.windGust, hour);
      bucket.precipitationProbability = this.extractValueForHour(gridData.probabilityOfPrecipitation, hour);
      
      const snowfallRaw = this.extractValueForHour(gridData.snowfallAmount, hour);
      if (snowfallRaw !== undefined && snowfallRaw !== null && snowfallRaw > 0) {
        bucket.snowfallAmount = snowfallRaw / 25.4;
        console.log(`Snow conversion: ${snowfallRaw}mm → ${(snowfallRaw / 25.4).toFixed(2)}" at ${hour.toISOString()}`);
      } else {
        bucket.snowfallAmount = undefined;
      }
      
      const iceAccumRaw = this.extractValueForHour(gridData.iceAccumulation, hour);
      if (iceAccumRaw !== undefined && iceAccumRaw !== null) {
        bucket.iceAccumulation = iceAccumRaw / 25.4;
      } else {
        bucket.iceAccumulation = undefined;
      }
      bucket.visibility = this.extractValueForHour(gridData.visibility, hour);
      
      bucket.weather = this.extractWeatherForHour(nwsBundle.forecastHourly, hour);

      return bucket;
    });
  }

  /**
   * Extracts the value for a specific hour from an NWS grid element
   */
  private extractValueForHour(gridElement: any, targetHour: Date): number | undefined {
    if (!gridElement || !gridElement.values) {
      return undefined;
    }

    for (const value of gridElement.values) {
      const validTime = this.parseNWSTimeInterval(value.validTime);
      if (validTime && this.hourFallsInInterval(targetHour, validTime)) {
        return value.value;
      }
    }

    return undefined;
  }

  /**
   * Extracts weather description for a specific hour from hourly forecast
   */
  private extractWeatherForHour(hourlyForecast: any, targetHour: Date): string | undefined {
    if (!hourlyForecast || !hourlyForecast.properties || !hourlyForecast.properties.periods) {
      return undefined;
    }

    for (const period of hourlyForecast.properties.periods) {
      const startTime = new Date(period.startTime);
      const endTime = new Date(period.endTime);
      
      if (targetHour >= startTime && targetHour < endTime) {
        return period.shortForecast;
      }
    }

    return undefined;
  }

  /**
   * Parses NWS time interval format (ISO 8601 with duration)
   * Example: "2024-02-22T18:00:00+00:00/PT1H"
   */
  private parseNWSTimeInterval(validTime: string): { start: Date; end: Date } | null {
    try {
      const [startTimeStr, durationStr] = validTime.split('/');
      const startTime = new Date(startTimeStr);
      
      const durationMatch = durationStr.match(/PT(\d+)H/);
      if (!durationMatch) {
        return null;
      }
      
      const hours = parseInt(durationMatch[1]);
      const endTime = addHours(startTime, hours);
      
      return { start: startTime, end: endTime };
    } catch (error) {
      console.warn('Failed to parse NWS time interval:', validTime, error);
      return null;
    }
  }

  /**
   * Checks if an hour falls within a time interval
   */
  private hourFallsInInterval(hour: Date, interval: { start: Date; end: Date }): boolean {
    return hour >= interval.start && hour < interval.end;
  }

  /**
   * Gets school decision windows for a given date
   */
  getSchoolWindows(date: Date) {
    const baseDate = new Date(date);
    baseDate.setHours(0, 0, 0, 0);
    
    return {
      amCommute: {
        start: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000),
        end: new Date(baseDate.getTime() + 9 * 60 * 60 * 1000)
      },
      schoolDay: {
        start: new Date(baseDate.getTime() + 6 * 60 * 60 * 1000),
        end: new Date(baseDate.getTime() + 15 * 60 * 60 * 1000)
      },
      decisionTime: new Date(baseDate.getTime() + 6.5 * 60 * 60 * 1000)
    };
  }

  /**
   * Filters buckets to a specific time window
   */
  filterBucketsToWindow(buckets: HourlyBucket[], start: Date, end: Date): HourlyBucket[] {
    return buckets.filter(bucket => 
      bucket.timestamp >= start && bucket.timestamp < end
    );
  }

  /**
   * Debug method to show available NWS grid properties
   */
  getAvailableGridProperties(nwsBundle: NWSBundle): string[] {
    const gridData = nwsBundle.forecastGridData.properties;
    return Object.keys(gridData).filter(key => 
      gridData[key] && typeof gridData[key] === 'object' && gridData[key].values
    );
  }
}

export const timeBucketizer = new TimeBucketizerService();
