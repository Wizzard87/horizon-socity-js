const dns = require('dns');

dns.resolveSrv('_mongodb._tcp.cluster0.m2tmpx7.mongodb.net', (err, addresses) => {
  if (err) {
    console.error('DNS Error:', err.message);
    process.exit(1);
  }
  console.log('Resolved addresses:', addresses);
});
