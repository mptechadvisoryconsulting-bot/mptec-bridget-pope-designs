import { describe, expect, it } from "vitest";
import { normalizeFixedServices, defaultWebsiteContent } from "@/lib/website/content";

describe("website content helpers", () => {
  it("keeps exactly six fixed services and preserves titles", () => {
    const normalized = normalizeFixedServices([
      {
        key: "weddings",
        title: "Should not rename",
        description: "Updated wedding copy",
        detail: "Detail",
        sortOrder: 2,
        visible: false,
      },
      {
        key: "extra",
        title: "Extra Service",
        description: "Should be dropped",
        detail: "Nope",
        sortOrder: 99,
        visible: true,
      },
    ]);

    expect(normalized).toHaveLength(6);
    expect(normalized.map((item) => item.key)).toEqual(defaultWebsiteContent.services.items.map((item) => item.key));
    expect(normalized[0].title).toBe("Weddings");
    expect(normalized[0].description).toBe("Updated wedding copy");
    expect(normalized[0].visible).toBe(false);
    expect(normalized.some((item) => item.key === "extra")).toBe(false);
  });
});
