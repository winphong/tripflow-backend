export async function resolveUrl(url: string): Promise<Response> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return Response.json({ url: res.url });
  } catch {
    return Response.json({ error: "Could not resolve URL" }, { status: 400 });
  }
}

export async function resolveAmapUrl(target: string): Promise<Response> {
  if (!/^https:\/\/surl\.amap\.com\//.test(target)) {
    return Response.json(
      { error: "url must be a surl.amap.com link" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(target, { redirect: "manual" });
    const location = response.headers.get("location");
    if (!location) {
      return Response.json(
        { error: "AMap link did not redirect" },
        { status: 400 },
      );
    }

    // URLSearchParams automatically decodes %2C and Chinese characters.
    const amapUrl = new URL(location);
    const rawPlace = amapUrl.searchParams.get("p");
    if (!rawPlace) {
      return Response.json(
        { error: 'Missing "p" query parameter' },
        { status: 400 },
      );
    }

    const parts = rawPlace.split(",");
    if (parts.length < 6) {
      return Response.json(
        { error: `Unexpected AMap place format: ${rawPlace}` },
        { status: 400 },
      );
    }

    const [poiId, latitudeText, longitudeText, name, address, postcode] = parts;
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    return Response.json({
      poiId,
      latitude,
      longitude,
      name,
      address,
      postcode,
    });
  } catch {
    return Response.json(
      { error: "Could not resolve AMap URL" },
      { status: 400 },
    );
  }
}
