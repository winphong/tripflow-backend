import { register, login } from "./handlers/auth.js";
import { importTripFromCSV } from "./handlers/import.js";
import { exportTripToCSV } from "./handlers/export.js";
import { getTrips, createTrip, deleteTrip } from "./handlers/trips.js";
import { getAllDays, createDay, deleteDay } from "./handlers/days.js";
import { createItem, updateItem, deleteItem, reorderItems } from "./handlers/items.js";
import {
  createInvite,
  getTripInvites,
  revokeInvite,
  getMyInvites,
  respondToInvite,
} from "./handlers/invites.js";
import { verifyAuth } from "./middleware/auth.js";
import { resolveUrl } from "./handlers/urlResolver.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":
    process.env.FRONTEND_URL ?? "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export async function router(req: Request): Promise<Response> {
  const url = new URL(req.url, `https://${req.headers["host"]}`);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  let res: Response;

  if (path === "/api/health" && method === "GET") {
    res = Response.json({ ok: true });
  } else if (path === "/api/resolve-url" && method === "GET") {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return withCors(auth);
    const target = url.searchParams.get("url");
    if (!target) {
      res = Response.json({ error: "url required" }, { status: 400 });
    } else {
      res = await resolveUrl(target);
    }
  } else if (path === "/api/auth/register" && method === "POST") {
    const body = await req.json();
    res = await register(body);
  } else if (path === "/api/auth/login" && method === "POST") {
    const body = await req.json();
    res = await login(body);
  } else if (path === "/api/trips" && method === "GET") {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return withCors(auth);
    res = await getTrips(auth.userId);
  } else if (path === "/api/trips" && method === "POST") {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return withCors(auth);
    const body = await req.json();
    res = await createTrip(auth.userId, body);
  } else if (path === "/api/invites" && method === "GET") {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return withCors(auth);
    res = await getMyInvites(auth.userId);
  } else if (path.match(/^\/api\/invites\/([^/]+)$/) && method === "PATCH") {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return withCors(auth);
    const [, inviteId] = path.match(/^\/api\/invites\/([^/]+)$/)!;
    const body = await req.json();
    res = await respondToInvite(auth.userId, inviteId, body);
  } else {
    const tripMatch = path.match(/^\/api\/trips\/([^/]+)$/);
    const daysListMatch = path.match(/^\/api\/trips\/([^/]+)\/days$/);
    const dayMatch = path.match(/^\/api\/trips\/([^/]+)\/days\/([^/]+)$/);
    const itemsMatch = path.match(
      /^\/api\/trips\/([^/]+)\/days\/([^/]+)\/items(?:\/([^/]+))?$/,
    );
    const importCsvMatch = path.match(/^\/api\/trips\/([^/]+)\/import-csv$/);
    const exportCsvMatch = path.match(/^\/api\/trips\/([^/]+)\/export-csv$/);
    const invitesListMatch = path.match(/^\/api\/trips\/([^/]+)\/invites$/);
    const inviteMatch = path.match(/^\/api\/trips\/([^/]+)\/invites\/([^/]+)$/);

    if (exportCsvMatch && method === "GET") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await exportTripToCSV(auth.userId, exportCsvMatch[1]);
    } else if (importCsvMatch && method === "POST") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await importTripFromCSV(auth.userId, importCsvMatch[1], req);
    } else if (tripMatch && method === "DELETE") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await deleteTrip(auth.userId, tripMatch[1]);
    } else if (daysListMatch && method === "GET") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await getAllDays(auth.userId, daysListMatch[1]);
    } else if (daysListMatch && method === "POST") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      const body = await req.json();
      res = await createDay(auth.userId, daysListMatch[1], body);
    } else if (dayMatch && method === "DELETE") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await deleteDay(auth.userId, dayMatch[1], dayMatch[2]);
    } else if (itemsMatch && !itemsMatch[3] && method === "PUT") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      const body = await req.json();
      res = await reorderItems(auth.userId, itemsMatch[1], itemsMatch[2], body);
    } else if (itemsMatch && method === "POST") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      const body = await req.json();
      res = await createItem(auth.userId, itemsMatch[1], itemsMatch[2], body);
    } else if (itemsMatch && itemsMatch[3] && method === "PUT") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      const body = await req.json();
      res = await updateItem(
        auth.userId,
        itemsMatch[1],
        itemsMatch[2],
        itemsMatch[3],
        body,
      );
    } else if (itemsMatch && itemsMatch[3] && method === "DELETE") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await deleteItem(
        auth.userId,
        itemsMatch[1],
        itemsMatch[2],
        itemsMatch[3],
      );
    } else if (invitesListMatch && method === "GET") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await getTripInvites(auth.userId, invitesListMatch[1]);
    } else if (invitesListMatch && method === "POST") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      const body = await req.json();
      res = await createInvite(auth.userId, invitesListMatch[1], body);
    } else if (inviteMatch && method === "DELETE") {
      const auth = await verifyAuth(req);
      if (auth instanceof Response) return withCors(auth);
      res = await revokeInvite(auth.userId, inviteMatch[1], inviteMatch[2]);
    } else {
      res = Response.json({ error: "Not found" }, { status: 404 });
    }
  }

  return withCors(res);
}
