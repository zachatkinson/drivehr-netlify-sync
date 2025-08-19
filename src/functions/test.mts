/**
 * Minimal test function to debug deployment issues
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Test function starting - imports work');

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Test function handler called', { method: req.method });
  
  try {
    return new Response(JSON.stringify({
      success: true,
      message: 'Test function works',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Test function error', { error });
    return new Response(JSON.stringify({
      success: false,
      error: 'Test function error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};