import { unstable_noStore as noStore } from "next/cache";
import { faqs as defaultFaqs, services as defaultServices } from "@/lib/data";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type WebsiteSectionKey =
  | "hero"
  | "services"
  | "homepage_gallery"
  | "featured_designs"
  | "about"
  | "faq"
  | "contact"
  | "testimonials"
  | "footer"
  | "social";

export type HeroContent = {
  eyebrow: string;
  heading: string;
  scriptHeading: string;
  subheading: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  secondaryButtonText: string;
  secondaryButtonHref: string;
  backgroundImage: string;
};

export type ServiceItem = {
  key: string;
  title: string;
  description: string;
  detail: string;
  image?: string | null;
  sortOrder: number;
  visible: boolean;
};

export type ServicesContent = {
  eyebrow: string;
  heading: string;
  items: ServiceItem[];
};

export type AboutContent = {
  eyebrow: string;
  heading: string;
  biography: string;
  portraitImage: string;
  /** Closing line shown under the Meet Bridget biography (and About page). */
  signature?: string | null;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
};

export type ContactContent = {
  businessName: string;
  phone: string;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  hours?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  pinterest?: string | null;
};

export type TestimonialItem = {
  id: string;
  name: string;
  event: string;
  quote: string;
  visible: boolean;
  sortOrder: number;
};

export type TestimonialsContent = {
  eyebrow: string;
  heading: string;
  /** When false, /reviews and any homepage testimonials block stay hidden. */
  enabled: boolean;
  /** When true (and enabled), homepage may render the testimonials section. */
  showOnHomepage: boolean;
  items: TestimonialItem[];
};

export type FooterContent = {
  ctaHeading: string;
  ctaBody: string;
  ctaButtonText: string;
  ctaButtonHref: string;
  copyright: string;
  quickLinks: Array<{ label: string; href: string }>;
};

export type HomepageGalleryContent = {
  eyebrow: string;
  heading: string;
};

export type FeaturedDesignsContent = {
  eyebrow: string;
  heading: string;
  enabled: boolean;
};

export type SocialContent = {
  instagram?: string | null;
  facebook?: string | null;
  pinterest?: string | null;
  email?: string | null;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  visible: boolean;
  sortOrder: number;
};

export type FaqContent = {
  eyebrow: string;
  heading: string;
  items: FaqItem[];
};

const FIXED_SERVICE_KEYS = ["weddings", "baby_showers", "birthdays", "corporate", "balloons", "full_planning"] as const;

export const defaultWebsiteContent = {
  hero: {
    eyebrow: "Luxury event design and planning",
    heading: "Designed Beautifully.",
    scriptHeading: "Celebrated Forever.",
    subheading:
      "From unforgettable weddings to milestone celebrations and corporate events, we create stunning experiences with elegant details and flawless execution.",
    primaryButtonText: "Submit a Questionnaire",
    primaryButtonHref: "/inquire",
    secondaryButtonText: "Explore Services",
    secondaryButtonHref: "/services",
    backgroundImage: "/images/event-hero.png",
  } satisfies HeroContent,
  services: {
    eyebrow: "Our services",
    heading: "Everything You Need for a Flawless Event",
    items: defaultServices.map((service, index) => ({
      key: FIXED_SERVICE_KEYS[index] ?? `service_${index}`,
      title: service.title,
      description: service.description,
      detail: service.detail,
      image: null,
      sortOrder: index,
      visible: true,
    })),
  } satisfies ServicesContent,
  homepage_gallery: {
    eyebrow: "Designs We Are Now Presenting",
    heading: "Beautiful Moments, Perfectly Designed",
  } satisfies HomepageGalleryContent,
  featured_designs: {
    eyebrow: "Featured designs",
    heading: "Designs We Are Now Presenting",
    enabled: true,
  } satisfies FeaturedDesignsContent,
  about: {
    eyebrow: "Meet the Designer",
    heading: "Meet Bridget Pope",
    biography:
      "For as long as I can remember, I've had a passion for creating beautiful spaces and unforgettable celebrations. What began as a love for decorating has grown into a lifelong commitment to designing elegant weddings and special events that reflect each client's unique vision.\n\nOver the years, I've embraced both timeless and modern event design, combining creativity, attention to detail, and thoughtful planning to create meaningful experiences. As a Master of Business Administration graduate, a Certified Event Designer & Draping Specialist, and a breast cancer survivor, I approach every celebration with gratitude, faith, and a genuine love for serving others.\n\nWhether you're planning a wedding, baby shower, birthday celebration, or corporate event, my goal is simple—to bring your vision to life with beauty, elegance, and excellence.",
    portraitImage: "/images/bridget-pope-portrait.jpg",
    signature: "Let's create something beautiful together.",
    primaryButtonText: "Submit Event Questionnaire",
    primaryButtonHref: "/inquire",
    secondaryButtonText: "Learn More",
    secondaryButtonHref: "/about",
  } satisfies AboutContent,
  faq: {
    eyebrow: "Questions",
    heading: "Planning Details",
    items: defaultFaqs.map((faq, index) => ({
      id: `faq-${index + 1}`,
      question: faq.question,
      answer: faq.answer,
      visible: true,
      sortOrder: index,
    })),
  } satisfies FaqContent,
  contact: {
    businessName: "Bridget Pope Designs",
    phone: "(629) 295-4210",
    email: null,
    website: "https://bridgetpopedesigns.com",
    address: null,
    hours: null,
    instagram: null,
    facebook: null,
    pinterest: null,
  } satisfies ContactContent,
  testimonials: {
    eyebrow: "Client reviews",
    heading: "What Clients Are Saying",
    enabled: false,
    showOnHomepage: false,
    // No placeholder/fake reviews — add real ones in Website Content when ready.
    items: [],
  } satisfies TestimonialsContent,
  footer: {
    ctaHeading: "Let's Design Your Next Unforgettable Event",
    ctaBody: "Consultations are by appointment. We would love to bring your vision to life.",
    ctaButtonText: "Submit a Questionnaire",
    ctaButtonHref: "/inquire",
    copyright: "Bridget Pope Designs. All rights reserved.",
    quickLinks: [
      { label: "Services", href: "/services" },
      { label: "Gallery", href: "/gallery" },
      { label: "Contact", href: "/contact" },
    ],
  } satisfies FooterContent,
  social: {
    instagram: null,
    facebook: null,
    pinterest: null,
    email: null,
  } satisfies SocialContent,
} as const;

