import React from 'react';
import { DayPrediction, WeeklySummary } from '../types';
import { format } from 'date-fns';

interface OverviewTabProps {
  predictions: DayPrediction[];
  weeklySummary: WeeklySummary | null;
  nextSchoolDay: DayPrediction | null;
  onViewWeek: () => void;
  onViewMath: (day?: DayPrediction) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  predictions,
  weeklySummary,
  nextSchoolDay,
  onViewWeek,
  onViewMath
}) => {
  const formatPercentage = (value: number) => `${Math.round(value * 100)}%`;

  const getProbabilityBarSegments = (probs: { normal: number; delay: number; cancel: number }) => {
    const total = probs.normal + probs.delay + probs.cancel;
    return {
      normal: (probs.normal / total) * 100,
      delay: (probs.delay / total) * 100,
      cancel: (probs.cancel / total) * 100
    };
  };

  const getDayLabel = (prediction: DayPrediction) => {
    const maxProb = Math.max(prediction.probabilities.normal, prediction.probabilities.delay, prediction.probabilities.cancel);
    if (maxProb >= 0.6) {
      if (prediction.probabilities.normal === maxProb) return 'Likely Normal';
      if (prediction.probabilities.delay === maxProb) return 'Likely Delay';
      return 'Likely Cancel';
    }
    return 'Toss-up';
  };

  return (
    <div className="space-y-6">
      {nextSchoolDay && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Next School Day</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              nextSchoolDay.confidence === 'High' ? 'bg-green-100 text-green-800' :
              nextSchoolDay.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {nextSchoolDay.confidence} Confidence
            </span>
          </div>

          <div className="mb-4">
            <p className="text-lg text-gray-700 mb-2">
              Most likely: <span className="font-bold text-xl">{nextSchoolDay.mostLikelyCall}</span>
            </p>
            <p className="text-sm text-gray-600">
              {format(nextSchoolDay.date, 'EEEE, MMMM d')}
            </p>
          </div>

          <div className="flex space-x-2 mb-4">
            <div className="flex-1 bg-green-100 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-800">
                {formatPercentage(nextSchoolDay.probabilities.normal)}
              </div>
              <div className="text-sm text-green-600">Normal</div>
            </div>
            <div className="flex-1 bg-yellow-100 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-yellow-800">
                {formatPercentage(nextSchoolDay.probabilities.delay)}
              </div>
              <div className="text-sm text-yellow-600">Delay</div>
            </div>
            <div className="flex-1 bg-red-100 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-800">
                {formatPercentage(nextSchoolDay.probabilities.cancel)}
              </div>
              <div className="text-sm text-red-600">Cancel</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">
          Week at a Glance
        </h3>
        
        <div className="grid grid-cols-5 gap-3">
          {predictions.map((prediction) => {
            const segments = getProbabilityBarSegments(prediction.probabilities);
            const hasAlert = prediction.features.some(f => f.name === 'Alert Severity' && f.value > 0);
            
            return (
              <div key={prediction.date.toISOString()} className="text-center">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {format(prediction.date, 'EEE')}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {format(prediction.date, 'M/d')}
                </div>
                
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div className="h-full flex">
                    <div 
                      className="bg-green-500" 
                      style={{ width: `${segments.normal}%` }}
                    />
                    <div 
                      className="bg-yellow-500" 
                      style={{ width: `${segments.delay}%` }}
                    />
                    <div 
                      className="bg-red-500" 
                      style={{ width: `${segments.cancel}%` }}
                    />
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-1">
                  {getDayLabel(prediction)}
                </div>
                
                {hasAlert && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full mx-auto"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {nextSchoolDay && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Why {nextSchoolDay.mostLikelyCall}?</h3>
          
          <div className="space-y-2 mb-4">
            {nextSchoolDay.topReasons.map((reason, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-700">{reason.explanation}</span>
                <span className="text-sm font-medium text-gray-900">
                  +{reason.contribution.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="text-sm text-gray-600 italic">
            {nextSchoolDay.probabilities.cancel < 0.3 && (
              <p>Why not cancel: Low overall severity score ({nextSchoolDay.severityScore.toFixed(1)}) suggests manageable conditions</p>
            )}
          </div>
        </div>
      )}

      {weeklySummary && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Weekly Summary
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-800">
                {weeklySummary.expectedCanceledDays.toFixed(1)}
              </div>
              <div className="text-sm text-blue-600">Expected cancels</div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-800">
                {weeklySummary.expectedDelayedDays.toFixed(1)}
              </div>
              <div className="text-sm text-yellow-600">Expected delays</div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-800">
                {formatPercentage(weeklySummary.probabilityOfAtLeastOneCancel)}
              </div>
              <div className="text-sm text-red-600">Chance of ≥1 cancel</div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-800">
                {formatPercentage(weeklySummary.probabilityOfAtLeastOneDisruption)}
              </div>
              <div className="text-sm text-orange-600">Chance of ≥1 disruption</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          onClick={onViewWeek}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          View Week Details
        </button>
        
        <button
          onClick={() => onViewMath(nextSchoolDay || undefined)}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Show Math
        </button>
      </div>
    </div>
  );
};