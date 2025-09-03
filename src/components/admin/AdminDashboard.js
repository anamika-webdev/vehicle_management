import React, { useState, useEffect } from 'react';
import { Shield, Car, Bell, MessageSquare, Phone, MapPin, Edit, Star, Image as ImageIcon } from 'lucide-react';
import apiService from '../../services/api';
import Modal from '../common/Modal';
import EnhancedDeviceMap from '../tracking/EnhancedDeviceMap';
import EditTripModal from './EditTripModal';
import SOSImageModal from './SOSImageModal';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLocationModalOpen, setLocationModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isImageModalOpen, setImageModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

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

  const handleEditTrip = (trip) => {
    setSelectedTrip(trip);
    setEditModalOpen(true);
  };

  const handleViewLocation = (trip) => {
    setSelectedTrip(trip);
    setLocationModalOpen(true);
  };

  const handleViewImage = (alert) => {
    setSelectedAlert(alert);
    setImageModalOpen(true);
  };

  const handleCallDriver = (phoneNumber) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleSaveTrip = async (updatedTrip) => {
    setTrips(trips.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip)));
    await apiService.updateTrip(updatedTrip);
  };

  const renderRating = (rating) => {
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" />
        ))}
      </div>
    );
  };

  const renderTrips = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Generated Trips</h3>
      {trips.map(trip => (
        <div key={trip.id} className="p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p><strong>Trip ID:</strong> {trip.id}</p>
              <p><strong>Employee:</strong> {trip.employee}</p>
              <p><strong>Vehicle:</strong> {trip.vehicle}</p>
              <p><strong>Driver:</strong> {trip.driver}</p>
              <p><strong>Scheduled Time:</strong> {trip.scheduledTime}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleEditTrip(trip)} className="p-2 text-blue-600 rounded-full hover:bg-blue-100"><Edit className="w-5 h-5" /></button>
              <button onClick={() => handleViewLocation(trip)} className="p-2 text-green-600 rounded-full hover:bg-green-100"><MapPin className="w-5 h-5" /></button>
              <button onClick={() => handleCallDriver(trip.phone)} className="p-2 text-gray-600 rounded-full hover:bg-gray-100"><Phone className="w-5 h-5" /></button>
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
          <div className="flex items-center justify-between">
            <div>
              <p><strong>Alert ID:</strong> {alert.id}</p>
              <p><strong>Driver:</strong> {alert.driver}</p>
              <p><strong>Vehicle:</strong> {alert.vehicle}</p>
              <p><strong>Message:</strong> {alert.message}</p>
            </div>
            <div className="flex items-center space-x-2">
              {alert.imageUrl && (
                <button onClick={() => handleViewImage(alert)} className="p-2 text-purple-600 rounded-full hover:bg-purple-100">
                  <ImageIcon className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => handleCallDriver(alert.phone)} className="p-2 text-red-600 rounded-full hover:bg-red-100"><Phone className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFeedback = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Driver Feedback</h3>
      {feedback.map(fb => (
        <div key={fb.id} className={`p-4 border rounded-lg ${fb.rating >= 4 ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className="flex justify-between">
            <div>
              <p><strong>From:</strong> {fb.employee}</p>
              <p><strong>Driver:</strong> {fb.driver} ({fb.phone})</p>
            </div>
            <div>
              {renderRating(fb.rating)}
            </div>
          </div>
          <p className="mt-2"><strong>Feedback:</strong> {fb.feedback}</p>
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

      {selectedTrip && (
        <Modal isOpen={isLocationModalOpen} onClose={() => setLocationModalOpen(false)} title={`Trip Location: ${selectedTrip.id}`} size="4xl">
          <EnhancedDeviceMap
            device={{
              latitude: selectedTrip.latitude,
              longitude: selectedTrip.longitude,
              device_name: selectedTrip.vehicle
            }}
            center={[selectedTrip.latitude, selectedTrip.longitude]}
            zoom={15}
            height="500px"
          />
        </Modal>
      )}

      {selectedTrip && (
        <EditTripModal
          isOpen={isEditModalOpen}
          onClose={() => setEditModalOpen(false)}
          trip={selectedTrip}
          onSave={handleSaveTrip}
        />
      )}

      {selectedAlert && (
        <SOSImageModal
          isOpen={isImageModalOpen}
          onClose={() => setImageModalOpen(false)}
          imageUrl={selectedAlert.imageUrl}
          alertId={selectedAlert.id}
        />
      )}
    </div>
  );
};

export default AdminDashboard;