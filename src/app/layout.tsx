import './globals.css';
import React from 'react';

export const metadata = {
  title: 'AL-MADINA CONSTRUCTION COMPANY — Logistics & Material ERP',
  description: 'AL-MADINA CONSTRUCTION COMPANY ERP by Roonjha Developers - 03152914836',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
