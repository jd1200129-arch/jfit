import Link from 'next/link';
import AccountPortal from '../account-portal';

const known: Record<string, { title: string; lead: string; copy: string }> = {
  shop: { title: 'Move more at home.', lead: 'Equipment, thoughtfully chosen.', copy: 'Our equipment catalogue is being prepared. Product availability, delivery areas and warranty terms will appear here once configured.' },
  workouts: { title: 'Find your next good move.', lead: 'A library built for your day.', copy: 'Explore yoga, strength, HIIT, Pilates, cardio and recovery. Published sessions will appear here as the Jfit library is produced.' },
  programmes: { title: 'A little structure, a lot of room.', lead: 'Programmes for real routines.', copy: 'Choose a goal and follow a sequence at your own pace. Programmes will be listed once reviewed and published.' },
  trainers: { title: 'Meet your guides.', lead: 'People who make movement feel possible.', copy: 'Our trainer directory will feature Jfit-approved trainers and their published sessions.' },
  membership: { title: 'Your routine, with a little more support.', lead: 'Choose Jfit Train or Jfit Pro.', copy: 'Jfit Train: £14 monthly or £144 annually. Jfit Pro: £34 monthly or £349 annually, with up to five total seats. These proposed launch prices are not purchasable until billing is configured.' },
  about: { title: 'A more human way to move.', lead: 'Fitness for the life you have.', copy: 'Jfit is an independent fitness and equipment concept. Our own catalogue, trainers and media will be published as they become available.' },
  help: { title: 'How can we help?', lead: 'Support details are being configured.', copy: 'Contact channels and operating hours will be published when the Jfit operator supplies them.' },
  account: { title: 'Your Jfit, all in one place.', lead: 'Account access is not configured yet.', copy: 'Registration, verification, recovery and secure sessions require a configured identity provider and delivery service.' },
  admin: { title: 'Jfit operations.', lead: 'Staff access only.', copy: 'Administration is unavailable until identity, staff roles, audit logging and database services are configured. No public default administrator is provided.' },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === 'account') return <AccountPortal />;
  const page = known[section] ?? { title: 'Coming into focus.', lead: 'This Jfit space is taking shape.', copy: 'This section will be available when its required content and services have been configured.' };
  return <main className="subpage"><header className="nav wrap"><Link className="brand" href="/">jfit<span>•</span></Link><nav aria-label="Main navigation"><Link href="/shop">Shop</Link><Link href="/workouts">Workouts</Link><Link href="/programmes">Programmes</Link><Link href="/trainers">Trainers</Link><Link href="/membership">Membership</Link></nav><Link className="text-link" href="/">Home <span>↗</span></Link></header><section className="subpage-content wrap"><div className="eyebrow"><i /> JFIT · {section.toUpperCase()}</div><h1>{page.title}</h1><h2>{page.lead}</h2><p>{page.copy}</p><Link className="button" href="/">Back to Jfit <span>↗</span></Link><div className="state-note"><span className="state-dot"/>Service status: not configured for production</div></section><footer className="footer"><div className="wrap footer-bottom"><span>© 2026 Jfit</span><span>UK · GBP (£)</span><span>Independent Jfit product and content experience.</span></div></footer></main>;
}
