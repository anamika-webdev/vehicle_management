import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

const DataTable = ({ 
  title, 
  headers, 
  rows, 
  onAdd, 
  onEdit, 
  onDelete, 
  loading = false,
  emptyMessage = 'No data available'
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {onAdd && (
            <button
              onClick={() => onAdd()}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              <Plus className="w-4 h-4" />
              Add New
            </button>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index} 
                  className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"
                >
                  {header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td 
                  colSpan={headers.length + (onEdit || onDelete ? 1 : 0)} 
                  className="px-6 py-8 text-center text-gray-500"
                >
                  {loading ? 'Loading...' : emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {Object.values(row).map((cell, cellIndex) => (
                    <td 
                      key={cellIndex} 
                      className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                  
                  {(onEdit || onDelete) && (
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                      <div className="flex gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                            disabled={loading}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(Object.values(row)[0])}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;