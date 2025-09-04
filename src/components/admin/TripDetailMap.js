import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const createIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const driverIcon = createIcon('blue');
const pickupIcon = createIcon('green');
const dropoffIcon = createIcon('red');

const TripDetailMap = ({ trip }) => {
  if (!trip) {
    return null;
  }

  const { driver, employees, dropOffLocation } = trip;
  const center = [driver.location.lat, driver.location.lng];

  return (
    <MapContainer center={center} zoom={12} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Driver Marker */}
      <Marker position={[driver.location.lat, driver.location.lng]} icon={driverIcon}>
        <Popup>
          <strong>Driver: {driver.name}</strong><br />
          Current Location
        </Popup>
      </Marker>

      {/* Employee Pickup Markers */}
      {employees.map((employee, index) => (
        <Marker key={index} position={[employee.pickup.lat, employee.pickup.lng]} icon={pickupIcon}>
          <Popup>
            <strong>Pickup: {employee.name}</strong><br />
            Location: {employee.pickup.lat}, {employee.pickup.lng}
          </Popup>
        </Marker>
      ))}

      {/* Drop-off Marker */}
      <Marker position={[dropOffLocation.lat, dropOffLocation.lng]} icon={dropoffIcon}>
        <Popup>
          <strong>Drop-off Location</strong><br />
          Final Destination
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default TripDetailMap;