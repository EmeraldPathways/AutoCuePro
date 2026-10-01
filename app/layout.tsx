import "./globals.css";

export const metadata = {
  title: "CueFlow — Autocue",
  description: "A focused teleprompter for confident delivery.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
