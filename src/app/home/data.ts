// ============================================================
// UXLLY — /home page content data
// ============================================================

export interface NavItem {
  label: string;
  icon: string; // key resolved to an inline SVG in Sidebar's ICONS map
  href: string;
  active?: boolean;
  hasSubmenu?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface IconAction {
  icon: string; // key resolved to an inline SVG in Sidebar's ICONS map
  label: string;
}

export interface FeatureChip {
  label: string;
  logo?: string;
  icon?: string;
}

export interface GalleryApp {
  slug: string;
  title: string;
  description: string;
  image: string;
  video: string;
  href: string;
}

/** Nav hrefs point at the real top-level routes (no /dashboard prefix — that folder is a route group). */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "AI Studio",
    items: [
      { label: "Dashboard", icon: "dashboard", href: "/dashboard" },
      { label: "Templates", icon: "templates", href: "/templates" },
      { label: "Free tools", icon: "free_tools", href: "/free-tools" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "My projects", icon: "projects", href: "/projects" },
      { label: "Calendar", icon: "calendar", href: "/calendar" },
      { label: "Pricing", icon: "pricing", href: "/billing?tab=plans" },
      { label: "Settings", icon: "settings", href: "/settings" },
    ],
  },
];

export const ICON_ACTIONS: IconAction[] = [
  { icon: "notifications", label: "Notifications" },
];

/** Feature chips insert their text into the prompt — not tabs, no page nav. */
export const FEATURE_CHIPS: FeatureChip[] = [
  { label: "A launch announcement carousel", icon: "spark" },
  { label: "Instagram story for a sale", icon: "image" },
  { label: "Product feature graphic", icon: "image_edit_auto" },
  { label: "A quote card for social", icon: "chat_spark" },
  { label: "Weekly stats recap post", icon: "network_intelligence" },
  { label: "A testimonial highlight", icon: "voice_chat" },
  { label: "Behind-the-scenes post", icon: "movie" },
  { label: "A comparison/before-after post", icon: "aspect_ratio" },
];

export const GALLERY_APPS: GalleryApp[] = [
  {
    slug: "example-1",
    title: "Product launch carousel",
    description: "A 6-slide carousel announcing a new feature, built from a single prompt.",
    image: "/images/apps/example-1.png",
    video: "/videos/apps/example-1.mp4",
    href: "/ai",
  },
  {
    slug: "example-2",
    title: "Instagram story pack",
    description: "A set of on-brand story graphics generated from your reference board.",
    image: "/images/apps/example-2.png",
    video: "/videos/apps/example-2.mp4",
    href: "/ai",
  },
  {
    slug: "example-3",
    title: "Weekly stats recap",
    description: "A clean data-forward post summarizing the week's numbers.",
    image: "/images/apps/example-3.png",
    video: "/videos/apps/example-3.mp4",
    href: "/ai",
  },
  {
    slug: "example-4",
    title: "Testimonial highlight",
    description: "A quote-style post pulled from a customer testimonial.",
    image: "/images/apps/example-4.png",
    video: "/videos/apps/example-4.mp4",
    href: "/ai",
  },
];