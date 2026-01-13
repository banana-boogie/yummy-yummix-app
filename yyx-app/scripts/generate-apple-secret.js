const fs = require('fs');
const jwt = require('jsonwebtoken');

const TEAM_ID  = 'G98HR2587H';
const KEY_ID   = '7YNNMLD2FD';
const SERVICE_ID = 'com.yummyyummix.auth';
const P8_PATH  = './YummyYummix_SigninWithApple_AuthKey_7YNNMLD2FD.p8';

const privateKey = fs.readFileSync(P8_PATH);

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15777000, // ≤6 months
    aud: 'https://appleid.apple.com',
    sub: SERVICE_ID,
  },
  privateKey,
  {
    algorithm: 'ES256',
    keyid: KEY_ID,
  }
);

console.info(token); 