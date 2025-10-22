import { createHmac } from 'crypto';

const secret = '3kN8pL9mX7qR4vF2wE5yU6tI1oP0sA9dG8hJ3bN7cM2xV5zQ4wE8rT1yU6iO3pL9m';
const testPayload = JSON.stringify({ jobs: [{ id: 'test', title: 'Test Job' }] });

// TypeScript signature generation
const hmac = createHmac('sha256', secret).update(testPayload).digest('hex');
const signature = `sha256=${hmac}`;

console.log('Secret:', secret);
console.log('Payload:', testPayload);
console.log('Signature:', signature);

// Simulate PHP hash_hmac
console.log('\nPHP equivalent:');
console.log(`$expected = 'sha256=' . hash_hmac('sha256', '${testPayload}', '${secret}');`);
