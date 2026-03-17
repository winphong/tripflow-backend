import { ObjectId } from 'mongodb';
import { getDB } from '../db';

export type TripAccessLevel = 'owner' | 'collaborator' | 'viewer' | null;

export async function getTripAccess(tripId: string, userId: string): Promise<TripAccessLevel> {
  const db = getDB();

  const trip = await db.collection('trips').findOne({
    _id: new ObjectId(tripId),
    userId: new ObjectId(userId),
  });
  if (trip) return 'owner';

  const invite = await db.collection('trip_invites').findOne({
    tripId,
    userId: new ObjectId(userId),
    status: 'accepted',
  });
  if (invite) return invite.role as 'collaborator' | 'viewer';

  return null;
}
