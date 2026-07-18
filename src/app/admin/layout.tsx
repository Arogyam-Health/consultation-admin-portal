import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Portal — The Obesity Killer',
  description: 'Scheduling and Booking Management',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
