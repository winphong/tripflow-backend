import { getDB } from "../db.js";
import type { DayPlan, TripItem } from "../types.js";
import { getTripAccess } from "./access.js";

type DayDoc = Omit<DayPlan, "id"> & { _id: string; tripId: string };

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-04-24" → "24 Apr 2026" */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${parseInt(day, 10)} ${MONTHS_SHORT[parseInt(month, 10) - 1]} ${year}`;
}

/** "14:30" → "2:30 PM" */
function formatTime(hhmm: string): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${period}`;
}

/** TripItem type → display label matching import template */
function formatType(type: TripItem["type"]): string {
  switch (type) {
    case "accommodation": return "Accommodation";
    case "travel": return "Travel";
    case "food": return "Food";
    default: return "Activity";
  }
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function itemToRow(date: string, item: TripItem): string {
  const cols = [
    formatDate(date),
    formatTime(item.time),
    item.activity,
    formatType(item.type),
    item.notes ?? "",
    item.mapLink ?? "",
  ];
  return cols.map(escapeCSV).join(",");
}

export async function exportTripToCSV(
  userId: string,
  tripId: string,
): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (!access) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const docs = await getDB()
    .collection<DayDoc>("days")
    .find({ tripId })
    .sort({ date: 1 })
    .toArray();

  // Flatten all items with their date, then sort by date + time
  type FlatItem = { date: string; item: TripItem };

  const allItems: FlatItem[] = [];
  for (const doc of docs) {
    for (const item of doc.items) {
      allItems.push({ date: doc.date, item });
    }
  }

  const byDateTime = (a: FlatItem, b: FlatItem): number => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.item.time ?? "").localeCompare(b.item.time ?? "");
  };

  const accommodation = allItems
    .filter((f) => f.item.type === "accommodation")
    .sort(byDateTime);

  const others = allItems
    .filter((f) => f.item.type !== "accommodation")
    .sort(byDateTime);

  const header = "Date,Time,Item,Type,Notes,Google Map Link";
  const lines: string[] = [header];

  for (const { date, item } of accommodation) {
    lines.push(itemToRow(date, item));
  }

  // Blank separator row between accommodation and the rest
  if (accommodation.length > 0 && others.length > 0) {
    lines.push("");
  }

  let lastDate: string | null = null;
  for (const { date, item } of others) {
    if (lastDate !== null && date !== lastDate) {
      lines.push("");
    }
    lines.push(itemToRow(date, item));
    lastDate = date;
  }

  const csv = lines.join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="trip-${tripId}.csv"`,
    },
  });
}
