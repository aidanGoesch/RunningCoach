export const getMondayStartLocal = (date = new Date()) => {
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const formatLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getWeekKey = (date = new Date()) => {
  return formatLocalDateKey(getMondayStartLocal(date));
};

// Legacy malformed format kept for one-time migration reads only (e.g. 2026-0-5).
export const getLegacyWeekKey = (date = new Date()) => {
  const monday = getMondayStartLocal(date);
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
};