export type WebsiteContentMap = {
  hero: HeroContent;
  services: ServicesContent;
  homepage_gallery: HomepageGalleryContent;
  featured_designs: FeaturedDesignsContent;
  about: AboutContent;
  faq: FaqContent;
  contact: ContactContent;
  testimonials: TestimonialsContent;
  footer: FooterContent;
  social: SocialContent;
};

function mergeSection<K extends WebsiteSectionKey>(key: K, raw: unknown): WebsiteContentMap[K] {
  const defaults = defaultWebsiteContent[key] as WebsiteContentMap[K];
  if (!raw || typeof raw !== "object") return defaults;
  const merged = { ...defaults, ...(raw as object) } as WebsiteContentMap[K];
  if (key === "faq") {
    const faq = merged as FaqContent;
    const items = Array.isArray(faq.items) && faq.items.length ? faq.items : (defaults as FaqContent).items;
    return { ...faq, items } as WebsiteContentMap[K];
  }
  if (key === "services") {
    const services = merged as ServicesContent;
    return {
      ...services,
      items: normalizeFixedServices(services.items),
    } as WebsiteContentMap[K];
  }
  return merged;
}

export async function getWebsiteSection<K extends WebsiteSectionKey>(key: K): Promise<WebsiteContentMap[K]> {
  noStore();
  if (!hasSupabaseAdminEnv()) {
    return defaultWebsiteContent[key] as WebsiteContentMap[K];
  }

  const { data } = await createAdminClient().from("website_content").select("content").eq("section_key", key).maybeSingle();

  return mergeSection(key, data?.content);
}

export async function getWebsiteContent(): Promise<WebsiteContentMap> {
  noStore();
  if (!hasSupabaseAdminEnv()) {
    return { ...defaultWebsiteContent } as WebsiteContentMap;
  }

  const { data } = await createAdminClient().from("website_content").select("section_key,content");
  const map = { ...defaultWebsiteContent } as WebsiteContentMap;

  for (const row of data ?? []) {
    const key = row.section_key as WebsiteSectionKey;
    if (key in defaultWebsiteContent) {
      map[key] = mergeSection(key, row.content) as never;
    }
  }

  return map;
}

export async function upsertWebsiteSection(
  key: WebsiteSectionKey,
  content: Record<string, unknown>,
  updatedBy?: string | null,
) {
  const supabase = createAdminClient();
  const payload = {
    section_key: key,
    content,
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("website_content")
    .upsert(payload, { onConflict: "section_key" })
    .select("section_key,content,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export function normalizeFixedServices(items: ServiceItem[] | undefined): ServiceItem[] {
  const byKey = new Map((items ?? []).map((item) => [item.key, item]));
  return defaultWebsiteContent.services.items.map((fallback, index) => {
    const existing = byKey.get(fallback.key);
    return {
      ...fallback,
      ...(existing ?? {}),
      key: fallback.key,
      title: fallback.title,
      sortOrder: existing?.sortOrder ?? index,
      visible: existing?.visible ?? true,
    };
  });
}
