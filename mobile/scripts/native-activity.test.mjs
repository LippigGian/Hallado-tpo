import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../services/nativeActivityGuard.js',import.meta.url),'utf8');
const {createNativeActivityGuard}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('galería y recorte conservan la excepción hasta volver a primer plano',async()=>{
 const guard=createNativeActivityGuard();let state='active';
 assert.equal(guard.isActive(),false);
 const photo=await guard.run(async()=>{
   assert.equal(guard.isActive(),true);
   state='background';
   assert.equal(guard.isActive(),true);
   return {uri:'file:///photo.jpg'};
 },()=>state);
 assert.equal(photo.uri,'file:///photo.jpg');
 // Android puede resolver el selector antes de emitir active.
 assert.equal(guard.isActive(),true);
 state='active';guard.onActive();assert.equal(guard.isActive(),false);
 // Un background posterior vuelve a requerir bloqueo normal.
 state='background';assert.equal(guard.isActive(),false);
});
test('cancelar o fallar el selector libera la excepción y permite bloquear después',async()=>{
 const guard=createNativeActivityGuard();
 assert.equal((await guard.run(async()=>({canceled:true}),()=> 'active')).canceled,true);
 assert.equal(guard.isActive(),false);
 await assert.rejects(()=>guard.run(async()=>{throw new Error('picker failed');},()=> 'active'));
 assert.equal(guard.isActive(),false);
});
test('active durante una operación nativa no libera la protección prematuramente',async()=>{
 const guard=createNativeActivityGuard();
 await guard.run(async()=>{
  guard.onActive();assert.equal(guard.isActive(),true);
  await guard.run(async()=>assert.equal(guard.isActive(),true),()=> 'active');
  assert.equal(guard.isActive(),true);
 },()=> 'active');
 assert.equal(guard.isActive(),false);
});
