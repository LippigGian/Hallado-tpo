import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { recordReputationEvent } from '../src/reputation.js';
import { grantAcceptedClaimContact, revokeClaimContact } from '../src/profile-contact.js';
if(!process.env.DATABASE_URL||!process.env.JWT_SECRET)throw new Error('Falta configuración.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();await client.query('BEGIN');
const database={query:(sql,values)=>client.query(sql,values)};
const tokens=createSessionTokens(process.env.JWT_SECRET);
const server=createApp(database,undefined,undefined,tokens).listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
let checks=0;function check(a,b){assert.deepEqual(a,b);checks++;}
async function request(path,{method='GET',body,token}={}){
 const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json()};
}
try{
 const first=randomUUID(),second=randomUUID(),third=randomUUID();
 for(const id of [first,second,third])await client.query("INSERT INTO public.users(id,email,password_hash,email_verified_at) VALUES($1,$2,'temporary-not-a-real-password',now())",[id,`${id}@example.invalid`]);
 const token=tokens.sign(first),other=tokens.sign(second),outsider=tokens.sign(third);
 check((await request('/profiles/me')).status,401);
 const initial=await request('/profiles/me',{token});check(initial.status,200);check(initial.body.profile.reputation.score,0);check(initial.body.profile.reputation.badges.length,0);
 check((await request('/profiles/me',{method:'PATCH',token,body:{name:'',phone:'abc'}})).status,400);
 check((await request('/profiles/me',{method:'PATCH',token,body:{id:second,name:'hack'}})).status,400);
 check((await request('/profiles/me',{method:'PATCH',token,body:{reputation:{score:500}}})).status,400);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';
 const saved=await request('/profiles/me',{method:'PATCH',token,body:{name:'Vecino de prueba',neighborhood:'Caballito',phone:'+54 11 5555 1234',share_phone_after_claim:true,photo:{base64:png,mimeType:'image/png'}}});
 check(saved.status,200);check(saved.body.profile.name,'Vecino de prueba');check(saved.body.profile.phone,'+54 11 5555 1234');
 const publicView=await request(`/profiles/${first}`);check(publicView.status,200);
 for(const field of ['phone','email','share_phone_after_claim','password_hash','photo_data','session_version','publications'])check(field in publicView.body.profile,false);
 check((await fetch(base+publicView.body.profile.photo_url)).headers.get('content-type').startsWith('image/png'),true);
 check((await request('/profiles/me',{method:'PATCH',token,body:{photo:{base64:'YWJj',mimeType:'image/png'}}})).status,400);
 check((await request(`/profiles/${first}/contact?claimId=${randomUUID()}`,{token:other})).status,403);
 const claimId=randomUUID();await grantAcceptedClaimContact(client,claimId,first,second);
 check((await request(`/profiles/${first}/contact?claimId=${claimId}`,{token:outsider})).status,403);
 check((await request(`/profiles/${first}/contact?claimId=${claimId}`,{token:other})).body.phone,'+54 11 5555 1234');
 await request('/profiles/me',{method:'PATCH',token,body:{share_phone_after_claim:false}});
 check((await request(`/profiles/${first}/contact?claimId=${claimId}`,{token:other})).body.phone,null);
 await revokeClaimContact(client,claimId);
 check((await request(`/profiles/${first}/contact?claimId=${claimId}`,{token:other})).status,403);
 const source=randomUUID();
 for(let i=0;i<5;i++)await recordReputationEvent(client,{userId:first,type:'return',sourceId:i===0?source:randomUUID()});
 await recordReputationEvent(client,{userId:first,type:'return',sourceId:source});
 await recordReputationEvent(client,{userId:first,type:'rating',sourceId:randomUUID(),authorId:second,value:1});
 await recordReputationEvent(client,{userId:first,type:'rating',sourceId:randomUUID(),authorId:third,value:-1});
 await recordReputationEvent(client,{userId:first,type:'thanks',sourceId:randomUUID(),authorId:second,message:'Gracias por la devolución.'});
 const reputation=(await request(`/profiles/${first}`)).body.profile.reputation;
 check(reputation.completed_returns,5);check(reputation.positive_ratings,1);check(reputation.negative_ratings,1);check(reputation.score,5);check(reputation.badges[0].name,'Vecino solidario');check(reputation.thanks[0].message,'Gracias por la devolución.');
 const removed=await request('/profiles/me',{method:'PATCH',token,body:{photo:null}});check(removed.body.profile.photo_url,null);
 check((await request(`/profiles/${randomUUID()}`)).status,404);
 await client.query('UPDATE public.users SET session_version=1 WHERE id=$1',[first]);check((await request('/profiles/me',{token})).status,401);
 console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: edición, privacidad pública, foto, permisos de contacto, consentimiento, reputación, insignia, eventos idempotentes y sesión revocada.`);
}finally{
 await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await client.query('ROLLBACK');await client.end();console.log('Datos temporales descartados; no se modificaron perfiles reales.');
}
