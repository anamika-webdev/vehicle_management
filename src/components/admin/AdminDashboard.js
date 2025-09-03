import React, { useState, useEffect } from 'react';
import { Shield, Car, Bell, MessageSquare, Phone, MapPin, Edit } from 'lucide-react';
import apiService from '../../services/api';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const tripsData = await apiService.getTrips();
      const sosData = await apiService.getSosAlerts();
      const feedbackData = await apiService.getDriverFeedback();
      setTrips(tripsData.data || []);
      setSosAlerts(sosData.data || []);
      setFeedback(feedbackData.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const renderTrips = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Generated Trips</h3>
      {trips.map(trip => (
        <div key={trip.id} className="p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p><strong>Trip ID:</strong> {trip.id}</p>
              <p><strong>Vehicle:</strong> {trip.vehicle}</p>
              <p><strong>Driver:</strong> {trip.driver}</p>
              <p><strong>Shift Time:</strong> {trip.shiftTime}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-blue-600 rounded-full hover:bg-blue-100"><Edit className="w-5 h-5" /></button>
              <button className="p-2 text-green-600 rounded-full hover:bg-green-100"><MapPin className="w-5 h-5" /></button>
              <button className="p-2 text-gray-600 rounded-full hover:bg-gray-100"><Phone className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSosAlerts = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">SOS Alerts</h3>
      {sosAlerts.map(alert => (
        <div key={alert.id} className="p-4 border rounded-lg bg-red-50">
          <p><strong>Alert ID:</strong> {alert.id}</p>
          <p><strong>Driver:</strong> {alert.driver}</p>
          <p><strong>Message:</strong> {alert.message}</p>
        </div>
      ))}
    </div>
  );

  const renderFeedback = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Driver Feedback</h3>
      {feedback.map(fb => (
        <div key={fb.id} className="p-4 border rounded-lg bg-yellow-50">
          <p><strong>From:</strong> {fb.employee}</p>
          <p><strong>Driver:</strong> {fb.driver}</p>
          <p><strong>Feedback:</strong> {fb.feedback}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center pb-4 mb-6 space-x-4 border-b">
        <button onClick={() => setActiveTab('trips')} className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'trips' ? 'bg-blue-100 text-blue-600' : ''}`}>
          <Car />
          <span>Trips</span>
        </button>
        <button onClick={() => setActiveTab('sos')} className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'sos' ? 'bg-red-100 text-red-600' : ''}`}>
          <Bell />
          <span>SOS Alerts</span>
        </button>
        <button onClick={() => setActiveTab('feedback')} className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'feedback' ? 'bg-yellow-100 text-yellow-600' : ''}`}>
          <MessageSquare />
          <span>Feedback</span>
        </button>
      </div>
      {loading ? <p>Loading...</p> : (
        <>
          {activeTab === 'trips' && renderTrips()}
          {activeTab === 'sos' && renderSosAlerts()}
          {activeTab === 'feedback' && renderFeedback()}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;