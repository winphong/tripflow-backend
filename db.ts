import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  maxIdleTimeMS: 10000,
  minPoolSize: 0,
});

let connectionPromise: Promise<void> | null = null;

export async function connectDB() {
  if (!connectionPromise) {
    console.log("[db] initiating new MongoDB connection...");
    connectionPromise = client
      .connect()
      .then(() => {
        console.log("[db] MongoDB connected successfully");
      })
      .catch((err) => {
        console.error("[db] MongoDB connection failed:", err.message);
        connectionPromise = null;
        throw err;
      });
  } else {
    console.log("[db] reusing existing connection promise");
  }
  await connectionPromise;
  console.log("[db] connectDB resolved");
}

export function getDB() {
  return client.db("tripflow");
}
