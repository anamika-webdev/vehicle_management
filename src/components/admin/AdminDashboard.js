import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Car, Bell, MessageSquare, PieChart, Phone, MapPin, Edit, Star, Image as ImageIcon, Download, AlertTriangle } from 'lucide-react';
import apiService from '../../services/api';
import Modal from '../common/Modal';
import EditTripModal from './EditTripModal';
import SOSImageModal from './SOSImageModal';
import TripDetailMap from './TripDetailMap';
import AdminStats from './AdminStats'; // Import the new stats component
import { isDateExpiringSoon } from '../../utils/dateUtils';
import { downloadReports } from '../../utils/exportUtils';

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

  const handleDownloadReports = () => {
    const flattenedTrips = trips.map(trip => ({
        tripId: trip.id,
        checkIn: trip.checkIn,
        checkOut: trip.checkOut,
        passengers: trip.passengers,
        employees: trip.employees.map(e => e.name).join('; '),
        vehicle: trip.vehicle.name,
        insuranceExpiry: trip.vehicle.insuranceExpiry,
        uptime: trip.vehicle.uptime,
        downtime: trip.vehicle.downtime,
        emptyMiles: trip.vehicle.emptyMiles,
        driverName: trip.driver.name,
        driverPhone: trip.driver.phone,
        driverLicense: trip.driver.licenseNumber,
        licenseExpiry: trip.driver.licenseExpiry
    }));
    downloadReports({ trips: flattenedTrips, sosAlerts, feedback });
    toast.info("Downloading reports...");
  };

  const handleSaveTrip = async (updatedTrip) => {
    setTrips(trips.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip)));
    await apiService.updateTrip(updatedTrip);
    toast.success(`Trip ${updatedTrip.id} updated successfully!`);
  };

  const renderRating = (rating) => (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" />
      ))}
    </div>
  );

  const renderTrips = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Generated Trips</h3>
        <button 
          onClick={handleDownloadReports} 
          className="flex items-center px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </button>
      </div>
      {trips.map(trip => (
        <div key={trip.id} className="p-4 border rounded-lg bg-gray-50">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1 text-sm">
              <p><strong>Trip ID:</strong> {trip.id}</p>
              <p><strong>Check-in / Check-out:</strong> {trip.checkIn} / {trip.checkOut}</p>
              <p><strong>Passengers:</strong> {trip.passengers}</p>
              <div className="mt-2">
                <p><strong>Employees:</strong></p>
                <ul className="pl-2 list-disc list-inside">
                  {trip.employees.map((employee, index) => (
                    <li key={index}>{employee.name}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p><strong>Vehicle:</strong> {trip.vehicle.name}</p>
              <p className={`flex items-center ${isDateExpiringSoon(trip.vehicle.insuranceExpiry) ? 'text-red-600 font-bold' : ''}`}>
                <strong>Insurance Expires:</strong> {trip.vehicle.insuranceExpiry}
                {isDateExpiringSoon(trip.vehicle.insuranceExpiry) && <AlertTriangle title="Expiring soon!" className="w-4 h-4 ml-2" />}
              </p>
              <p><strong>Driver:</strong> {trip.driver.name}</p>
              <p><strong>License:</strong> {trip.driver.licenseNumber} (Expires: {trip.driver.licenseExpiry})</p>
              <div className="pt-2 mt-2 border-t">
                <p><strong>Uptime / Downtime:</strong> {trip.vehicle.uptime} / {trip.vehicle.downtime}</p>
                <p><strong>Empty Miles:</strong> {trip.vehicle.emptyMiles}</p>
              </div>
            </div>
            <div className="flex items-start justify-end space-x-2">
              <button onClick={() => handleEditTrip(trip)} title="Edit Trip" className="p-2 text-blue-600 rounded-full hover:bg-blue-100"><Edit className="w-5 h-5" /></button>
              <button onClick={() => handleViewLocation(trip)} title="View on Map" className="p-2 text-green-600 rounded-full hover:bg-green-100"><MapPin className="w-5 h-5" /></button>
              <button onClick={() => handleCallDriver(trip.driver.phone)} title="Call Driver" className="p-2 text-gray-600 rounded-full hover:bg-gray-100"><Phone className="w-5 h-5" /></button>
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
                <button onClick={() => handleViewImage(alert)} title="View Image" className="p-2 text-purple-600 rounded-full hover:bg-purple-100">
                  <ImageIcon className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => handleCallDriver(alert.phone)} title="Call Driver" className="p-2 text-red-600 rounded-full hover:bg-red-100"><Phone className="w-5 h-5" /></button>
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
              <p><strong>Driver:</strong> {fb.driver}</p>
            </div>
            <div>{renderRating(fb.rating)}</div>
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
          <Car /><span>Trips</span>
        </button>
        <button onClick={() => setActiveTab('sos')} className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'sos' ? 'bg-red-100 text-red-600' : ''}`}>
          <Bell /><span>SOS Alerts</span>
        </button>
        <button onClick={() => setActiveTab('feedback')} className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'feedback' ? 'bg-yellow-100 text-yellow-600' : ''}`}>
          <MessageSquare /><span>Feedback</span>
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'stats' ? 'bg-indigo-100 text-indigo-600' : ''}`}>
          <PieChart /><span>Stats</span>
        </button>
      </div>
      {loading ? <p>Loading...</p> : (
        <>
          {activeTab === 'stats' && <AdminStats />}
          {activeTab === 'trips' && renderTrips()}
          {activeTab === 'sos' && renderSosAlerts()}
          {activeTab === 'feedback' && renderFeedback()}
        </>
      )}

      {selectedTrip && (
        <Modal isOpen={isLocationModalOpen} onClose={() => setLocationModalOpen(false)} title={`Trip Details: ${selectedTrip.id}`} size="4xl">
          <TripDetailMap trip={selectedTrip} />
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