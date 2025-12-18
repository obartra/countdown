export const formatRelativeExpiry = (expiresAt: number, now = Date.now()) => {
  const msRemaining = expiresAt - now;
  const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

  if (days < 0) return "Expired";
  if (days < 1) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  if (days < 30) return `Expires in ${days} days`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Expires in ${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  return `Expires in ${years} year${years === 1 ? "" : "s"}`;
};
