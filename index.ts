import { connectDB } from "./db";
import { router } from "./router";

await connectDB();

const server = Bun.serve({
  port: 3005,
  fetch: router,
});

console.log(`TripFlow server running on http://localhost:${server.port}`);
