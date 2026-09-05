import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Norani Kanta Trip & Material ERP',
  description: 'Transport & Material Supply ERP by Roonjha Developer',
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
