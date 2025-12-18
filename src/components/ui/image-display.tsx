import React from "react";

type ImageDisplayProps = {
  showImage: boolean;
  imageUrl: string;
  imageAlt?: string;
  imageError: string;
  imageContainerRef: React.RefObject<HTMLElement | null>;
  imageMaxHeightPx: number | null;
  handleImageLoad: () => void;
};

export const ImageDisplay = ({
  showImage,
  imageUrl,
  imageAlt,
  imageError,
  imageContainerRef,
  imageMaxHeightPx,
  handleImageLoad,
}: ImageDisplayProps) => {
  return (
    <section
      id="image-container"
      ref={imageContainerRef as React.RefObject<HTMLElement>}
      className="flex flex-1 flex-col items-center justify-center"
    >
      {showImage ? (
        <img
          id="image"
          src={imageUrl}
          alt={imageAlt}
          className="emoji-image"
          style={{
            maxWidth: "min(90vw, 42rem)",
            maxHeight: imageMaxHeightPx
              ? `${Math.min(imageMaxHeightPx, 640)}px`
              : "min(60vh, 36rem)",
            width: "100%",
            height: "auto",
            objectFit: "contain",
          }}
          onLoad={handleImageLoad}
        />
      ) : null}
      {imageError ? (
        <div className="mt-2 text-xs text-destructive">{imageError}</div>
      ) : null}
    </section>
  );
};
