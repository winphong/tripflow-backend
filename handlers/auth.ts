import { ObjectId } from "mongodb";
import { SignJWT, jwtVerify } from "jose";
import { getDB } from "../db.js";
import { verifyAuth } from "../middleware/auth.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function register(body: unknown): Promise<Response> {
  const { email, password } = body as { email: string; password: string };
  if (!email || !password) {
    return Response.json(
      { error: "email and password required" },
      { status: 400 },
    );
  }

  const db = getDB();
  const existing = await db.collection("users").findOne({ email });
  if (existing) {
    return Response.json(
      { error: "Email already registered" },
      { status: 409 },
    );
  }

  const passwordHash = await Bun.password.hash(password);
  const result = await db.collection("users").insertOne({
    email,
    passwordHash,
    createdAt: new Date(),
  });

  const userId = result.insertedId.toString();

  // Link any pending invites sent to this email before registration
  await db
    .collection("trip_invites")
    .updateMany(
      { email, status: "pending", userId: null },
      { $set: { userId: result.insertedId } },
    );

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  return Response.json({ token, user: { id: userId, email, isAdmin: false } }, { status: 201 });
}

export async function promoteToAdmin(
  req: Request,
  body: unknown,
): Promise<Response> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "Admin not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${adminSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = body as { email: string };
  if (!email) {
    return Response.json({ error: "email required" }, { status: 400 });
  }

  const db = getDB();
  const result = await db
    .collection("users")
    .updateOne({ email }, { $set: { isAdmin: true } });

  if (result.matchedCount === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

export async function generateResetLink(
  req: Request,
  body: unknown,
): Promise<Response> {
  const auth = await verifyAuth(req);
  if (auth instanceof Response) return auth;

  const db = getDB();
  const requester = await db
    .collection("users")
    .findOne({ _id: new ObjectId(auth.userId) });

  if (!requester?.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = body as { email: string };
  if (!email) {
    return Response.json({ error: "email required" }, { status: 400 });
  }

  const user = await db.collection("users").findOne({ email });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const userId = (user._id as ObjectId).toString();
  const token = await new SignJWT({ sub: userId, purpose: "password-reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  return Response.json({ token, resetUrl });
}

export async function resetPassword(body: unknown): Promise<Response> {
  const { token, newPassword } = body as { token: string; newPassword: string };
  if (!token || !newPassword) {
    return Response.json(
      { error: "token and newPassword required" },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== "password-reset")
      throw new Error("invalid purpose");
    userId = payload.sub as string;
  } catch {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  const db = getDB();
  const passwordHash = await Bun.password.hash(newPassword);
  const result = await db
    .collection("users")
    .updateOne({ _id: new ObjectId(userId) }, { $set: { passwordHash } });

  if (result.matchedCount === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

export async function login(body: unknown): Promise<Response> {
  const { email, password } = body as { email: string; password: string };
  if (!email || !password) {
    return Response.json(
      { error: "email and password required" },
      { status: 400 },
    );
  }

  const db = getDB();
  const user = await db.collection("users").findOne({ email });
  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await Bun.password.verify(
    password,
    user.passwordHash as string,
  );
  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const userId = (user._id as ObjectId).toString();
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  return Response.json({ token, user: { id: userId, email, isAdmin: !!user.isAdmin } });
}
