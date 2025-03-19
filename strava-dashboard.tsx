import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, Scatter, ScatterChart
} from 'recharts';
import Papa from 'papaparse';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const StravaDashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('distance');
  const [totalStats, setTotalStats] = useState({
    activities: 0,
    distance: 0,
    elevation: 0,
    duration: 0,
    avgHeartRate: 0,
    avgPace: 'N/A'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await window.fs.readFile('data  data.csv.csv', { encoding: 'utf8' });
        
        const result = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        
        if (!result.data || result.data.length === 0) {
          throw new Error("No data found in CSV file");
        }
        
        // Process the data
        const processedData = result.data.map(row => ({
          id: row.id || Math.random().toString(36).substr(2, 9),
          name: row.name || "Unnamed Activity",
          type: row.type || "Run",
          date: row.start_date ? new Date(row.start_date) : new Date(),
          // The distance values in the data appear to be in miles already
          distance: row.distance || 0,
          duration: (row.moving_time || 0) / 60, // Convert to minutes
          elevation: row.total_elevation_gain || 0,
          // Based on analysis, we'll calculate pace from time and distance in miles
          pace: row.distance && row.distance > 0 ? 
                (row.moving_time / 60) / row.distance : 0, // min/mile
          // The speed values don't align with distance/time, we'll use distance and time
          speed: row.distance && row.moving_time ? 
                 (row.distance / (row.moving_time / 3600)) : 0, // mph
          heartRate: row.average_heartrate || 0,
          maxHeartRate: row.max_heartrate || 0,
          kudos: row.kudos_count || 0,
          workout_type: row.workout_type
        }));
        
        processedData.sort((a, b) => a.date - b.date);
        setData(processedData);
        
        // Calculate monthly statistics
        const months = {};
        let heartRateSum = 0;
        let heartRateCount = 0;
        
        processedData.forEach(activity => {
          if (!activity.date || !(activity.date instanceof Date) || isNaN(activity.date)) {
            return; // Skip invalid dates
          }
          
          const monthYear = `${activity.date.getFullYear()}-${activity.date.getMonth() + 1}`;
          
          if (!months[monthYear]) {
            months[monthYear] = {
              month: `${monthNames[activity.date.getMonth()]} ${activity.date.getFullYear()}`,
              count: 0,
              distance: 0,
              elevation: 0,
              duration: 0,
              monthNum: activity.date.getMonth() + 1,
              year: activity.date.getFullYear()
            };
          }
          
          months[monthYear].count += 1;
          months[monthYear].distance += activity.distance || 0; // Already in miles
          months[monthYear].elevation += activity.elevation || 0;
          months[monthYear].duration += activity.duration || 0;
          
          if (activity.heartRate && activity.heartRate > 0) {
            heartRateSum += activity.heartRate;
            heartRateCount++;
          }
        });
        
        // Convert to array and sort by date
        const monthsArray = Object.values(months).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.monthNum - b.monthNum;
        });
        
        setMonthlyStats(monthsArray);
        
        // Calculate workout type statistics
        const types = {};
        processedData.forEach(activity => {
          const workoutType = activity.workout_type === null ? 'Other' : 
                              activity.workout_type === 0 ? 'Easy Run' :
                              activity.workout_type === 1 ? 'Race' :
                              activity.workout_type === 2 ? 'Long Run' :
                              activity.workout_type === 3 ? 'Workout' : 'Other';
          
          if (!types[workoutType]) {
            types[workoutType] = {
              name: workoutType,
              count: 0,
              distance: 0
            };
          }
          
          types[workoutType].count += 1;
          types[workoutType].distance += activity.distance || 0; // Already in miles
        });
        
        const typesArray = Object.values(types);
        setWorkoutTypes(typesArray.length > 0 ? typesArray : [{ name: 'No Data', count: 1, distance: 0 }]);
        
        // Calculate totals
        const totalDistance = processedData.reduce((sum, act) => sum + (act.distance || 0), 0);
        let totalPace = 0;
        let paceCount = 0;
        
        processedData.forEach(activity => {
          if (activity.pace && activity.pace > 0 && activity.pace < 60) { // Filter out unreasonable paces
            totalPace += activity.pace;
            paceCount++;
          }
        });
        
        setTotalStats({
          activities: processedData.length,
          distance: totalDistance.toFixed(2),
          elevation: processedData.reduce((sum, act) => sum + (act.elevation || 0), 0).toFixed(0),
          duration: (processedData.reduce((sum, act) => sum + (act.duration || 0), 0) / 60).toFixed(1),
          avgHeartRate: heartRateCount > 0 ? (heartRateSum / heartRateCount).toFixed(1) : 'N/A',
          avgPace: paceCount > 0 ? formatPace(totalPace / paceCount) : 'N/A'
        });
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading the data:", err);
        setError("Failed to load the data: " + (err.message || "Unknown error"));
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) {
      return "Invalid Date";
    }
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };
  
  // Format pace from decimal minutes to MM:SS format
  const formatPace = (paceInMinutes) => {
    if (!paceInMinutes || paceInMinutes <= 0 || paceInMinutes > 60) return "-";
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.floor((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Custom tooltip component with error handling
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-md">
          <p className="font-bold">{label || 'Unknown'}</p>
          {payload.map((entry, index) => {
            let displayValue = '';
            
            if (entry.name === 'Pace') {
              displayValue = formatPace(entry.value);
            } else if (typeof entry.value === 'number') {
              displayValue = entry.value.toFixed(2);
            } else {
              displayValue = entry.value;
            }
            
            return (
              <p key={index} style={{ color: entry.color }}>
                {entry.name || 'Value'}: {displayValue} {
                  entry.name === 'Distance' ? 'miles' : 
                  entry.name === 'Elevation' ? 'm' : 
                  entry.name === 'Duration' ? 'min' : 
                  entry.name === 'Pace' ? 'min/mile' : ''
                }
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const PieCustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length && payload[0] && typeof payload[0].value === 'number') {
      const value = payload[0].value;
      const name = payload[0].name || 'Unknown';
      const total = parseFloat(totalStats.distance) || 1;  // Avoid division by zero
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-md">
          <p className="font-bold">{name}</p>
          <p>{value.toFixed(2)} miles</p>
          <p>{((value / total) * 100).toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  const renderMetricSelector = () => (
    <div className="flex justify-center mb-4">
      <div className="inline-flex rounded-md shadow-sm" role="group">
        <button 
          type="button" 
          onClick={() => setSelectedMetric('distance')}
          className={`px-4 py-2 text-sm font-medium ${selectedMetric === 'distance' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-blue-600 hover:bg-gray-100'} 
            border border-blue-600 rounded-l-lg`}
        >
          Distance
        </button>
        <button 
          type="button" 
          onClick={() => setSelectedMetric('elevation')}
          className={`px-4 py-2 text-sm font-medium ${selectedMetric === 'elevation' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-blue-600 hover:bg-gray-100'} 
            border-t border-b border-blue-600`}
        >
          Elevation
        </button>
        <button 
          type="button" 
          onClick={() => setSelectedMetric('duration')}
          className={`px-4 py-2 text-sm font-medium ${selectedMetric === 'duration' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-blue-600 hover:bg-gray-100'} 
            border border-blue-600 rounded-r-lg`}
        >
          Duration
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Loading your Strava data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <p className="text-lg mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // If no data is available after loading
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-600">
          <p className="text-lg">No activity data found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-6 text-blue-800">Strava Running Analytics Dashboard</h1>
        <p className="text-center mb-6 text-gray-600">All distances in miles, pace in minutes per mile</p>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.activities}</div>
            <div className="text-gray-600 text-center">Total Activities</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.distance}</div>
            <div className="text-gray-600 text-center">Total Distance (miles)</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.elevation}</div>
            <div className="text-gray-600 text-center">Total Elevation (m)</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.duration}</div>
            <div className="text-gray-600 text-center">Total Hours</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.avgHeartRate}</div>
            <div className="text-gray-600 text-center">Avg Heart Rate</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.avgPace}</div>
            <div className="text-gray-600 text-center">Avg Pace (min/mi)</div>
          </div>
        </div>
        
        {/* Monthly Progress */}
        {monthlyStats.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Monthly Progress</h2>
            {renderMetricSelector()}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyStats}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="#8884d8" 
                    name="Activities" 
                    barSize={20}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={selectedMetric} 
                    stroke="#ff7300" 
                    name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Workout Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Workout Types Distribution</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workoutTypes}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {workoutTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Distance by Workout Type</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workoutTypes}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="distance"
                    nameKey="name"
                  >
                    {workoutTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieCustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        {/* Heart Rate vs. Pace */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Heart Rate vs. Pace</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid />
                <XAxis 
                  type="number" 
                  dataKey="pace" 
                  name="Pace" 
                  unit="min/mile" 
                  domain={[0, 'dataMax']}
                  label={{ value: 'Pace (min/mile)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="heartRate" 
                  name="Heart Rate" 
                  unit="bpm"
                  label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft', offset: -5 }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  formatter={(value, name) => {
                    if (name === 'Pace') {
                      return [formatPace(value), 'Pace (min/mile)'];
                    }
                    return [value, name];
                  }}
                />
                <Scatter 
                  name="Activities" 
                  data={data.filter(d => d.heartRate > 0 && d.pace > 0)} 
                  fill="#8884d8"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 border-b text-left">Date</th>
                  <th className="py-2 px-4 border-b text-left">Name</th>
                  <th className="py-2 px-4 border-b text-right">Distance (miles)</th>
                  <th className="py-2 px-4 border-b text-right">Duration (min)</th>
                  <th className="py-2 px-4 border-b text-right">Pace (min/mile)</th>
                  <th className="py-2 px-4 border-b text-right">Elevation (m)</th>
                  <th className="py-2 px-4 border-b text-right">Avg HR</th>
                  <th className="py-2 px-4 border-b text-right">Kudos</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(-10).reverse().map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">{formatDate(activity.date)}</td>
                    <td className="py-2 px-4 border-b">{activity.name}</td>
                    <td className="py-2 px-4 border-b text-right">{activity.distance.toFixed(2)}</td>
                    <td className="py-2 px-4 border-b text-right">{activity.duration.toFixed(0)}</td>
                    <td className="py-2 px-4 border-b text-right">
                      {formatPace(activity.pace)}
                    </td>
                    <td className="py-2 px-4 border-b text-right">{activity.elevation}</td>
                    <td className="py-2 px-4 border-b text-right">{activity.heartRate ? activity.heartRate.toFixed(1) : '-'}</td>
                    <td className="py-2 px-4 border-b text-right">{activity.kudos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StravaDashboard;