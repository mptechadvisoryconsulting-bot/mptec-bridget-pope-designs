export const navItems = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Reviews", href: "/reviews" },
  { label: "FAQs", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const services = [
  {
    title: "Weddings",
    description: "Elegant design for your most important day.",
    detail: "Ceremony styling, luxury reception design, tablescapes, floral moments, and vendor-ready timelines.",
  },
  {
    title: "Baby Showers",
    description: "Beautiful themes and memorable details.",
    detail: "Soft color palettes, balloon installations, dessert displays, custom signage, and guest flow planning.",
  },
  {
    title: "Birthdays",
    description: "Stylish celebrations for kids and adults.",
    detail: "Statement backdrops, themed tables, and celebration-ready room styling.",
  },
  {
    title: "Corporate Events",
    description: "Professional, polished, perfectly executed.",
    detail: "Brand-forward event styling, stage decor, florals, and onsite coordination.",
  },
  {
    title: "Luxury Balloons",
    description: "Organic installations with premium finishes.",
    detail: "Balloon garlands, arches, photo walls, entry statements, and branded installs.",
  },
  {
    title: "Full Planning",
    description: "One coordinated experience from idea to event day.",
    detail: "Budget, schedule, vendors, direction, production, and event-day management.",
  },
];

export const galleryItems = [
  { title: "Blush Birthday", category: "Birthdays", image: "/images/gallery-blush.png" },
  { title: "Golden Wedding", category: "Weddings", image: "/images/gallery-gold.png" },
  { title: "Oh Baby Shower", category: "Showers", image: "/images/gallery-baby.png" },
  { title: "Corporate Gala", category: "Corporate", image: "/images/gallery-table.png" },
];

export const testimonials = [
  {
    name: "Wedding Client",
    event: "Luxury Wedding Design",
    quote:
      "Bridget Pope Designs made every room feel intentional. The process was clear, polished, and honestly calming.",
  },
  {
    name: "Shower Client",
    event: "Baby Shower Design",
    quote:
      "Our guests kept asking who designed the shower. The backdrop, florals, and table styling were flawless.",
  },
  {
    name: "Celebration Client",
    event: "Milestone Birthday",
    quote:
      "The team translated my inspiration board into something more beautiful than I imagined.",
  },
];

export const faqs = [
  {
    question: "How early should I inquire?",
    answer: "For weddings and large events, inquire 6 to 12 months out. Smaller installations can often be booked 4 to 8 weeks ahead.",
  },
  {
    question: "Do you offer rentals?",
    answer: "Select event pieces may be included inside a full design plan when they support the overall event concept.",
  },
  {
    question: "Where are proposals, contracts, and payments handled?",
    answer: "Invoices, proposals, and contracts live in your client portal alongside project updates, designs, files, messages, and event details.",
  },
  {
    question: "Do you travel?",
    answer: "The primary service area is Murfreesboro, TN and surrounding areas, with travel available by quote.",
  },
];

export const adminStats: Array<{ label: string; value: string; note: string }> = [];
export const bookings: Array<{ client: string; eventType: string; eventDate: string; status: string; payment: string; total: string }> = [];
export const pipeline: Array<{ label: string; value: number; color: string }> = [];
export const upcomingEvents: Array<{ name: string; date: string; location: string }> = [];
export const tasks: string[] = [];
export const clientProgress: Array<{ label: string; status: string }> = [];
export const timelineItems: Array<{ date: string; title: string; status: string }> = [];
export const checklistItems: Array<{ label: string; done: boolean }> = [];
export const proposalItems: Array<{ name: string; qty: number; price: number }> = [];
