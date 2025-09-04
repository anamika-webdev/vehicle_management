import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import apiService from '../../services/api';

ChartJS.register(ArcElement, Tooltip, Legend);

const AdminStats = () => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const statsResult = await apiService.getAdminStats(); // This new API method will provide the data
      if (statsResult.success) {
        const stats = statsResult.data;
        setChartData({
          labels: ['On-Time Trips', 'Delayed Trips', 'SOS Alerts'],
          datasets: [
            {
              label: 'Trip & Alert Statistics',
              data: [stats.onTimeTrips, stats.delayedTrips, stats.sosAlerts],
              backgroundColor: [
                'rgba(75, 192, 192, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(255, 99, 132, 0.6)',
              ],
              borderColor: [
                'rgba(75, 192, 192, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(255, 99, 132, 1)',
              ],
              borderWidth: 1,
            },
          ],
        });
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return <p>Loading stats...</p>;
  }

  if (!chartData) {
    return <p>Could not load statistics.</p>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="mb-4 text-xl font-semibold">Dashboard Statistics</h3>
      <div style={{ maxWidth: '400px', margin: 'auto' }}>
        <Pie data={chartData} />
      </div>
    </div>
  );
};

export default AdminStats;