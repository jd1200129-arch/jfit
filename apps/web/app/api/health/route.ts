export async function GET() {
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  return Response.json({
    service: 'jfit-web-api',
    status: hasDatabase ? 'degraded' : 'not_configured',
    checks: { database: hasDatabase ? 'configured_unverified' : 'not_configured', payments: process.env.STRIPE_SECRET_KEY ? 'configured_unverified' : 'not_configured', media: process.env.MUX_TOKEN_ID ? 'configured_unverified' : 'not_configured' },
    timestamp: new Date().toISOString(),
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
