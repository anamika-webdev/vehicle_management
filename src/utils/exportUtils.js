// src/utils/exportUtils.js

/**
 * Converts an array of objects to a CSV string.
 * @param {Array<Object>} data - The data to convert.
 * @returns {string} - The CSV formatted string.
 */
const convertToCSV = (data) => {
  if (!data || data.length === 0) {
    return '';
  }
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => JSON.stringify(row[header], (key, value) => value === null ? '' : value)).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Triggers a download of a CSV file.
 * @param {string} csvString - The CSV data to download.
 * @param {string} filename - The name of the file to be saved.
 */
export const downloadCSV = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Prepares and downloads the reports for trips, SOS alerts, and feedback.
 * @param {Object} reportData - An object containing arrays of data for each report type.
 */
export const downloadReports = (reportData) => {
  const { trips, sosAlerts, feedback } = reportData;

  if (trips.length > 0) {
    const tripsCSV = convertToCSV(trips);
    downloadCSV(tripsCSV, 'trip_report.csv');
  }

  if (sosAlerts.length > 0) {
    const sosCSV = convertToCSV(sosAlerts);
    downloadCSV(sosCSV, 'sos_alerts_report.csv');
  }

  if (feedback.length > 0) {
    const feedbackCSV = convertToCSV(feedback);
    downloadCSV(feedbackCSV, 'feedback_report.csv');
  }
};