// Monday-start calendar/date helpers. Dates are plain Date objects at local
// midnight; ISO strings ("YYYY-MM-DD") are what gets stored/compared.

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISODate() {
  return toISODate(new Date());
}

// Mon=0 .. Sun=6
function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

// Returns an array of Date objects covering the full Monday-start weeks
// needed to display `year`/`month` (month is 0-indexed), padded with the
// trailing days of the previous/next month.
export function monthGridDates(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - mondayIndex(firstOfMonth.getDay()));

  const lastOfMonth = new Date(year, month + 1, 0);
  const trailing = 6 - mondayIndex(lastOfMonth.getDay());
  const end = new Date(year, month + 1, trailing);

  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en", { month: "long" });
}
