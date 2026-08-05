import { getDB, withTransaction } from '../db.js';
import type { TripItem } from '../types.js';
import { getTripAccess } from './access.js';
import { logAudit } from './audit.js';

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
  await logAudit({
    tripId,
    userId,
    action: 'create_item',
    entityId: newItem.id,
    details: { dayId, item: newItem },
  });
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

  const day = await getDB().collection('days').findOne({ _id: dayId, tripId } as never);
  const existing = (day?.items as TripItem[] | undefined)?.find((i) => i.id === id);

  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    update as never,
    { arrayFilters: [{ 'elem.id': id }] }
  );

  const after: Record<string, unknown> | null = existing ? { ...existing } : null;
  if (after) {
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'id') continue;
      if (val === null) delete after[key];
      else after[key] = val;
    }
  }
  await logAudit({
    tripId,
    userId,
    action: 'update_item',
    entityId: id,
    details: { dayId, before: existing ?? null, after },
  });
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
  await logAudit({ tripId, userId, action: 'reorder_items', entityId: dayId });
  return Response.json({ ok: true });
}

export async function moveItemToDay(userId: string, tripId: string, itemId: string, body: unknown): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { fromDayId, toDayId, toItemIds } = body as {
    fromDayId?: string;
    toDayId?: string;
    toItemIds?: string[];
  };
  if (!fromDayId || !toDayId || !Array.isArray(toItemIds)) {
    return Response.json({ error: 'fromDayId, toDayId and toItemIds are required' }, { status: 400 });
  }

  try {
    await withTransaction(async (session) => {
      const days = getDB().collection('days');

      const fromDay = await days.findOne({ _id: fromDayId, tripId } as never, { session });
      const item = (fromDay?.items as TripItem[] | undefined)?.find((i) => i.id === itemId);
      if (!fromDay || !item) {
        throw new Error('ITEM_NOT_FOUND');
      }

      await days.updateOne(
        { _id: fromDayId, tripId },
        { $pull: { items: { id: itemId } } } as never,
        { session },
      );

      const toDay = await days.findOne({ _id: toDayId, tripId } as never, { session });
      if (!toDay) throw new Error('DEST_DAY_NOT_FOUND');

      const itemMap = new Map((toDay.items as TripItem[]).map((i: TripItem) => [i.id, i]));
      itemMap.set(itemId, item);
      const reordered = toItemIds.map(id => itemMap.get(id)).filter(Boolean);

      await days.updateOne(
        { _id: toDayId, tripId },
        { $set: { items: reordered } } as never,
        { session },
      );
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'ITEM_NOT_FOUND') {
      return Response.json({ error: 'Item not found in source day' }, { status: 404 });
    }
    if (err instanceof Error && err.message === 'DEST_DAY_NOT_FOUND') {
      return Response.json({ error: 'Destination day not found' }, { status: 404 });
    }
    throw err;
  }

  await logAudit({
    tripId,
    userId,
    action: 'move_item',
    entityId: itemId,
    details: { fromDayId, toDayId },
  });
  return Response.json({ ok: true });
}

export async function deleteItem(userId: string, tripId: string, dayId: string, id: string): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (access !== 'owner' && access !== 'collaborator') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const day = await getDB().collection('days').findOne({ _id: dayId, tripId } as never);
  const item = (day?.items as TripItem[] | undefined)?.find((i) => i.id === id);

  await getDB().collection('days').updateOne(
    { _id: dayId, tripId },
    { $pull: { items: { id } } as never }
  );
  await logAudit({
    tripId,
    userId,
    action: 'delete_item',
    entityId: id,
    details: { dayId, item: item ?? null },
  });
  return Response.json({ ok: true });
}
