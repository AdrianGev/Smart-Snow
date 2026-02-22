import React, { useState } from 'react';
import { DayPrediction, HourlyBucket, NWSBundle } from '../types';
import { format } from 'date-fns';
import { probabilityModel } from '../services/probabilityModel';
import { timeBucketizer } from '../services/timeBucketizer';
import { LaTeX } from './LaTeX';

interface MathTraceTabProps {
  predictions: DayPrediction[];
  hourlyBuckets: HourlyBucket[];
  nwsBundle: NWSBundle | null;
  selectedDay?: DayPrediction;
  onViewRawData: () => void;
}

type Section = 'inputs' | 'bucketization' | 'features' | 'severity' | 'probabilities' | 'weekly';

export const MathTraceTab: React.FC<MathTraceTabProps> = ({
  predictions,
  hourlyBuckets,
  nwsBundle,
  selectedDay,
  onViewRawData
}) => {
  const [activeDay, setActiveDay] = useState<DayPrediction>(selectedDay || predictions[0]);
  const [activeSection, setActiveSection] = useState<Section>('features');

  const sections = [
    { id: 'inputs' as Section, label: 'Inputs Used' },
    { id: 'bucketization' as Section, label: 'Bucketization / Time Windows' },
    { id: 'features' as Section, label: 'Feature Calculations' },
    { id: 'severity' as Section, label: 'Severity Score' },
    { id: 'probabilities' as Section, label: 'Probability Model' },
    { id: 'weekly' as Section, label: 'Weekly Math Summary' }
  ];

  const getCommuteBuckets = (day: DayPrediction) => {
    const windows = timeBucketizer.getSchoolWindows(day.date);
    return timeBucketizer.filterBucketsToWindow(
      hourlyBuckets, windows.amCommute.start, windows.amCommute.end
    );
  };

  const renderInputsSection = () => {
    if (!nwsBundle) return <div>No NWS data available</div>;

    const availableFields = timeBucketizer.getAvailableGridProperties(nwsBundle);
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">NWS Fields Used</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Window</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statistic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                { field: 'temperature', units: '°F', window: '4-9am', stat: 'min/max' },
                { field: 'windSpeed', units: 'mph', window: '4-9am', stat: 'max' },
                { field: 'windGust', units: 'mph', window: '4-9am', stat: 'max' },
                { field: 'probabilityOfPrecipitation', units: '%', window: '4-9am', stat: 'avg' },
                { field: 'snowfallAmount', units: 'in', window: '4-9am', stat: 'sum' }
              ].map((row, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{row.field}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.units}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.window}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.stat}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                      onClick={onViewRawData}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View in Raw Data
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBucketizationSection = () => {
    const commuteBuckets = getCommuteBuckets(activeDay);
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Time Windows & Bucketization</h3>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Configuration</h4>
          <ul className="text-sm space-y-1">
            <li><strong>Local timezone:</strong> America/New_York</li>
            <li><strong>Commute window:</strong> 4:00 AM - 9:00 AM</li>
            <li><strong>School day:</strong> 6:00 AM - 3:00 PM</li>
            <li><strong>Decision time:</strong> 6:30 AM</li>
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2">Commute Window Buckets ({format(activeDay.date, 'M/d')})</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hour</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Temp (°F)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wind (mph)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Precip %</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Snow (in)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commuteBuckets.slice(0, 5).map((bucket, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">
                      {format(bucket.timestamp, 'h:mm a')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {bucket.temperature?.toFixed(1) || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {bucket.windSpeed?.toFixed(1) || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {bucket.precipitationProbability?.toFixed(0) || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {bucket.snowfallAmount?.toFixed(2) || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderFeaturesSection = () => {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Feature Calculations</h3>
        
        <div className="grid grid-cols-2 gap-3">
          {activeDay.features.map((feature, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">{feature.name}</span>
                <span className="text-lg font-bold">{feature.value.toFixed(2)}</span>
              </div>
              
              <div className="space-y-2">
                <div className="bg-gray-50 p-2 rounded text-xs">
                  <LaTeX>{feature.formula}</LaTeX>
                </div>
                
                <div className="bg-blue-50 p-2 rounded text-xs">
                  {feature.weight} × {feature.value.toFixed(2)} = {feature.contribution.toFixed(2)}
                </div>
                
                <p className="text-xs text-gray-600">{feature.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSeveritySection = () => {
    const totalContribution = activeDay.features.reduce((sum, f) => sum + f.contribution, 0);
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Severity Score Calculation</h3>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Full Equation</h4>
          <div className="bg-white p-3 rounded border overflow-x-auto">
            <LaTeX block>
              {`\\begin{aligned}
\\text{sev} &= ${activeDay.features.slice(0, Math.ceil(activeDay.features.length / 3)).map(f => `${f.weight} \\cdot \\text{${f.name.replace(/\s+/g, ' ')}}`).join(' + ')} \\\\
&\\quad + ${activeDay.features.slice(Math.ceil(activeDay.features.length / 3), Math.ceil(2 * activeDay.features.length / 3)).map(f => `${f.weight} \\cdot \\text{${f.name.replace(/\s+/g, ' ')}}`).join(' + ')} \\\\
&\\quad + ${activeDay.features.slice(Math.ceil(2 * activeDay.features.length / 3)).map(f => `${f.weight} \\cdot \\text{${f.name.replace(/\s+/g, ' ')}}`).join(' + ')}
\\end{aligned}`}
            </LaTeX>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Substituted Values</h4>
          <div className="bg-white p-3 rounded border overflow-x-auto">
            <LaTeX block>
              {`\\begin{aligned}
\\text{sev} &= ${activeDay.features.slice(0, Math.ceil(activeDay.features.length / 2)).map(f => `${f.weight} \\times ${f.value.toFixed(2)}`).join(' + ')} \\\\
&\\quad + ${activeDay.features.slice(Math.ceil(activeDay.features.length / 2)).map(f => `${f.weight} \\times ${f.value.toFixed(2)}`).join(' + ')} \\\\
&= ${totalContribution.toFixed(2)}
\\end{aligned}`}
            </LaTeX>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Contributing factors to the severity:</h4>
          <div className="space-y-2">
            {activeDay.features
              .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
              .map((feature, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm">{feature.name}</span>
                  <span className="font-mono text-sm">
                    {feature.contribution >= 0 ? '+' : ''}{feature.contribution.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProbabilitiesSection = () => {
    const trace = probabilityModel.getLogitTrace(activeDay.severityScore);
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Probability Model (Softmax)</h3>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Logit Equations</h4>
          <div className="space-y-2">
            <div className="bg-white p-3 rounded border">
              <LaTeX>{"z_N = a_N - b_N \\times \\text{sev}"}</LaTeX>
            </div>
            <div className="bg-white p-3 rounded border">
              <LaTeX>{"z_D = a_D - b_D \\times (\\text{sev} - \\text{center})^2"}</LaTeX>
            </div>
            <div className="bg-white p-3 rounded border">
              <LaTeX>{"z_C = a_C + b_C \\times \\text{sev}"}</LaTeX>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Computed Logits</h4>
          <div className="space-y-2">
            <div className="bg-white p-2 rounded">
              <LaTeX>{trace.formulas.normal}</LaTeX>
            </div>
            <div className="bg-white p-2 rounded">
              <LaTeX>{trace.formulas.delay}</LaTeX>
            </div>
            <div className="bg-white p-2 rounded">
              <LaTeX>{trace.formulas.cancel}</LaTeX>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded">
          <h4 className="font-medium mb-2">Softmax Calculation</h4>
          <div className="space-y-2 font-mono text-sm">
            <div>exp({trace.logits.zN.toFixed(3)}) = {trace.exponentials.expN.toFixed(3)}</div>
            <div>exp({trace.logits.zD.toFixed(3)}) = {trace.exponentials.expD.toFixed(3)}</div>
            <div>exp({trace.logits.zC.toFixed(3)}) = {trace.exponentials.expC.toFixed(3)}</div>
            <div className="border-t pt-2 mt-2">
              Sum = {trace.sum.toFixed(3)}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded">
          <h4 className="font-medium mb-2">Final Probabilities</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-700">
                {(activeDay.probabilities.normal * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-blue-600">Normal</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">
                {(activeDay.probabilities.delay * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Delay</div>
            </div>
            <div>
              <div className="text-lg font-bold text-black">
                {(activeDay.probabilities.cancel * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Cancel</div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderWeeklySection = () => {
    const expectedCancels = predictions.reduce((sum, p) => sum + p.probabilities.cancel, 0);
    const expectedDelays = predictions.reduce((sum, p) => sum + p.probabilities.delay, 0);
    
    const probAtLeastOneCancel = 1 - predictions.reduce((prod, p) => prod * (1 - p.probabilities.cancel), 1);
    const probAtLeastOneDisruption = 1 - predictions.reduce((prod, p) => prod * (1 - (p.probabilities.delay + p.probabilities.cancel)), 1);

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Weekly Math Summary</h3>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-medium mb-2">Expected Cancels</h4>
            <div className="bg-white p-3 rounded border">
              <LaTeX block>
                {`\\sum_{d} P_d(\\text{Cancel}) = ${predictions.map(p => p.probabilities.cancel.toFixed(3)).join(' + ')} = ${expectedCancels.toFixed(2)}`}
              </LaTeX>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-medium mb-2">Expected Delays</h4>
            <div className="bg-white p-3 rounded border">
              <LaTeX block>
                {`\\sum_{d} P_d(\\text{Delay}) = ${predictions.map(p => p.probabilities.delay.toFixed(3)).join(' + ')} = ${expectedDelays.toFixed(2)}`}
              </LaTeX>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-medium mb-2">P(≥1 Cancel)</h4>
            <div className="bg-white p-3 rounded border">
              <LaTeX block>
                {`1 - \\prod_{d} (1 - P_d(\\text{Cancel})) = 1 - (${predictions.map(p => (1 - p.probabilities.cancel).toFixed(3)).join(' \\times ')}) = ${probAtLeastOneCancel.toFixed(3)}`}
              </LaTeX>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-medium mb-2">P(≥1 Disruption)</h4>
            <div className="bg-white p-3 rounded border">
              <LaTeX block>
                {`1 - \\prod_{d} (1 - (P_d(\\text{Delay}) + P_d(\\text{Cancel}))) = ${probAtLeastOneDisruption.toFixed(3)}`}
              </LaTeX>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'inputs': return renderInputsSection();
      case 'bucketization': return renderBucketizationSection();
      case 'features': return renderFeaturesSection();
      case 'severity': return renderSeveritySection();
      case 'probabilities': return renderProbabilitiesSection();
      case 'weekly': return renderWeeklySection();
      default: return renderFeaturesSection();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
            Day Selection
          </h3>
          <div className="space-y-1">
            {predictions.map((prediction) => (
              <button
                key={prediction.date.toISOString()}
                onClick={() => setActiveDay(prediction)}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeDay.date.toISOString() === prediction.date.toISOString()
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {format(prediction.date, 'EEE M/d')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
            Sections
          </h3>
          <div className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Math Trace - {format(activeDay.date, 'EEEE, MMMM d')}
              </h2>
              <button
                onClick={onViewRawData}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View Raw Data
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              All calculations shown below use NWS data + user district bias.
            </p>
          </div>

          {renderSection()}
        </div>
      </div>
    </div>
  );
};
