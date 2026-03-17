import { connectDB } from "../db";
import { router } from "../router";

export default async function handler(request: Request): Promise<Response> {
  await connectDB();
  return router(request);
}
