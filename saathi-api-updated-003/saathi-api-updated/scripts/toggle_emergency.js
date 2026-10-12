require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { query } = require('../src/db');

async function main() {
  const mode = process.argv[2] === 'true';
  console.log(`Setting emergency_mode to ${mode} for all hubs...`);
  await query('UPDATE hubs SET emergency_mode = $1', [mode]);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
