export const metadata = {
  title: 'Services Control Panel',
  description: 'Configure and deploy services to Docker hosts and K3s clusters.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/panel.css"/><link rel="stylesheet" href="/panel-overrides.css"/></head>
      <body>{children}</body>
    </html>
  );
}
