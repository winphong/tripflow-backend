import { connectDB } from "../db.js";
import { router } from "../router.js";

export default async function handler(request: Request): Promise<Response> {
  await connectDB();
  return router(request);
}
