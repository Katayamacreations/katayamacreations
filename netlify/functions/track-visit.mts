import type { Context, Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { siteVisits } from "../../db/schema.js";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";

  const geo = context.geo || {};
  const today = new Date().toISOString().slice(0, 10);

  context.waitUntil(
    db.insert(siteVisits).values({
      visitDate: today,
      path,
      country: geo.country?.name || "Unknown",
      countryCode: geo.country?.code || "",
      city: geo.city || "Unknown",
      latitude: geo.latitude != null ? String(geo.latitude) : null,
      longitude: geo.longitude != null ? String(geo.longitude) : null,
    })
  );

  const gif = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));
  return new Response(gif, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache",
    },
  });
};

export const config: Config = {
  path: "/api/track",
  method: "GET",
};
