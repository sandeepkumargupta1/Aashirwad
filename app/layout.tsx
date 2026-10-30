import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "Aashirwad — Grow with confidence",
    description: "Understand your soil, explore crops and plan water with explainable agricultural data.",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en">
      <body className="antialiased">{children}</body>
    </html>);
}
