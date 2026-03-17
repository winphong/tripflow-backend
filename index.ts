import { connectDB } from "./db.js";
import { router } from "./router.js";

await connectDB();

const server = Bun.serve({
  port: 3005,
  fetch: router,
});

console.log(`TripFlow server running on http://localhost:${server.port}`);
