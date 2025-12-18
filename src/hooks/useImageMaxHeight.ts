import { useLayoutEffect, useRef, useState } from "react";
import { type ResolvedImage } from "../imageResolver";

type Args = {
  showImage: boolean;
  showDescription: boolean;
  showFooter: boolean;
  resolvedImage: ResolvedImage | null;
};

export const useImageMaxHeight = ({
  showImage,
  showDescription,
  showFooter,
  resolvedImage,
}: Args) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imageContainerRef = useRef<HTMLElement | null>(null);
  const descriptionRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const [imageMaxHeightPx, setImageMaxHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const container = imageContainerRef.current;
      const footer = footerRef.current;
      const description = descriptionRef.current;
      const root = rootRef.current;
      if (!container || !root) return;
      const viewportHeight = window.innerHeight;
      const containerTop = container.getBoundingClientRect().top;
      const descriptionHeight =
        description && description.style.display !== "none"
          ? (() => {
              const rect = description.getBoundingClientRect();
              return rect.top > containerTop ? rect.height : 0;
            })()
          : 0;
      const footerHeight =
        footer && footer.style.display !== "none"
          ? (() => {
              const rect = footer.getBoundingClientRect();
              return rect.top > containerTop ? rect.height : 0;
            })()
          : 0;
      const paddingBottom = Number.parseFloat(
        getComputedStyle(root).paddingBottom || "0",
      );
      const buffer = 24; // small gap to avoid accidental overflow
      const available =
        viewportHeight -
        containerTop -
        descriptionHeight -
        footerHeight -
        paddingBottom -
        buffer;
      if (available > 0) {
        setImageMaxHeightPx(Math.max(200, available));
      }
    };
    measure();
    const onResize = () => requestAnimationFrame(measure);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [showImage, showDescription, showFooter, resolvedImage]);

  const handleImageLoad = () => {
    // Recalculate after the image paints to account for any layout shifts.
    requestAnimationFrame(() => {
      const event = new Event("resize");
      window.dispatchEvent(event);
    });
  };

  return {
    rootRef,
    imageContainerRef,
    descriptionRef,
    footerRef,
    imageMaxHeightPx,
    handleImageLoad,
  };
};
