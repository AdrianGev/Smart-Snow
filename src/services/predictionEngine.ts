import { addDays, startOfDay, format, isWeekend } from 'date-fns';
import { DayPrediction, WeeklySummary, HourlyBucket, NWSBundle, ModelState } from '../types';
import { featureEngine } from './featureEngine';
import { probabilityModel } from './probabilityModel';

export class PredictionEngineService {
  
  generateWeeklyPredictions(modelState: ModelState): DayPrediction[] {
    if (!modelState.nwsBundle || !modelState.location) {
      return [];
    }

    const predictions: DayPrediction[] = [];
    const today = new Date();
    
    let currentDate = startOfDay(today);
    let weekdaysFound = 0;
    
    while (weekdaysFound < 5) {
      if (!isWeekend(currentDate)) {
        const prediction = this.generateDayPrediction(
          currentDate,
          modelState.hourlyBuckets,
          modelState.nwsBundle,
          modelState.districtBias,
          modelState.busHeavyDistrict
        );
        
        if (prediction) {
          predictions.push(prediction);
          weekdaysFound++;
        }
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return predictions;
  }

  generateDayPrediction(
    date: Date,
    hourlyBuckets: HourlyBucket[],
    nwsBundle: NWSBundle,
    districtBias: number,
    busHeavyDistrict: boolean
  ): DayPrediction | null {
    try {
      const features = featureEngine.computeFeaturesForDay(
        date,
        hourlyBuckets,
        nwsBundle,
        districtBias,
        busHeavyDistrict
      );

      const severityScore = featureEngine.computeSeverityScore(features);

      const probabilities = probabilityModel.computeProbabilities(severityScore);

      const { call, confidence } = probabilityModel.getMostLikelyCall(probabilities);

      const topReasons = featureEngine.getTopContributors(features, 3);

      return {
        date,
        dayName: format(date, 'EEEE'),
        probabilities,
        mostLikelyCall: call,
        confidence,
        topReasons,
        severityScore,
        features: Object.values(features)
      };
    } catch (error) {
      console.error('Error generating prediction for', date, error);
      return null;
    }
  }

  generateWeeklySummary(predictions: DayPrediction[]): WeeklySummary {
    const expectedCanceledDays = predictions.reduce((sum, pred) => sum + pred.probabilities.cancel, 0);
    const expectedDelayedDays = predictions.reduce((sum, pred) => sum + pred.probabilities.delay, 0);
    
    const probabilityOfAtLeastOneCancel = 1 - predictions.reduce(
      (product, pred) => product * (1 - pred.probabilities.cancel), 1
    );
    
    const probabilityOfAtLeastOneDisruption = 1 - predictions.reduce(
      (product, pred) => product * (1 - (pred.probabilities.delay + pred.probabilities.cancel)), 1
    );

    return {
      expectedCanceledDays,
      expectedDelayedDays,
      probabilityOfAtLeastOneCancel,
      probabilityOfAtLeastOneDisruption
    };
  }

  getNextSchoolDay(predictions: DayPrediction[]): DayPrediction | null {
    const today = new Date();
    return predictions.find(pred => pred.date >= today) || predictions[0] || null;
  }

  getCommuteWindowSummary(date: Date, hourlyBuckets: HourlyBucket[]) {
    const windows = {
      start: new Date(date.getTime() + 4 * 60 * 60 * 1000),
      end: new Date(date.getTime() + 9 * 60 * 60 * 1000)
    };

    const commuteBuckets = hourlyBuckets.filter(bucket =>
      bucket.timestamp >= windows.start && bucket.timestamp < windows.end
    );

    let expectedSnow = 0;
    let maxGust = 0;
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let iceRisk = 0;
    let worstHour = '';
    let maxRisk = 0;

    commuteBuckets.forEach(bucket => {
      if (bucket.snowfallAmount !== undefined && bucket.snowfallAmount > 0) {
        expectedSnow += bucket.snowfallAmount;
      }
      
      if (bucket.windGust !== undefined) {
        maxGust = Math.max(maxGust, bucket.windGust);
      }
      
      if (bucket.temperature !== undefined) {
        minTemp = Math.min(minTemp, bucket.temperature);
        maxTemp = Math.max(maxTemp, bucket.temperature);
        
        if (bucket.precipitationProbability !== undefined) {
          const precipProb = bucket.precipitationProbability / 100;
          const nearFreezingFactor = bucket.temperature >= 30 && bucket.temperature <= 32 ? 1 : 0;
          const hourlyIceRisk = precipProb * nearFreezingFactor;
          
          if (hourlyIceRisk > maxRisk) {
            maxRisk = hourlyIceRisk;
            worstHour = format(bucket.timestamp, 'h:mm a');
          }
          
          iceRisk = Math.max(iceRisk, hourlyIceRisk);
        }
      }
    });

    return {
      expectedSnow: expectedSnow.toFixed(1),
      iceRisk: Math.round(iceRisk * 100),
      maxGust: Math.round(maxGust),
      tempRange: minTemp === Infinity ? 'N/A' : `${Math.round(minTemp)}°F - ${Math.round(maxTemp)}°F`,
      worstHour: worstHour || 'N/A'
    };
  }
}

export const predictionEngine = new PredictionEngineService();
