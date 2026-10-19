import type { Metadata } from 'next';
import './styles.css';
import MetaPixel from './meta-pixel';

export const metadata: Metadata = {
  title: 'Jfit — Make space for stronger',
  description: 'Training that fits real life. Explore Jfit workouts, programmes and equipment.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}<MetaPixel /></body></html>;
}
