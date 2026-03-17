import { connectDB, getDB } from './db.js';

await connectDB();
const db = getDB();

// --- users collection ---
const usersCols = await db.listCollections({ name: 'users' }).toArray();
if (usersCols.length === 0) {
  await db.createCollection('users');
  console.log('Created collection: users');
} else {
  console.log('Collection already exists: users');
}
await db.collection('users').createIndex({ email: 1 }, { unique: true });
console.log('Index ensured: users.email (unique)');

// --- trips collection ---
const tripsCols = await db.listCollections({ name: 'trips' }).toArray();
if (tripsCols.length === 0) {
  await db.createCollection('trips');
  console.log('Created collection: trips');
} else {
  console.log('Collection already exists: trips');
}
await db.collection('trips').createIndex({ userId: 1 });
console.log('Index ensured: trips.userId');

// --- days collection ---
// WARNING: Old days data (without tripId) is no longer valid. Clear dev data if needed.
const daysCols = await db.listCollections({ name: 'days' }).toArray();
if (daysCols.length === 0) {
  await db.createCollection('days', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'date', 'tripId', 'items'],
        properties: {
          _id:    { bsonType: 'string' },
          date:   { bsonType: 'string', description: 'YYYY-MM-DD' },
          tripId: { bsonType: 'string' },
          items: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['id', 'time', 'location', 'activity', 'type'],
              properties: {
                id:       { bsonType: 'string' },
                time:     { bsonType: 'string' },
                location: { bsonType: 'string' },
                activity: { bsonType: 'string' },
                type:     { enum: ['accommodation', 'activity', 'travel', 'food'] },
                mapLink:  { bsonType: 'string' },
                notes:    { bsonType: 'string' },
                lat:      { bsonType: 'double' },
                lng:      { bsonType: 'double' },
              },
            },
          },
        },
      },
    },
  });
  console.log('Created collection: days');
} else {
  console.log('Collection already exists: days');
  // Drop old unique date index if it exists (no longer valid — dates are unique per trip, not globally)
  try {
    await db.collection('days').dropIndex('date_1');
    console.log('Dropped old index: days.date (unique)');
  } catch {
    // Index may not exist
  }
}

// Compound index: unique per trip per date
await db.collection('days').createIndex({ tripId: 1, date: 1 }, { unique: true });
console.log('Index ensured: days.{tripId, date} (unique)');

// --- trip_invites collection ---
const invitesCols = await db.listCollections({ name: 'trip_invites' }).toArray();
if (invitesCols.length === 0) {
  await db.createCollection('trip_invites');
  console.log('Created collection: trip_invites');
} else {
  console.log('Collection already exists: trip_invites');
}
await db.collection('trip_invites').createIndex({ tripId: 1, email: 1 }, { unique: true });
console.log('Index ensured: trip_invites.{tripId, email} (unique)');
await db.collection('trip_invites').createIndex({ email: 1, status: 1 });
console.log('Index ensured: trip_invites.{email, status}');
await db.collection('trip_invites').createIndex({ userId: 1, status: 1 });
console.log('Index ensured: trip_invites.{userId, status}');
await db.collection('trip_invites').createIndex({ tripId: 1, status: 1 });
console.log('Index ensured: trip_invites.{tripId, status}');

console.log('Migration complete');
process.exit(0);
