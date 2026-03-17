import { ObjectId } from 'mongodb';
import { SignJWT } from 'jose';
import { getDB } from '../db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function register(body: unknown): Promise<Response> {
  const { email, password } = body as { email: string; password: string };
  if (!email || !password) {
    return Response.json({ error: 'email and password required' }, { status: 400 });
  }

  const db = getDB();
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return Response.json({ error: 'Email already registered' }, { status: 409 });
  }

  const passwordHash = await Bun.password.hash(password);
  const result = await db.collection('users').insertOne({
    email,
    passwordHash,
    createdAt: new Date(),
  });

  const userId = result.insertedId.toString();

  // Link any pending invites sent to this email before registration
  await db.collection('trip_invites').updateMany(
    { email, status: 'pending', userId: null },
    { $set: { userId: result.insertedId } }
  );

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  return Response.json({ token, user: { id: userId, email } }, { status: 201 });
}

export async function login(body: unknown): Promise<Response> {
  const { email, password } = body as { email: string; password: string };
  if (!email || !password) {
    return Response.json({ error: 'email and password required' }, { status: 400 });
  }

  const db = getDB();
  const user = await db.collection('users').findOne({ email });
  if (!user) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await Bun.password.verify(password, user.passwordHash as string);
  if (!valid) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const userId = (user._id as ObjectId).toString();
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  return Response.json({ token, user: { id: userId, email } });
}
