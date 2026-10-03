export const rupee = (n: number, decimals = false) =>
  '₹' +
  n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

export const num = (n: number) => n.toLocaleString('en-IN');

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning ☀️';
  if (h < 17) return 'Good Afternoon 🌤️';
  return 'Good Evening 🌙';
};

export const shortTitle = (t: string) =>
  t
    .replace(' - Made From Curd', '')
    .replace(' - Natural Sun Dried', '')
    .replace('Stone Pressed ', '')
    .replace('High Protein Oats - ', 'Oats · ')
    .trim();

export const timeAgo = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
