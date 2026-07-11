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
    detail: "Statement backdrops, curated rentals, themed tables, cake displays, and celebration-ready room styling.",
  },
  {
    title: "Corporate Events",
    description: "Professional, polished, perfectly executed.",
    detail: "Brand-forward event styling, lounge vignettes, stage decor, florals, and onsite coordination.",
  },
  {
    title: "Luxury Balloons",
    description: "Organic installations with premium finishes.",
    detail: "Balloon garlands, arches, ceiling moments, photo walls, entry statements, and branded installs.",
  },
  {
    title: "Full Planning",
    description: "One coordinated experience from idea to event day.",
    detail: "Budget, schedule, vendors, creative direction, production, payment milestones, and event-day management.",
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
    name: "Ashley Johnson",
    event: "Elegant Garden Wedding",
    quote:
      "Bridget Pope Designs made every room feel intentional. The process was clear, polished, and honestly calming.",
  },
  {
    name: "Brittany Smith",
    event: "Pink and Gold Baby Shower",
    quote:
      "Our guests kept asking who designed the shower. The backdrop, florals, and table styling were flawless.",
  },
  {
    name: "Melissa Brown",
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
    answer: "Yes. Rental inventory can be bundled with design, setup, breakdown, and delivery.",
  },
  {
    question: "Can I approve a proposal online?",
    answer: "Yes. Clients can review proposals, approve designs, sign contracts, and pay invoices from the portal.",
  },
  {
    question: "Do you travel?",
    answer: "The primary service area is Murfreesboro, TN and surrounding areas, with travel available by quote.",
  },
];

export const adminStats = [
  { label: "Total Bookings", value: "18", note: "+12% from last month" },
  { label: "Monthly Revenue", value: "$28,450", note: "+18% from last month" },
  { label: "Pending Payments", value: "$9,250", note: "6 payments pending" },
  { label: "New Leads", value: "24", note: "+15% from last month" },
];

export const bookings = [
  {
    client: "Ashley Johnson",
    eventType: "Wedding",
    eventDate: "2025-06-14",
    status: "In Design",
    payment: "50% Paid",
    total: "$4,900",
  },
  {
    client: "Brittany Smith",
    eventType: "Baby Shower",
    eventDate: "2025-05-18",
    status: "Proposal Sent",
    payment: "Pending",
    total: "$2,150",
  },
  {
    client: "Melissa Brown",
    eventType: "Birthday",
    eventDate: "2025-05-25",
    status: "Booked",
    payment: "Paid",
    total: "$1,850",
  },
  {
    client: "Acme Corp",
    eventType: "Corporate Event",
    eventDate: "2025-05-24",
    status: "In Design",
    payment: "30% Paid",
    total: "$5,750",
  },
];

export const pipeline = [
  { label: "New Lead", value: 4, color: "#b55e73" },
  { label: "Consultation", value: 3, color: "#d6a85d" },
  { label: "Proposal Sent", value: 5, color: "#d78ca0" },
  { label: "Booked", value: 4, color: "#1b1b1b" },
  { label: "In Design", value: 2, color: "#f0d7db" },
];

export const upcomingEvents = [
  { name: "Elegant Garden Wedding", date: "2025-06-14", location: "Murfreesboro, TN" },
  { name: "Baby Shower - Pink & Gold", date: "2025-05-18", location: "Murfreesboro, TN" },
  { name: "Corporate Gala", date: "2025-05-24", location: "Nashville, TN" },
];

export const tasks = [
  "Follow up with new leads (3)",
  "Send proposal to Brittany S.",
  "Design review - Ashley J.",
  "Confirm inventory for May 18",
  "Team meeting at 2:00 PM",
];

export const clientProgress = [
  { label: "Consultation", status: "Complete" },
  { label: "Proposal", status: "Sent" },
  { label: "Deposit", status: "Paid" },
  { label: "In Design", status: "In Progress" },
  { label: "Final Payment", status: "Pending" },
  { label: "Event Day", status: "Upcoming" },
];

export const timelineItems = [
  { date: "May 10, 2025", title: "Final Design Review", status: "Upcoming" },
  { date: "May 20, 2025", title: "Balance Due", status: "Payment" },
  { date: "June 10, 2025", title: "Inventory Pull", status: "Production" },
  { date: "June 14, 2025", title: "Event Install", status: "Event Day" },
];

export const checklistItems = [
  { label: "Consultation completed", done: true },
  { label: "Proposal reviewed", done: true },
  { label: "Contract signed", done: true },
  { label: "Mood board approved", done: false },
  { label: "Final payment", done: false },
  { label: "Event day install", done: false },
];

export const proposalItems = [
  { name: "Design direction and planning", qty: 1, price: 950 },
  { name: "Ceremony and reception styling", qty: 1, price: 1800 },
  { name: "Luxury balloon and floral installation", qty: 1, price: 1250 },
  { name: "Delivery, setup, and breakdown", qty: 1, price: 900 },
];
