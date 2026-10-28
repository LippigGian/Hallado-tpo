import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createRecoveryService } from '../src/recovery-service.js';
import { createLoginService } from '../src/login-service.js';
import { createRegistrationService } from '../src/registration-service.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { hashPassword } from '../src/auth-crypto.js';
if (!process.env.DATABASE_URL || !process.env.OTP_SECRET || !process.env.JWT_SECRET) throw new Error('Falta configuración de .env.');
const client = new pg.Client({ connectionString:process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
const database = {
  query: (sql, values) => client.query(sql, values),
  async transaction(callback) {
    await client.query('SAVEPOINT recovery_test');
    try { return await callback(client); }
    catch (error) { await client.query('ROLLBACK TO SAVEPOINT recovery_test'); throw error; }
  },
};
const sent=[];
let failMail=false;
const mailer={ async sendCode(email,code,purpose) { if(failMail) throw new Error('test'); sent.push({email,code,purpose}); } };
const recovery=createRecoveryService(database,{secret:process.env.OTP_SECRET,mailer});
const registration=createRegistrationService(database,{secret:process.env.OTP_SECRET,mailer});
const tokens=createSessionTokens(process.env.JWT_SECRET);
const login=createLoginService(database,tokens);
const server=createApp(database,registration,login,tokens,recovery).listen(0,'127.0.0.1');
await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const email=`recovery-${randomUUID()}@example.invalid`;
const oldPassword='Old-test-password-123!';
const newPassword='New-test-password-123!';
let checks=0;
function check(a,b) {assert.deepEqual(a,b);checks++;}
async function post(path,body){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
async function me(token){return (await fetch(base+'/auth/me',{headers:{Authorization:`Bearer ${token}`}})).status;}
const request=()=>post('/auth/password-reset/request-code',{email});
const verify=code=>post('/auth/password-reset/verify-code',{email,code});
async function age(){await client.query("UPDATE public.auth_verifications SET created_at=now()-interval '31 seconds' WHERE email=$1",[email]);}
try {
  await client.query('INSERT INTO public.users(email,password_hash,email_verified_at) VALUES ($1,$2,now())',[email,await hashPassword(oldPassword)]);
  const before=await post('/auth/login',{email,password:oldPassword});check(before.status,200);check(await me(before.body.token),200);
  const unknown=await post('/auth/password-reset/request-code',{email:`absent-${randomUUID()}@example.invalid`});check(unknown.status,202);check(sent.length,0);
  const requested=await request();check(requested.status,202);check(requested.body,unknown.body);check(sent[0].purpose,'password_reset');
  check((await request()).status,202);check(sent.length,1);
  const wrong=sent[0].code==='000000'?'111111':'000000';
  for(let i=1;i<=5;i++)check((await verify(wrong)).status,i===5?429:400);
  check((await verify(sent[0].code)).status,429);
  await age();check((await request()).status,202);
  await client.query("UPDATE public.auth_verifications SET created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute' WHERE email=$1",[email]);
  check((await verify(sent.at(-1).code)).status,400);
  check((await request()).status,202);
  let verified=await verify(sent.at(-1).code);check(verified.status,200);
  const invalidatedToken=verified.body.resetToken;
  await age();check((await request()).status,202);
  check((await post('/auth/password-reset/complete',{resetToken:invalidatedToken,password:newPassword,passwordConfirmation:newPassword})).status,400);
  verified=await verify(sent.at(-1).code);check(verified.status,200);
  const resetToken=verified.body.resetToken;
  check((await verify(sent.at(-1).code)).status,400);
  check((await post('/auth/register/complete',{registrationToken:resetToken,password:newPassword,passwordConfirmation:newPassword})).status,400);
  check((await post('/auth/password-reset/complete',{resetToken,password:'short',passwordConfirmation:'short'})).status,400);
  check((await post('/auth/password-reset/complete',{resetToken,password:newPassword,passwordConfirmation:'wrong'})).status,400);
  check((await post('/auth/password-reset/complete',{resetToken,password:newPassword,passwordConfirmation:newPassword})).status,200);
  check((await post('/auth/password-reset/complete',{resetToken,password:newPassword,passwordConfirmation:newPassword})).status,400);
  check((await post('/auth/login',{email,password:oldPassword})).status,401);
  check(await me(before.body.token),401);
  const after=await post('/auth/login',{email,password:newPassword});check(after.status,200);check(await me(after.body.token),200);
  await age();failMail=true;
  check((await request()).status,503);
  console.log(`${checks} comprobaciones HTTP/PostgreSQL correctas: recuperación, intentos, expiración, reenvío, tokens separados, uso único, nueva contraseña y revocación de sesiones.`);
} finally {
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  await client.query('ROLLBACK');await client.end();
  console.log('Usuario y cambios temporales descartados. No se enviaron emails.');
}
