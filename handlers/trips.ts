import { ObjectId } from 'mongodb';
import { getDB } from '../db';

export async function getTrips(userId: string): Promise<Response> {
  const trips = await getDB()
    .collection('trips')
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: 1 })
    .toArray();

  return Response.json(
    trips.map(t => ({ id: (t._id as ObjectId).toString(), name: t.name, createdAt: t.createdAt }))
  );
}

export async function createTrip(userId: string, body: unknown): Promise<Response> {
  const { name } = body as { name: string };
  if (!name) return Response.json({ error: 'name required' }, { status: 400 });

  const result = await getDB().collection('trips').insertOne({
    name,
    userId: new ObjectId(userId),
    createdAt: new Date(),
  });

  return Response.json(
    { id: result.insertedId.toString(), name, createdAt: new Date() },
    { status: 201 }
  );
}

export async function deleteTrip(userId: string, tripId: string): Promise<Response> {
  const db = getDB();
  const trip = await db.collection('trips').findOne({
    _id: new ObjectId(tripId),
    userId: new ObjectId(userId),
  });
  if (!trip) return Response.json({ error: 'Not found' }, { status: 404 });

  await db.collection('trips').deleteOne({ _id: new ObjectId(tripId) });
  await db.collection('days').deleteMany({ tripId });
  return Response.json({ ok: true });
}
