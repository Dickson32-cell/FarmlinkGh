
import { SignJWT } from 'jose';
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const token = await new SignJWT(JSON.parse(process.env.CLAIMS))
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('12h')
  .sign(secret);
console.log(token);
