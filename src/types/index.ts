
export interface Location {
  lat: number;
  lon: number;
  name: string;
  gridId?: string;
  gridX?: number;
  gridY?: number;
}

export interface NWSBundle {
  points: any;
  forecastGridData: any;
  forecastHourly: any;
  alerts: any[];
  fetchedAt: Date;
}

export interface HourlyBucket {
  timestamp: Date;
  temperature?: number;
  windSpeed?: number;
  windGust?: number;
  precipitationProbability?: number;
  snowfallAmount?: number;
  iceAccumulation?: number;
  visibility?: number;
  weather?: string;
}

export interface FeatureContribution {
  name: string;
  value: number;
  weight: number;
  contribution: number;
  formula: string;
  explanation: string;
}

export interface DayPrediction {
  date: Date;
  dayName: string;
  probabilities: {
    normal: number;
    delay: number;
    cancel: number;
  };
  mostLikelyCall: string;
  confidence: 'High' | 'Medium' | 'Low';
  topReasons: FeatureContribution[];
  severityScore: number;
  features: FeatureContribution[];
}

export interface WeeklySummary {
  expectedCanceledDays: number;
  expectedDelayedDays: number;
  probabilityOfAtLeastOneCancel: number;
  probabilityOfAtLeastOneDisruption: number;
}

export interface ModelState {
  location: Location | null;
  nwsBundle: NWSBundle | null;
  hourlyBuckets: HourlyBucket[];
  dayPredictions: DayPrediction[];
  weeklySummary: WeeklySummary | null;
  districtBias: number;
  busHeavyDistrict: boolean;
  lastUpdated: Date | null;
}

export interface TraceStep {
  step: string;
  formula: string;
  substitution: string;
  result: number | string;
  units?: string;
  inputBuckets?: HourlyBucket[];
}

export interface MathTrace {
  dayDate: Date;
  features: TraceStep[];
  severity: TraceStep;
  probabilities: TraceStep;
}