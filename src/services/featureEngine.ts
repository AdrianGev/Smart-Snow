import { HourlyBucket, FeatureContribution, NWSBundle } from '../types';
import { timeBucketizer } from './timeBucketizer';
import { addHours, startOfDay } from 'date-fns';

export interface FeatureSet {
  commuteSnow: FeatureContribution;
  peakSnowRate: FeatureContribution;
  overnightAccumulation: FeatureContribution;
  iceRisk: FeatureContribution;
  refreezeRisk: FeatureContribution;
  windDrift: FeatureContribution;
  blowingSnow: FeatureContribution;
  wetSnowFactor: FeatureContribution;
  alertSeverity: FeatureContribution;
  districtBias: FeatureContribution;
}

export class FeatureEngineService {
  private weights = {
    commuteSnow: 1.2,
    peakSnowRate: 0.8,
    overnightAccumulation: 0.6,
    iceRisk: 1.8,
    refreezeRisk: 1.5,
    windDrift: 0.7,
    blowingSnow: 0.5,
    wetSnowFactor: 0.4,
    alertSeverity: 2.0,
    districtBias: 1.0
  };

  computeFeaturesForDay(
    date: Date,
    hourlyBuckets: HourlyBucket[],
    nwsBundle: NWSBundle,
    districtBias: number,
    busHeavyDistrict: boolean
  ): FeatureSet {
    const windows = timeBucketizer.getSchoolWindows(date);
    
    const commuteBuckets = timeBucketizer.filterBucketsToWindow(
      hourlyBuckets, windows.amCommute.start, windows.amCommute.end
    );
    
    const overnightBuckets = hourlyBuckets.filter(bucket => 
      bucket.timestamp >= startOfDay(date) && 
      bucket.timestamp < windows.decisionTime
    );

    const extendedBuckets = hourlyBuckets.filter(bucket =>
      bucket.timestamp >= addHours(startOfDay(date), -6) &&
      bucket.timestamp <= addHours(startOfDay(date), 12)
    );

    return {
      commuteSnow: this.computeCommuteSnow(commuteBuckets),
      peakSnowRate: this.computePeakSnowRate(extendedBuckets),
      overnightAccumulation: this.computeOvernightAccumulation(overnightBuckets),
      iceRisk: this.computeIceRisk(commuteBuckets),
      refreezeRisk: this.computeRefreezeRisk(extendedBuckets),
      windDrift: this.computeWindDrift(commuteBuckets),
      blowingSnow: this.computeBlowingSnow(commuteBuckets),
      wetSnowFactor: this.computeWetSnowFactor(commuteBuckets),
      alertSeverity: this.computeAlertSeverity(nwsBundle, date),
      districtBias: this.computeDistrictBias(districtBias, busHeavyDistrict)
    };
  }

  private computeCommuteSnow(buckets: HourlyBucket[]): FeatureContribution {
    let expectedSnow = 0;
    const formula = 'S_{commute} = \\sum_{h=4}^{9} E[\\Delta snow_h]';
    
    console.log(`Computing commute snow for ${buckets.length} buckets`);
    
    for (const bucket of buckets) {
      if (bucket.snowfallAmount !== undefined && bucket.snowfallAmount !== null && bucket.snowfallAmount > 0) {
        expectedSnow += bucket.snowfallAmount;
      } else if (bucket.precipitationProbability !== undefined && bucket.temperature !== undefined) {
        if (bucket.temperature <= 35) {
          expectedSnow += (bucket.precipitationProbability / 100) * 0.1;
        }
      }
    }
    
    console.log(`Total commute snow calculated: ${expectedSnow}`);
    

    return {
      name: 'Commute Snow',
      value: expectedSnow,
      weight: this.weights.commuteSnow,
      contribution: expectedSnow * this.weights.commuteSnow,
      formula,
      explanation: `Expected snowfall during AM commute (4-9am): ${expectedSnow.toFixed(1)} inches`
    };
  }

