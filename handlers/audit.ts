import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { getTripAccess } from './access.js';

export type AuditAction =
  | 'create_trip'
  | 'delete_trip'
  | 'create_day'
  | 'delete_day'
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'reorder_items'
  | 'move_item'
  | 'import_csv'
  | 'create_invite'
  | 'revoke_invite'
  | 'respond_invite';

export async function logAudit(params: {
  tripId: string;
  userId: string;
  action: AuditAction;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { tripId, userId, action, entityId, details } = params;
  await getDB().collection('audit_logs').insertOne({
    tripId,
    userId: new ObjectId(userId),
    action,
    entityId: entityId ?? null,
    details: details ?? null,
    createdAt: new Date(),
  });
}

function toEntry(doc: any, emailMap: Map<string, string>) {
  const { _id, userId, ...rest } = doc;
  return {
    id: _id.toString(),
    ...rest,
    userId: userId.toString(),
    userEmail: emailMap.get(userId.toString()) ?? 'Unknown',
  };
}

export async function getAuditLog(userId: string, tripId: string): Promise<Response> {
  const access = await getTripAccess(tripId, userId);
  if (!access) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDB();
  const entries = await db
    .collection('audit_logs')
    .find({ tripId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const userIds = [...new Set(entries.map((e: any) => e.userId.toString()))];
  const users = userIds.length > 0
    ? await db.collection('users').find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } }).toArray()
    : [];
  const emailMap = new Map(users.map((u: any) => [u._id.toString(), u.email]));

  return Response.json(entries.map((e) => toEntry(e, emailMap)));
}
