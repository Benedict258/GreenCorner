"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return (
      <div className="gallery">
        <div className="gallery__main" role="img" aria-label={`${title} (no photo yet)`}><Icon name="chip" className="gallery__glyph" /></div>
      </div>
    );
  }
  const src = images[Math.min(i, images.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery__main">
        <img src={`${src}?w=800`} alt={`${title}${images.length > 1 ? `, photo ${i + 1} of ${images.length}` : ""}`} width={800} height={800} />
        <a className="gallery__zoom" href={`${src}?w=1600`} target="_blank" rel="noreferrer"><Icon name="zoom" />Zoom</a>
      </div>
      {images.length > 1 && (
        <div className="gallery__thumbs">
          {images.map((im, n) => (
            <button key={im} className={`gallery__thumb${n === i ? " gallery__thumb--on" : ""}`} type="button" aria-label={`Photo ${n + 1} of ${images.length}${n === i ? ", selected" : ""}`} aria-pressed={n === i} onClick={() => setI(n)}>
              <img src={`${im}?w=160`} alt="" loading="lazy" width={80} height={80} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
