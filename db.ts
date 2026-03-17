import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const client = new MongoClient(uri, {
  // serverSelectionTimeoutMS: 5000,
  // connectTimeoutMS: 5000,
});

export async function connectDB() {
  console.log("Connecting to MongoDB");
  await client.connect();
  console.log("Connected to MongoDB");
}

export function getDB() {
  return client.db("tripflow");
}
