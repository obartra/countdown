import React from "react";

type LoadingScreenProps = {
  message: string;
};

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

export default LoadingScreen;
