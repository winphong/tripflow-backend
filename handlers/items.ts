import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import type { TripItem } from '../types';

async function checkTripOwnership(tripId: string, userId: string): Promise<boolean> {
  const trip = await getDB().collection('trips').findOne({
    _id: new ObjectId(tripId),
    userId: new ObjectId(userId),
  });
  return trip !== null;
}

export async function createItem(userId: string, tripId: string, dayId: string, body: unknown): Promise<Response> {
  if (!await checkTripOwnership(tripId, userId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const item = body as Partial<TripItem>;
  const newItem: TripItem = {
    ...item,
    id: item.id ?? Math.random().toString(36).substr(2, 9),
  } as TripItem;

  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    { $push: { items: newItem } as never }
  );
  return Response.json(newItem, { status: 201 });
}

export async function updateItem(userId: string, tripId: string, dayId: string, id: string, body: unknown): Promise<Response> {
  if (!await checkTripOwnership(tripId, userId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const patch = body as Partial<TripItem>;
  const setOps: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(patch)) {
    if (key !== 'id') setOps[`items.$[elem].${key}`] = val;
  }

  if (Object.keys(setOps).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    { $set: setOps },
    { arrayFilters: [{ 'elem.id': id }] }
  );
  return Response.json({ ok: true });
}

export async function deleteItem(userId: string, tripId: string, dayId: string, id: string): Promise<Response> {
  if (!await checkTripOwnership(tripId, userId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    { $pull: { items: { id } } as never }
  );
  return Response.json({ ok: true });
}
