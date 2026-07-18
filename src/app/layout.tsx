import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Obesity Killer",
  description: "Personalized Weight Loss Assessment & Consultation Booking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
