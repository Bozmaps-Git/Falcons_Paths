import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Falcon's Paths · MTB Marathon · Bajina Bašta",
  description:
    "Interactive web GIS for the Falcon's Paths MTB Marathon (Putevi Sokola) — explore the Velika Staza and Mala Staza in 2D and 3D, with live elevation profiles, checkpoints, and OpenStreetMap points of interest along Mount Tara and the Drina valley.",
  keywords: ["MTB", "mountain bike", "marathon", "Serbia", "Bajina Bašta", "Mount Tara", "Putevi Sokola", "Falcon's Paths", "GPX", "Web GIS"],
  authors: [{ name: "Bozmaps", url: "https://bozmaps.vercel.app/" }],
  openGraph: {
    title: "Falcon's Paths · MTB Marathon",
    description: "Two routes. Mount Tara. The Drina below. Explore the 10th Falcon's Paths marathon in 2D & 3D.",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Falcon's Paths · MTB Marathon",
    description: "Two routes. Mount Tara. The Drina below.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-forest-950">
      <body className="grain min-h-screen bg-forest-950 text-paper antialiased">{children}</body>
    </html>
  );
}
