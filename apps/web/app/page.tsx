import Link from 'next/link';

const workouts = [
  { title: 'Find your flow', kind: 'YOGA · 24 MIN', image: 'yoga' },
  { title: 'Built for the everyday', kind: 'STRENGTH · 32 MIN', image: 'strength' },
  { title: 'A little more in you', kind: 'CARDIO · 28 MIN', image: 'cardio' },
];

export default function Home() {
  return <>
    <div className="announcement">A little movement goes a long way <span>— Your first week starts here</span></div>
    <header className="nav wrap">
      <Link className="brand" href="/">jfit<span>•</span></Link>
      <nav aria-label="Main navigation"><Link href="/shop">Shop</Link><Link href="/workouts">Workouts</Link><Link href="/programmes">Programmes</Link><Link href="/trainers">Trainers</Link><Link href="/membership">Membership</Link></nav>
      <div className="nav-actions"><Link className="sign-in" href="/account">Sign in</Link><Link className="button button-small" href="/membership">Join Jfit <span>↗</span></Link></div>
    </header>
    <main>
      <section className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><i /> YOUR PACE. YOUR PLACE.</div><h1>Make space<br/>for <em>stronger.</em></h1><p>Good training meets you where you are. Find the movement that feels right today — and build from there.</p><div className="hero-buttons"><Link className="button" href="/workouts">Explore workouts <span>↗</span></Link><Link className="text-link" href="/membership">See membership <span>→</span></Link></div><div className="social-proof"><div className="avatars"><span>J</span><span>F</span><span>I</span></div><span>Made for real life, one session at a time.</span></div></div>
        <div className="hero-art" role="img" aria-label="Athlete training in a sunlit studio"><div className="hero-shape shape-back"/><div className="hero-shape shape-front"/><div className="art-caption"><span>01 / 03</span><span>MOVE IN YOUR OWN WAY</span></div><div className="play-badge">↗</div></div>
      </section>
      <section className="ticker"><div>SHOW UP <b>✳</b> FIND YOUR FLOW <b>✳</b> GET A LITTLE STRONGER <b>✳</b> KEEP IT YOURS <b>✳</b> SHOW UP <b>✳</b> FIND YOUR FLOW <b>✳</b></div></section>
      <section className="section wrap"><div className="section-head"><div><div className="eyebrow">A GOOD PLACE TO BEGIN</div><h2>Find your kind<br/>of <em>movement.</em></h2></div><Link className="text-link" href="/workouts">See all workouts <span>→</span></Link></div><div className="workout-grid">{workouts.map((item, i) => <Link className={`workout-card ${item.image}`} href="/workouts" key={item.title}><span className="card-number">0{i + 1}</span><div className="card-content"><span>{item.kind}</span><h3>{item.title}</h3><span className="card-arrow">↗</span></div></Link>)}</div></section>
      <section className="membership-band"><div className="wrap member-inner"><div><div className="eyebrow">YOUR NEXT CHAPTER</div><h2>Training that<br/>fits <em>your life.</em></h2><p>From first timers to all-in optimists, there's a Jfit membership for you.</p></div><div className="plan-card"><div className="plan-top"><span>JFIT TRAIN</span><span className="plan-dot">✳</span></div><div className="price">£14<span> / month</span></div><p>All the tools to build a routine that sticks.</p><ul><li>Hundreds of guided workouts</li><li>Programmes made for your goals</li><li>Progress that feels like yours</li></ul><Link className="button button-light" href="/membership">Find your plan <span>↗</span></Link><small>Plans and prices shown are configurable launch examples.</small></div></div></section>
      <section className="section wrap editorial"><div className="editorial-art"><div className="sun"/><div className="editorial-lines">MOVE<br/>WITH<br/>INTENTION.</div></div><div className="editorial-copy"><div className="eyebrow">SMALL STEPS. REAL MOMENTUM.</div><h2>Progress looks<br/>different on <em>everyone.</em></h2><p>Build a routine around the life you have. Keep track of the sessions you show up for, find a new favourite, and make your own definition of progress.</p><Link className="button" href="/programmes">Meet your next programme <span>↗</span></Link></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-top"><Link className="brand" href="/">jfit<span>•</span></Link><div className="footer-links"><Link href="/shop">Shop</Link><Link href="/workouts">Workouts</Link><Link href="/membership">Membership</Link><Link href="/help">Help</Link><Link href="/about">About</Link></div><span>Good things take showing up.</span></div><div className="wrap footer-bottom"><span>© 2026 Jfit</span><span>UK · GBP (£)</span><span>Equipment and programme availability shown when configured.</span></div></footer>
  </>;
}
