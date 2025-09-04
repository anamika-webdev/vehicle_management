// src/utils/dateUtils.js

/**
 * Checks if a given date is within the next 30 days from today.
 * @param {string} dateString - The date to check, in 'YYYY-MM-DD' format.
 * @returns {boolean} - True if the date is expiring soon, false otherwise.
 */
export const isDateExpiringSoon = (dateString) => {
  if (!dateString) {
    return false;
  }
  const expiryDate = new Date(dateString);
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  return expiryDate > today && expiryDate <= thirtyDaysFromNow;
};