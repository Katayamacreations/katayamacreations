import type { Config } from "@netlify/functions";
import { requireAdmin } from "./_admin.mjs";
import { db } from "../../db/index.js";
import { siteVisits } from "../../db/schema.js";
import { sql, desc } from "drizzle-orm";

export default async (req: Request) => {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10) || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const dailyCounts = await db
    .select({
      date: siteVisits.visitDate,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(siteVisits)
    .where(sql`${siteVisits.visitDate} >= ${sinceStr}`)
    .groupBy(siteVisits.visitDate)
    .orderBy(siteVisits.visitDate);

  const locationCounts = await db
    .select({
      country: siteVisits.country,
      countryCode: siteVisits.countryCode,
      city: siteVisits.city,
      latitude: sql<number>`avg(${siteVisits.latitude}::numeric)`.as("latitude"),
      longitude: sql<number>`avg(${siteVisits.longitude}::numeric)`.as("longitude"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(siteVisits)
    .where(sql`${siteVisits.visitDate} >= ${sinceStr}`)
    .groupBy(siteVisits.country, siteVisits.countryCode, siteVisits.city)
    .orderBy(desc(sql`count(*)`));

  const totalVisits = dailyCounts.reduce((sum, d) => sum + Number(d.count), 0);

  return Response.json({
    days,
    totalVisits,
    daily: dailyCounts.map((d) => ({
      date: d.date,
      count: Number(d.count),
    })),
    locations: locationCounts.map((l) => ({
      country: l.country,
      countryCode: l.countryCode,
      city: l.city,
      lat: l.latitude != null ? Number(l.latitude) : null,
      lng: l.longitude != null ? Number(l.longitude) : null,
      count: Number(l.count),
    })),
  });
};

export const config: Config = {
  path: "/api/admin/site-visits",
};
