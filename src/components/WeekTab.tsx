import React from 'react';
import { DayPrediction, WeeklySummary, HourlyBucket } from '../types';
import { format } from 'date-fns';
import { predictionEngine } from '../services/predictionEngine';

interface WeekTabProps {
  predictions: DayPrediction[];
  weeklySummary: WeeklySummary | null;
  hourlyBuckets: HourlyBucket[];
  onViewMath: (day: DayPrediction) => void;
}

export const WeekTab: React.FC<WeekTabProps> = ({
  predictions,
  weeklySummary,
  hourlyBuckets,
  onViewMath
}) => {
  const formatPercentage = (value: number) => `${Math.round(value * 100)}%`;

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'bg-blue-100 text-blue-800';
      case 'Medium': return 'bg-gray-100 text-gray-800';
      case 'Low': return 'bg-gray-200 text-gray-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertBadge = (prediction: DayPrediction) => {
    const alertFeature = prediction.features.find(f => f.name === 'Alert Severity');
    if (!alertFeature || alertFeature.value === 0) return null;

    const alertType = alertFeature.explanation.replace('Active alert: ', '');
    return alertType !== 'None' ? alertType : null;
  };

  const renderMasterTimeline = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i);
    
    return (
      <div className="bg-white rounded border border-gray-200 p-3 mb-3">
        <h3 className="text-base font-semibold mb-2">Timeline Reference</h3>
        <div className="text-xs text-gray-600 mb-2">
          Commute window (4am-9am) is the critical period for decisions.
        </div>
        <div className="relative h-8 bg-gray-100 rounded">
          <div 
            className="absolute bg-blue-200 h-full rounded"
            style={{ left: '33.33%', width: '41.67%' }}
          />
          <div className="absolute inset-0 flex">
            {hours.map((hour) => (
              <div key={hour} className="flex-1 border-r border-gray-300 last:border-r-0 relative">
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                  {hour === 0 ? '12a' : `${hour}a`}
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 text-center">
            <div className="text-xs font-medium text-blue-800">Critical Window</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Master Timeline Reference */}
      {renderMasterTimeline()}

      {/* Header with Weekly Summary */}
      {weeklySummary && (
        <div className="bg-white rounded border border-gray-200 p-3">
          <h2 className="text-base font-semibold mb-2">Weekly Summary</h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-base font-bold text-blue-600">
                {weeklySummary.expectedCanceledDays.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Expected cancels</div>
            </div>
            <div>
              <div className="text-base font-bold text-blue-600">
                {weeklySummary.expectedDelayedDays.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Expected delays</div>
            </div>
            <div>
              <div className="text-base font-bold text-black">
                {formatPercentage(weeklySummary.probabilityOfAtLeastOneCancel)}
              </div>
              <div className="text-xs text-gray-600">≥1 cancel</div>
            </div>
            <div>
              <div className="text-base font-bold text-black">
                {formatPercentage(weeklySummary.probabilityOfAtLeastOneDisruption)}
              </div>
              <div className="text-xs text-gray-600">≥1 disruption</div>
            </div>
          </div>
        </div>
      )}

      {/* Day Cards */}
      <div className="space-y-2">
        {predictions.map((prediction) => {
          const commuteData = predictionEngine.getCommuteWindowSummary(prediction.date, hourlyBuckets);
          const alertType = getAlertBadge(prediction);
          
          return (
            <div key={prediction.date.toISOString()} className="bg-white rounded border border-gray-200 p-3">
              {/* Day Title Row */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {format(prediction.date, 'EEE M/d')}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  {alertType && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                      Alert: {alertType}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceBadgeColor(prediction.confidence)}`}>
                    {prediction.mostLikelyCall}
                  </span>
                  <span className="text-xs text-gray-500">
                    {prediction.confidence}
                  </span>
                </div>
              </div>

              {/* Probabilities */}
              <div className="mb-2">
                <div className="flex space-x-2 text-xs">
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Normal</span>
                      <span className="font-medium">{formatPercentage(prediction.probabilities.normal)}</span>
                    </div>
                    <div className="h-1 bg-gray-200 rounded">
                      <div 
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${prediction.probabilities.normal * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Delay</span>
                      <span className="font-medium">{formatPercentage(prediction.probabilities.delay)}</span>
                    </div>
                    <div className="h-1 bg-gray-200 rounded">
                      <div 
                        className="h-full bg-gray-500 rounded"
                        style={{ width: `${prediction.probabilities.delay * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Cancel</span>
                      <span className="font-medium">{formatPercentage(prediction.probabilities.cancel)}</span>
                    </div>
                    <div className="h-1 bg-gray-200 rounded">
                      <div 
                        className="h-full bg-black rounded"
                        style={{ width: `${prediction.probabilities.cancel * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded p-2">
                  <h4 className="font-medium text-blue-900 mb-2 text-sm">
                    Commute (4-9am)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-blue-900 font-medium">{commuteData.expectedSnow}"</div>
                      <div className="text-blue-600">Snow</div>
                    </div>
                    <div>
                      <div className="text-blue-900 font-medium">{commuteData.iceRisk}%</div>
                      <div className="text-blue-600">Ice</div>
                    </div>
                    <div>
                      <div className="text-blue-900 font-medium">{commuteData.maxGust} mph</div>
                      <div className="text-blue-600">Wind</div>
                    </div>
                    <div>
                      <div className="text-blue-900 font-medium">{commuteData.tempRange}</div>
                      <div className="text-blue-600">Temp</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Top Contributors</h4>
                  <div className="space-y-1">
                    {prediction.topReasons.slice(0, 3).map((reason, index) => (
                      <div key={index} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                        <span className="text-gray-700">{reason.name}</span>
                        <span className="font-medium text-gray-900">
                          +{reason.contribution.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeline removed - now using master timeline at top */}

              {/* Math Link */}
              <div className="mt-2 pt-2 border-t border-gray-200 text-center">
                <button
                  onClick={() => onViewMath(prediction)}
                  className="text-lg font-medium text-blue-600 hover:text-blue-800"
                >
                  What's the math for {format(prediction.date, 'EEEE')}?
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
