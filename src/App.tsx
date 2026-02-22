import React, { useState, useCallback, useEffect } from 'react';
import { LocationPicker } from './components/LocationPicker';
import { OverviewTab } from './components/OverviewTab';
import { WeekTab } from './components/WeekTab';
import { MathTraceTab } from './components/MathTraceTab';
import { ModelState, Location, DayPrediction } from './types';
import { nwsApi } from './services/nwsApi';
import { timeBucketizer } from './services/timeBucketizer';
import { predictionEngine } from './services/predictionEngine';

type TabType = 'overview' | 'week' | 'math' | 'raw';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [modelState, setModelState] = useState<ModelState>({
    location: null,
    nwsBundle: null,
    hourlyBuckets: [],
    dayPredictions: [],
    weeklySummary: null,
    districtBias: 0,
    busHeavyDistrict: false,
    lastUpdated: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMathDay, setSelectedMathDay] = useState<DayPrediction | undefined>();

  const handleLocationChange = useCallback(async (location: Location) => {
    setModelState(prev => ({ ...prev, location }));
    await fetchWeatherData(location);
  }, []);

  const fetchWeatherData = async (location: Location) => {
    setIsLoading(true);
    setError(null);

    try {
      const nwsBundle = await nwsApi.fetchNWSBundle(location);
      const hourlyBuckets = timeBucketizer.bucketizeNWSData(nwsBundle);

      setModelState(prev => ({
        ...prev,
        nwsBundle,
        hourlyBuckets,
        lastUpdated: new Date()
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (modelState.nwsBundle && modelState.hourlyBuckets.length > 0) {
      const predictions = predictionEngine.generateWeeklyPredictions(modelState);
      const weeklySummary = predictionEngine.generateWeeklySummary(predictions);
      
      setModelState(prev => ({
        ...prev,
        dayPredictions: predictions,
        weeklySummary
      }));
    }
  }, [modelState.nwsBundle, modelState.hourlyBuckets, modelState.districtBias, modelState.busHeavyDistrict]);

  const refreshData = async () => {
    if (modelState.location) {
      nwsApi.clearCache();
      await fetchWeatherData(modelState.location);
    }
  };

  const getDataAge = (): string => {
    if (!modelState.lastUpdated) return 'No data';
    const minutes = Math.floor((Date.now() - modelState.lastUpdated.getTime()) / 60000);
    if (minutes < 1) return 'Just updated';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview' },
    { id: 'week' as TabType, label: 'Week View' },
    { id: 'math' as TabType, label: 'Math Trace' },
    { id: 'raw' as TabType, label: 'Raw Data' }
  ];

  const nextSchoolDay = predictionEngine.getNextSchoolDay(modelState.dayPredictions);

  const handleViewWeek = () => setActiveTab('week');
  const handleViewMath = (day?: DayPrediction) => {
    setSelectedMathDay(day);
    setActiveTab('math');
  };
  const handleViewRawData = () => setActiveTab('raw');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-48 py-8">
            <div className="flex flex-col items-center space-y-4">
              <h1 className="text-6xl font-bold text-blue-600 border-4 border-blue-500 rounded-lg px-6 py-3 bg-blue-50 shadow-lg">SmartSnow</h1>
              <div className="text-lg font-bold text-black-700">
                Snow Day Predictor (a smarter snowdaycalculator that shows the actual raw data instead of a random percentage)
              </div>
              <div className="flex items-center space-x-4 text-base font-medium text-gray-800">
                <span>
                  Github: <a href="https://github.com/AdrianGev" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-bold">@AdrianGev</a>
                </span>
                {modelState.location && (
                  <>
                    <span className="text-sm text-gray-600">
                      Data: {getDataAge()}
                    </span>
                    <button
                      onClick={refreshData}
                      disabled={isLoading}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LocationPicker
          location={modelState.location}
          onLocationChange={handleLocationChange}
        />

        {error && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-gray-800">{error}</p>
          </div>
        )}

        {modelState.location && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <nav className="border-b border-gray-200">
              <div className="flex justify-center">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-4 px-6 border-b-3 font-bold text-lg ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-800 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div>
              {activeTab === 'overview' && (
                <div className="p-6">
                  {!modelState.nwsBundle ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Loading weather data...</p>
                    </div>
                  ) : (
                    <OverviewTab
                      predictions={modelState.dayPredictions}
                      weeklySummary={modelState.weeklySummary}
                      nextSchoolDay={nextSchoolDay}
                      onViewWeek={handleViewWeek}
                      onViewMath={handleViewMath}
                    />
                  )}
                </div>
              )}

              {activeTab === 'week' && (
                <div className="p-6">
                  {modelState.dayPredictions.length > 0 ? (
                    <WeekTab
                      predictions={modelState.dayPredictions}
                      weeklySummary={modelState.weeklySummary}
                      hourlyBuckets={modelState.hourlyBuckets}
                      onViewMath={handleViewMath}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">No predictions available yet.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'math' && (
                <div className="h-screen">
                  {modelState.dayPredictions.length > 0 ? (
                    <MathTraceTab
                      predictions={modelState.dayPredictions}
                      hourlyBuckets={modelState.hourlyBuckets}
                      nwsBundle={modelState.nwsBundle}
                      selectedDay={selectedMathDay}
                      onViewRawData={handleViewRawData}
                    />
                  ) : (
                    <div className="text-center py-8 p-6">
                      <p className="text-gray-600">No calculations available yet.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Raw Weather Data</h2>
                  
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
                    <h3 className="font-medium text-blue-900 mb-2">Where all of the data comes from:</h3>
                    <div className="text-sm text-blue-800 space-y-2">
                      <p>
                        <strong>API source:</strong> National Weather Service (NWS) API 
                      </p>
                      <p>
                        <strong>Data collection stuff:</strong>
                      </p>
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>The API fetches your location's grid coordinates from NWS</li>
                        <li>Retrieve hourly forecast data for the next 5 days</li>
                        <li>Download active weather alerts for your area</li>
                        <li>Process raw data into time-based "buckets" for analysis</li>
                        <li>All snowfall values are converted from millimeters to inches</li>
                      </ul>
                      <p>
                        <strong>Update Frequency:</strong> Data is refreshed each time you load a new location. 
                        NWS updates their forecasts multiple times per day.
                      </p>
                    </div>
                  </div>

                  {modelState.nwsBundle ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">Available Grid Properties:</h3>
                        <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                          {timeBucketizer.getAvailableGridProperties(modelState.nwsBundle).join(', ')}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-2">Sample Hourly Buckets (first 5):</h3>
                        <div className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                          <pre>{JSON.stringify(modelState.hourlyBuckets.slice(0, 5), null, 2)}</pre>
                        </div>
                      </div>

                      <details className="border rounded p-3" open>
                        <summary className="font-medium cursor-pointer">Full NWS Bundle</summary>
                        <div className="mt-3 bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                          <pre>{JSON.stringify(modelState.nwsBundle, null, 2)}</pre>
                        </div>
                      </details>
                    </div>
                  ) : (
                    <p className="text-gray-600">No weather data loaded yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;