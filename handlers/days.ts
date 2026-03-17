import { getDB } from "../db";
import type { DayPlan } from "../types";
import { getTripAccess } from "./access";

type DayDoc = Omit<DayPlan, "id"> & { _id: string; tripId: string };

function toDay(doc: DayDoc): DayPlan {
  const { _id, tripId: _tripId, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function getAllDays(userId: string, tripId: string): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (!access) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const docs = await getDB()
    .collection<DayDoc>("days")
    .find({ tripId })
    .sort({ date: 1 })
    .toArray();
  return Response.json(docs.map(toDay));
}

export async function createDay(userId: string, tripId: string, body: unknown): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { date } = body as { date: string };
  if (!date) return Response.json({ error: 'date required' }, { status: 400 });

  const dateStr = date.replace(/-/g, '');
  const id = `day-${tripId}-${dateStr}`;

  await getDB()
    .collection<DayDoc>("days")
    .insertOne({ _id: id, date, tripId, items: [] });
  return Response.json({ id, date, items: [] }, { status: 201 });
}

export async function deleteDay(userId: string, tripId: string, id: string): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  await getDB()
    .collection("days")
    .deleteOne({ _id: id, tripId });
  return Response.json({ ok: true });
}
