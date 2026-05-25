import type { Config } from "@netlify/functions";
import { requireAdmin } from "./_admin.mjs";
import { db } from "../../db/index.js";
import { siteVisits } from "../../db/schema.js";
import { sql, desc } from "drizzle-orm";

export default async (req: Request) => {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "month";
  const dateParam = url.searchParams.get("date");
  const monthParam = url.searchParams.get("month");

  let startDate: string;
  let endDate: string;
  let responseMode: string;
  let responseDate: string | undefined;
  let responseMonth: string | undefined;

  if (mode === "day" && dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    startDate = dateParam;
    endDate = dateParam;
    responseMode = "day";
    responseDate = dateParam;
  } else {
    let year: number;
    let month: number;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split("-").map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    const mm = String(month).padStart(2, "0");
    startDate = `${year}-${mm}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    responseMode = "month";
    responseMonth = `${year}-${mm}`;
  }

  const dailyCounts = await db
    .select({
      date: siteVisits.visitDate,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(siteVisits)
    .where(
      sql`${siteVisits.visitDate} >= ${startDate} AND ${siteVisits.visitDate} <= ${endDate}`
    )
    .groupBy(siteVisits.visitDate)
    .orderBy(siteVisits.visitDate);

  const pageCounts = await db
    .select({
      path: siteVisits.path,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(siteVisits)
    .where(
      sql`${siteVisits.visitDate} >= ${startDate} AND ${siteVisits.visitDate} <= ${endDate}`
    )
    .groupBy(siteVisits.path)
    .orderBy(desc(sql`count(*)`));

  const locationCounts = await db
    .select({
      country: siteVisits.country,
      countryCode: siteVisits.countryCode,
      city: siteVisits.city,
      latitude: sql<number>`avg(${siteVisits.latitude}::numeric)`.as(
        "latitude"
      ),
      longitude: sql<number>`avg(${siteVisits.longitude}::numeric)`.as(
        "longitude"
      ),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(siteVisits)
    .where(
      sql`${siteVisits.visitDate} >= ${startDate} AND ${siteVisits.visitDate} <= ${endDate}`
    )
    .groupBy(siteVisits.country, siteVisits.countryCode, siteVisits.city)
    .orderBy(desc(sql`count(*)`));

  const totalVisits = dailyCounts.reduce(
    (sum, d) => sum + Number(d.count),
    0
  );

  return Response.json({
    mode: responseMode,
    ...(responseDate ? { date: responseDate } : {}),
    ...(responseMonth ? { month: responseMonth } : {}),
    totalVisits,
    daily: dailyCounts.map((d) => ({
      date: d.date,
      count: Number(d.count),
    })),
    pages: pageCounts.map((p) => ({
      path: p.path,
      count: Number(p.count),
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
