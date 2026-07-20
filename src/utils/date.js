// src/utils/date.js - Fixed timezone issue

export const formatDate = (d) => {
  if (!d) return "";
  const [year, month, day] = d.split('-');
  const dt = new Date(year, month - 1, day);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateRange = (start, end) => {
  if (!start) return "";
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
};

export const formatDateTime = (d) => {
  if (!d) return "";
  const [year, month, day] = d.split('-');
  const dt = new Date(year, month - 1, day);
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getTimeUntil = (d, t) => {
  const [year, month, day] = d.split('-');
  const targetDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));
  return days < 0
    ? t.past
    : days === 0
    ? t.today
    : days === 1
    ? t.tomorrow
    : t.inDays.replace("{n}", days);
};