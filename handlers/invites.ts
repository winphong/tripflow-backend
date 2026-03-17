import { ObjectId } from 'mongodb';
import { getDB } from '../db';

function toInvite(doc: any) {
  const { _id, ...rest } = doc;
  return {
    id: _id.toString(),
    ...rest,
    invitedBy: rest.invitedBy.toString(),
    userId: rest.userId ? rest.userId.toString() : null,
  };
}

async function isOwner(tripId: string, userId: string): Promise<boolean> {
  const trip = await getDB().collection('trips').findOne({
    _id: new ObjectId(tripId),
    userId: new ObjectId(userId),
  });
  return trip !== null;
}

// POST /api/trips/:tripId/invites
export async function createInvite(userId: string, tripId: string, body: unknown): Promise<Response> {
  if (!await isOwner(tripId, userId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, role } = body as { email?: string; role?: string };
  if (!email || !role) {
    return Response.json({ error: 'email and role required' }, { status: 400 });
  }
  if (role !== 'viewer' && role !== 'collaborator') {
    return Response.json({ error: 'role must be viewer or collaborator' }, { status: 400 });
  }

  const db = getDB();
  const normalizedEmail = email.toLowerCase().trim();

  const owner = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (owner?.email === normalizedEmail) {
    return Response.json({ error: 'Cannot invite yourself' }, { status: 400 });
  }

  const existing = await db.collection('trip_invites').findOne({ tripId, email: normalizedEmail });
  if (existing) {
    return Response.json({ error: 'Invite already sent to this email' }, { status: 409 });
  }

  const invitee = await db.collection('users').findOne({ email: normalizedEmail });

  const doc = {
    tripId,
    invitedBy: new ObjectId(userId),
    email: normalizedEmail,
    role,
    status: 'pending',
    userId: invitee ? invitee._id : null,
    createdAt: new Date(),
    respondedAt: null,
  };

  const result = await db.collection('trip_invites').insertOne(doc);
  return Response.json(toInvite({ _id: result.insertedId, ...doc }), { status: 201 });
}

// GET /api/trips/:tripId/invites
export async function getTripInvites(userId: string, tripId: string): Promise<Response> {
  if (!await isOwner(tripId, userId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invites = await getDB()
    .collection('trip_invites')
    .find({ tripId })
    .sort({ createdAt: 1 })
    .toArray();

  return Response.json(invites.map(toInvite));
}

// DELETE /api/trips/:tripId/invites/:inviteId
export async function revokeInvite(userId: string, tripId: string, inviteId: string): Promise<Response> {
  if (!await isOwner(tripId, userId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await getDB().collection('trip_invites').deleteOne({
    _id: new ObjectId(inviteId),
    tripId,
  });
  return Response.json({ ok: true });
}

// GET /api/invites
export async function getMyInvites(userId: string): Promise<Response> {
  const db = getDB();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });

  const invites = await db
    .collection('trip_invites')
    .find({ email: user.email })
    .sort({ createdAt: -1 })
    .toArray();

  const tripIds = [...new Set(invites.map((i: any) => i.tripId))];
  const trips = await db
    .collection('trips')
    .find({ _id: { $in: tripIds.map((id: string) => new ObjectId(id)) } })
    .toArray();

  const tripMap = new Map(trips.map((t: any) => [t._id.toString(), t.name]));

  return Response.json(
    invites.map((inv: any) => ({
      ...toInvite(inv),
      tripName: tripMap.get(inv.tripId) ?? null,
    }))
  );
}

// PATCH /api/invites/:inviteId
export async function respondToInvite(userId: string, inviteId: string, body: unknown): Promise<Response> {
  const { action } = body as { action?: string };
  if (action !== 'accept' && action !== 'decline') {
    return Response.json({ error: 'action must be accept or decline' }, { status: 400 });
  }

  const db = getDB();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });

  const invite = await db.collection('trip_invites').findOne({ _id: new ObjectId(inviteId) });
  if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });
  if (invite.email !== user.email) return Response.json({ error: 'Forbidden' }, { status: 403 });

  if (action === 'decline') {
    await db.collection('trip_invites').deleteOne({ _id: new ObjectId(inviteId) });
    return Response.json({ ok: true });
  }

  await db.collection('trip_invites').updateOne(
    { _id: new ObjectId(inviteId) },
    { $set: { status: 'accepted', userId: new ObjectId(userId), respondedAt: new Date() } }
  );
  return Response.json({ ok: true });
}