  private computePeakSnowRate(buckets: HourlyBucket[]): FeatureContribution {
    let maxRate = 0;
    const formula = 'R_{max} = \\max_{h \\in [3,9)} \\frac{\\Delta snow_h}{1hr}';
    
    for (const bucket of buckets) {
      if (bucket.snowfallAmount !== undefined && bucket.snowfallAmount !== null && bucket.snowfallAmount > 0) {
        maxRate = Math.max(maxRate, bucket.snowfallAmount);
      }
    }

    return {
      name: 'Peak Snow Rate',
      value: maxRate,
      weight: this.weights.peakSnowRate,
      contribution: maxRate * this.weights.peakSnowRate,
      formula,
      explanation: `Peak hourly snowfall rate: ${maxRate.toFixed(1)} in/hr`
    };
  }

  private computeOvernightAccumulation(buckets: HourlyBucket[]): FeatureContribution {
    let accumulation = 0;
    const formula = 'S_{6am} = \\sum_{h=0}^{6} E[\\Delta snow_h]';
    
    for (const bucket of buckets) {
      if (bucket.snowfallAmount !== undefined && bucket.snowfallAmount !== null && bucket.snowfallAmount > 0) {
        accumulation += bucket.snowfallAmount;
      }
    }

    return {
      name: 'Overnight Snow',
      value: accumulation,
      weight: this.weights.overnightAccumulation,
      contribution: accumulation * this.weights.overnightAccumulation,
      formula,
      explanation: `Snow accumulation by 6am: ${accumulation.toFixed(1)} inches`
    };
  }

  private computeIceRisk(buckets: HourlyBucket[]): FeatureContribution {
    let iceRisk = 0;
    const formula = 'I = \\frac{1}{H}\\sum_{h} p_{precip,h} \\times \\sigma(T_h)';
    
    for (const bucket of buckets) {
      if (bucket.precipitationProbability !== undefined && bucket.temperature !== undefined) {
        const precipProb = bucket.precipitationProbability / 100;
        const nearFreezingFactor = this.nearFreezingFunction(bucket.temperature);
        iceRisk += precipProb * nearFreezingFactor;
      }
    }
    
    iceRisk = iceRisk / Math.max(buckets.length, 1);

    return {
      name: 'Ice Risk',
      value: iceRisk,
      weight: this.weights.iceRisk,
      contribution: iceRisk * this.weights.iceRisk,
      formula,
      explanation: `Ice formation risk during commute: ${(iceRisk * 100).toFixed(0)}% (precip + near-freezing temps)`
    };
  }

  private computeRefreezeRisk(buckets: HourlyBucket[]): FeatureContribution {
    let refreezeRisk = 0;
    const formula = 'F = \\max_{h \\in [6,10)} I(T_h \\leq 28) \\times I(precip)';
    
    let hadPrecip = false;
    for (const bucket of buckets) {
      if (bucket.precipitationProbability !== undefined && bucket.precipitationProbability > 30) {
        hadPrecip = true;
      }
      
      if (hadPrecip && bucket.temperature !== undefined && bucket.temperature <= 28) {
        refreezeRisk = 1;
        break;
      }
    }

    return {
      name: 'Refreeze Risk',
      value: refreezeRisk,
      weight: this.weights.refreezeRisk,
      contribution: refreezeRisk * this.weights.refreezeRisk,
      formula,
      explanation: refreezeRisk > 0 ? 'High refreeze risk after precipitation' : 'Low refreeze risk'
    };
  }

  private computeWindDrift(buckets: HourlyBucket[]): FeatureContribution {
    let maxGust = 0;
    const formula = 'W = map(gust_{max}, 20 \\to 0, 40 \\to 1)';
    
    for (const bucket of buckets) {
      if (bucket.windGust !== undefined) {
        maxGust = Math.max(maxGust, bucket.windGust);
      } else if (bucket.windSpeed !== undefined) {
        maxGust = Math.max(maxGust, bucket.windSpeed * 1.3);
      }
    }

    const windRisk = this.mapLinear(maxGust, 20, 40, 0, 1);

    return {
      name: 'Wind Drift',
      value: windRisk,
      weight: this.weights.windDrift,
      contribution: windRisk * this.weights.windDrift,
      formula,
      explanation: `Wind gusts up to ${maxGust.toFixed(0)} mph, drift risk: ${(windRisk * 100).toFixed(0)}%`
    };
  }

