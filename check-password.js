const bcrypt = require('bcrypt');

const password = 'SecurePass123!';
const hash = '$2b$10$ZiiMfpPgMxFHrJe6CU7c1uoKOoKqBL2VLFKca9BrXTxYp8b6v5tgi';

bcrypt.compare(password, hash).then(result => {
  console.log('Password matches:', result);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
