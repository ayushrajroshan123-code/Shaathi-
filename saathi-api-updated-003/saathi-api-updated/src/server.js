require('dotenv').config();
const app = require('./app');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SAATHI API listening on :${port}`);
});
