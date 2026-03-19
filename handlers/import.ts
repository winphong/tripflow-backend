import { getDB } from "../db.js";
import type { TripItem } from "../types.js";
import { getTripAccess } from "./access.js";

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded newlines / commas
// ---------------------------------------------------------------------------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else if (ch !== "\r") {
        field += ch;
      }
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

/** "24 Apr 2026" → "2026-04-24" */
function parseDate(raw: string): string {
  const parts = raw.trim().split(" ");
  if (parts.length !== 3) return "";
  const [day, mon, year] = parts;
  const month = MONTHS[mon];
  if (!month) return "";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

/** "2:00 PM" / "6:50 PM" / "12:00 AM" → "HH:mm" */
function parseTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/** "Hotel" / "Travel" / "Activity" / "Food" → TripItem type */
function parseType(raw: string): TripItem["type"] {
  switch (raw.trim().toLowerCase()) {
    case "hotel":
    case "accommodation":
      return "accommodation";
    case "travel":
      return "travel";
    case "food":
      return "food";
    default:
      return "activity";
  }
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
// Expected CSV columns: Date, Time, Item, Type, Notes, Google Map Link
export async function importTripFromCSV(
  userId: string,
  tripId: string,
  req: Request,
): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== "owner" && access !== "collaborator") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data with a 'file' field" },
      { status: 400 },
    );
  }

  if (!file) {
    return Response.json(
      { error: "'file' field is required" },
      { status: 400 },
    );
  }

  const csvText = await file.text();
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    return Response.json({ error: "CSV is empty" }, { status: 422 });
  }

  // Skip header row, group items by date
  const dayMap = new Map<string, TripItem[]>();

  for (const row of rows.slice(1)) {
    const [rawDate, rawTime, activity, rawType, notes, mapLink] = row;

    console.log("row", row);

    const date = parseDate(rawDate ?? "");
    if (!date) continue; // blank / separator row

    const item: TripItem = {
      id: genId(),
      time: parseTime(rawTime ?? ""),
      activity: activity?.trim() ?? "",
      location: "",
      type: parseType(rawType ?? ""),
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
      ...(mapLink?.trim() ? { mapLink: mapLink.trim() } : {}),
    };

    if (!item.activity) continue;

    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(item);
  }

  const db = getDB();
  let daysCreated = 0;

  for (const [date, items] of dayMap) {
    const dayId = `day-${tripId}-${date.replace(/-/g, "")}`;

    // Upsert by (tripId, date) — creates or fully replaces the day
    const result = await db
      .collection("days")
      .replaceOne(
        { tripId, date },
        { _id: dayId, date, tripId, items } as never,
        { upsert: true },
      );
    if (result.upsertedCount > 0 || result.modifiedCount > 0) daysCreated++;
  }

  return Response.json({ ok: true, daysCreated });
}
