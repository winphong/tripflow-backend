import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../db.js";
import { router } from "../router.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathname = (req.url ?? "").split("?")[0];
  console.log(`[handler] ${req.method} ${pathname}`);

  if (!pathname.startsWith("/api")) {
    console.log(`[handler] non-api path, returning 404`);
    return res.status(404).send("Not found");
  }

  if (pathname === "/api/health") {
    console.log(`[handler] health check, skipping DB`);
    return res.status(200).json({ ok: true });
  }

  console.log(`[handler] connecting to DB...`);
  await connectDB();
  console.log(`[handler] DB connected, routing request`);

  const webReq = new Request(`https://placeholder.local${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: ["GET", "HEAD"].includes(req.method!) ? undefined : JSON.stringify(req.body),
  });

  const response = await router(webReq);
  const body = await response.text();

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
}
