import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const client = new MongoClient(uri);

let connectionPromise: Promise<void> | null = null;

export async function connectDB() {
  if (!connectionPromise) {
    connectionPromise = client.connect().then(() => {
      console.log("Connected to MongoDB");
    });
  }
  await connectionPromise;
}

export function getDB() {
  return client.db("tripflow");
}
