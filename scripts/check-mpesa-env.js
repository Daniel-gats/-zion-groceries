require('dotenv').config({ quiet: true });

const required = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL',
  'MPESA_ENVIRONMENT',
];

const placeholders = [
  'your_',
  'change_this',
  'yourdomain',
  'localhost',
  'sandbox',
  '174379',
];

let ok = true;

for (const key of required) {
  const value = (process.env[key] || '').trim();
  const normalized = value.toLowerCase();
  const isPlaceholder = placeholders.some((placeholder) => normalized.includes(placeholder));

  if (!value.trim()) {
    ok = false;
    console.log(`${key}: missing`);
  } else if (isPlaceholder) {
    ok = false;
    console.log(`${key}: placeholder_or_sandbox`);
  } else {
    console.log(`${key}: set`);
  }
}

if ((process.env.MPESA_ENVIRONMENT || '').trim() !== 'production') {
  ok = false;
  console.log('MPESA_ENVIRONMENT must be production for live money collection.');
}

if (!/^https:\/\/.+\/api\/mpesa\/callback$/.test((process.env.MPESA_CALLBACK_URL || '').trim())) {
  ok = false;
  console.log('MPESA_CALLBACK_URL must be an HTTPS URL ending in /api/mpesa/callback.');
}

process.exit(ok ? 0 : 1);
