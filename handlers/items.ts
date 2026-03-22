import { getDB } from '../db.js';
import type { TripItem } from '../types.js';
import { getTripAccess } from './access.js';

export async function createItem(userId: string, tripId: string, dayId: string, body: unknown): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
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
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const patch = body as Record<string, unknown>;
  const setOps: Record<string, unknown> = {};
  const unsetOps: Record<string, ''> = {};
  for (const [key, val] of Object.entries(patch)) {
    if (key === 'id') continue;
    if (val === null) {
      unsetOps[`items.$[elem].${key}`] = '';
    } else {
      setOps[`items.$[elem].${key}`] = val;
    }
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(setOps).length > 0) update.$set = setOps;
  if (Object.keys(unsetOps).length > 0) update.$unset = unsetOps;

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    update as never,
    { arrayFilters: [{ 'elem.id': id }] }
  );
  return Response.json({ ok: true });
}

export async function reorderItems(userId: string, tripId: string, dayId: string, body: unknown): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { itemIds } = body as { itemIds: string[] };
  if (!Array.isArray(itemIds)) {
    return Response.json({ error: 'itemIds must be an array' }, { status: 400 });
  }

  const day = await getDB().collection('days').findOne({ _id: dayId, tripId } as never);
  if (!day) return Response.json({ error: 'Not found' }, { status: 404 });

  const itemMap = new Map((day.items as TripItem[]).map((i: TripItem) => [i.id, i]));
  const reordered = itemIds.map(id => itemMap.get(id)).filter(Boolean);

  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    { $set: { items: reordered } } as never
  );
  return Response.json({ ok: true });
}

export async function deleteItem(userId: string, tripId: string, dayId: string, id: string): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    { $pull: { items: { id } } as never }
  );
  return Response.json({ ok: true });
}