  private computeBlowingSnow(buckets: HourlyBucket[]): FeatureContribution {
    const windFeature = this.computeWindDrift(buckets);
    const snowFeature = this.computePeakSnowRate(buckets);
    
    const blowingSnow = Math.min(1, 0.6 * windFeature.value + 0.4 * this.mapLinear(snowFeature.value, 0, 1, 0, 1));
    const formula = 'B = clip(0.6 \\times W + 0.4 \\times map(R_{max}))';

    return {
      name: 'Blowing Snow',
      value: blowingSnow,
      weight: this.weights.blowingSnow,
      contribution: blowingSnow * this.weights.blowingSnow,
      formula,
      explanation: `Combined wind + snow rate creates blowing snow risk: ${(blowingSnow * 100).toFixed(0)}%`
    };
  }

  private computeWetSnowFactor(buckets: HourlyBucket[]): FeatureContribution {
    let wetSnowFactor = 0;
    const formula = 'H = \\frac{1}{H}\\sum_{h} I(30 \\leq T_h \\leq 33) \\times map(R_h)';
    
    for (const bucket of buckets) {
      if (bucket.temperature !== undefined && bucket.snowfallAmount !== undefined) {
        if (bucket.temperature >= 30 && bucket.temperature <= 33) {
          wetSnowFactor += this.mapLinear(bucket.snowfallAmount, 0, 0.5, 0, 1);
        }
      }
    }
    
    wetSnowFactor = wetSnowFactor / Math.max(buckets.length, 1);

    return {
      name: 'Wet Snow Factor',
      value: wetSnowFactor,
      weight: this.weights.wetSnowFactor,
      contribution: wetSnowFactor * this.weights.wetSnowFactor,
      formula,
      explanation: `Heavy wet snow difficulty factor: ${(wetSnowFactor * 100).toFixed(0)}%`
    };
  }

  private computeAlertSeverity(nwsBundle: NWSBundle, date: Date): FeatureContribution {
    let severity = 0;
    const formula = 'A \\in \\{0,1,2,3\\}';
    let alertType = 'None';
    
    for (const alert of nwsBundle.alerts) {
      const alertStart = new Date(alert.properties.onset);
      const alertEnd = new Date(alert.properties.expires);
      
      if (date >= alertStart && date <= alertEnd) {
        const event = alert.properties.event.toLowerCase();
        if (event.includes('blizzard warning')) {
          severity = Math.max(severity, 3);
          alertType = 'Blizzard Warning';
        } else if (event.includes('ice storm warning')) {
          severity = Math.max(severity, 3);
          alertType = 'Ice Storm Warning';
        } else if (event.includes('winter storm warning')) {
          severity = Math.max(severity, 2);
          alertType = 'Winter Storm Warning';
        } else if (event.includes('winter weather advisory')) {
          severity = Math.max(severity, 1);
          alertType = 'Winter Weather Advisory';
        }
      }
    }

    return {
      name: 'Alert Severity',
      value: severity,
      weight: this.weights.alertSeverity,
      contribution: severity * this.weights.alertSeverity,
      formula,
      explanation: `Active alert: ${alertType}`
    };
  }

  private computeDistrictBias(districtBias: number, busHeavyDistrict: boolean): FeatureContribution {
    let bias = districtBias;
    if (busHeavyDistrict) {
      bias += 0.5;
    }
    
    const formula = 'D = clamp(k \\times (rate - avg), -2, +2) + bonus';

    return {
      name: 'District Bias',
      value: bias,
      weight: this.weights.districtBias,
      contribution: bias * this.weights.districtBias,
      formula,
      explanation: `District tendency: ${bias > 0 ? 'More cautious' : bias < 0 ? 'Less likely to cancel' : 'Average'}`
    };
  }

  private nearFreezingFunction(temperature: number): number {
    if (temperature >= 30 && temperature <= 32) {
      return 1;
    }
    if (temperature >= 28 && temperature < 30) {
      return (temperature - 28) / 2;
    }
    if (temperature > 32 && temperature <= 34) {
      return (34 - temperature) / 2;
    }
    return 0;
  }

  private mapLinear(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    if (value <= inMin) return outMin;
    if (value >= inMax) return outMax;
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
  }

  computeSeverityScore(features: FeatureSet): number {
    return Object.values(features).reduce((sum, feature) => sum + feature.contribution, 0);
  }

  getTopContributors(features: FeatureSet, count: number = 3): FeatureContribution[] {
    return Object.values(features)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, count);
  }
}

export const featureEngine = new FeatureEngineService();