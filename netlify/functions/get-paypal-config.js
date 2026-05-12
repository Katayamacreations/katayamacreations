export default async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'PayPal not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ clientId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
