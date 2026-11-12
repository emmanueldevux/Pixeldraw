"use client";

import { useRef, useState } from "react";
import type { GalleryApp } from "../data";

export function GalleryCard({ app }: { app: GalleryApp }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleEnter() {
    setHovered(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        /* autoplay policy can reject — poster/placeholder stays visible */
      });
    });
  }

  return (
    <a
      href={app.href}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
      className="home-gallery-card"
    >
      <div className="home-gallery-thumb-wrap">
        {hovered ? (
          <video
            ref={videoRef}
            src={app.video}
            poster={app.image}
            loop
            muted
            playsInline
            className="home-gallery-thumb"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.image} alt={app.title} className="home-gallery-thumb" />
        )}
      </div>

      <div className="home-gallery-body">
        <div className="home-gallery-row">
          <h3 className="home-gallery-card-title">{app.title}</h3>
          <span className="home-gallery-remix">Try it</span>
        </div>
        <p className="home-gallery-desc">{app.description}</p>
      </div>
    </a>
  );
}