import Link from 'next/link';

const plans = [
  {
    name: 'Jfit Train',
    note: 'A little more support',
    monthly: '£14',
    annual: '£144',
    annualDetail: '£12 per month, billed yearly',
    seats: 'Plan details will be confirmed before launch',
    featured: false,
  },
  {
    name: 'Jfit Pro',
    note: 'Share your membership',
    monthly: '£34',
    annual: '£349',
    annualDetail: '£29.08 per month, billed yearly',
    seats: 'Up to 5 seats, including the owner',
    featured: true,
  },
];

export default function MembershipPage() {
  return (
    <main className="subpage membership-page">
      <header className="nav wrap">
        <Link className="brand" href="/" aria-label="Jfit home">jfit<span>•</span></Link>
        <nav aria-label="Main navigation">
          <Link href="/shop">Shop</Link>
          <Link href="/workouts">Workouts</Link>
          <Link href="/programmes">Programmes</Link>
          <Link href="/trainers">Trainers</Link>
          <Link href="/membership" aria-current="page">Membership</Link>
        </nav>
        <Link className="text-link" href="/account">Sign in <span>↗</span></Link>
      </header>

      <section className="membership-content wrap" aria-labelledby="membership-title">
        <div className="eyebrow"><i /> JFIT · MEMBERSHIP</div>
        <h1 id="membership-title">Your routine,<br /><em>with a little more support.</em></h1>
        <p className="membership-lead">Choose the plan that fits the way you want to move.</p>

        <div className="membership-status" role="status">
          <span className="state-dot" /> Membership checkout is not available yet. These are proposed launch prices.
        </div>

        <div className="membership-plans">
          {plans.map((plan) => (
            <article className={`membership-plan${plan.featured ? ' membership-plan-featured' : ''}`} key={plan.name}>
              <div className="membership-plan-heading">
                <div>
                  <span className="membership-kicker">{plan.note}</span>
                  <h2>{plan.name}</h2>
                </div>
                {plan.featured && <span className="membership-tag">UP TO 5 SEATS</span>}
              </div>

              <div className="membership-prices">
                <div><span>Monthly</span><strong>{plan.monthly}<small> / month</small></strong></div>
                <div><span>Annual</span><strong>{plan.annual}<small> / year</small></strong><em>{plan.annualDetail}</em></div>
              </div>

              <p className="membership-seats">{plan.seats}</p>
              <button className="button membership-unavailable" type="button" disabled aria-describedby={`${plan.name.replaceAll(' ', '-').toLowerCase()}-availability`}>
                Coming soon <span aria-hidden="true">↗</span>
              </button>
              <p className="membership-plan-foot" id={`${plan.name.replaceAll(' ', '-').toLowerCase()}-availability`}>
                Plan details and secure checkout will be available when billing is configured.
              </p>
            </article>
          ))}
        </div>

        <p className="membership-currency">All prices in GBP (£). Annual prices are shown as one yearly payment.</p>
      </section>

      <footer className="footer">
        <div className="wrap footer-bottom"><span>© 2026 Jfit</span><span>UK · GBP (£)</span><span>Independent Jfit product and content experience.</span></div>
      </footer>
    </main>
  );
}
