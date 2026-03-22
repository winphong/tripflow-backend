export async function resolveUrl(url: string): Promise<Response> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return Response.json({ url: res.url });
  } catch {
    return Response.json({ error: 'Could not resolve URL' }, { status: 400 });
  }
}
