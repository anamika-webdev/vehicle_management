
import React from 'react';

const StatCard = ({ title, value, icon: Icon, color, trend = null, onClick = null }) => {
  return (
    <div 
      className={`p-6 bg-white border-l-4 rounded-lg shadow-md ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span className={`ml-2 text-sm ${
                trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
        </div>
        <Icon className="w-12 h-12 text-gray-400" />
      </div>
    </div>
  );
};

export default StatCard;