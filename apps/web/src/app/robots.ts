import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/explore", "/in/", "/people/", "/join"],
      disallow: ["/api/", "/admin/", "/join/status", "/embed/"]
    },
    host: "https://bigtreebjj.com"
  };
}
