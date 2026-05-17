#!/bin/sh
# Usage: ./test-endpoint.sh <container> <url>

CONTAINER=$1
URL=$2

echo "Testing $URL in container $CONTAINER..."

docker exec $CONTAINER node -e "
const http = require('http');
const url = '$URL';
const urlObj = new URL(url);

const options = {
  hostname: urlObj.hostname,
  port: urlObj.port || 80,
  path: urlObj.pathname,
  method: 'GET'
};

http.get(options, (res) => {
  console.log('Status:', res.statusCode);
  process.exit(res.statusCode === 200 ? 0 : 1);
}).on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
"
