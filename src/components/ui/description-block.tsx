import React from "react";

type DescriptionBlockProps = {
  show: boolean;
  description?: string;
  descriptionRef: React.RefObject<HTMLElement | null>;
};

export const DescriptionBlock = ({
  show,
  description,
  descriptionRef,
}: DescriptionBlockProps) => {
  return (
    <section
      id="description-container"
      ref={descriptionRef as React.RefObject<HTMLElement>}
      style={{ display: show ? undefined : "none" }}
      className="text-muted-foreground"
    >
      <p id="page-description" className="text-base">
        {description}
      </p>
    </section>
  );
};
