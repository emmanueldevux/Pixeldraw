import { GalleryCard } from "./GalleryCard";
import { MaterialSymbol } from "../icons";
import { GALLERY_APPS } from "../data";

export function GallerySection() {
  return (
    <section className="home-gallery-section">
      <div className="home-gallery-header">
        <h3 className="home-gallery-title home-heading-font">Discover and remix ideas</h3>
        <a href="/inspiration" className="home-gallery-browse-btn">
          Browse examples
          <MaterialSymbol name="arrow_forward" style={{ fontSize: 18 }} />
        </a>
      </div>

      <div className="home-gallery-grid">
        {GALLERY_APPS.map((app) => (
          <GalleryCard key={app.slug} app={app} />
        ))}
      </div>
    </section>
  );
}