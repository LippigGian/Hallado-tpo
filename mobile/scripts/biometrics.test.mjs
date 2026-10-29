import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/biometricSupport.js', import.meta.url), 'utf8');
const { authenticateBiometric } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
function device(overrides = {}) {
  return { hasHardwareAsync:async()=>true,isEnrolledAsync:async()=>true,supportedAuthenticationTypesAsync:async()=>[1],authenticateAsync:async()=>({success:true}),...overrides };
}
test('sin hardware, sin huella o sin tipos soportados no solicita autenticación',async()=>{
  for (const override of [{hasHardwareAsync:async()=>false},{isEnrolledAsync:async()=>false},{supportedAuthenticationTypesAsync:async()=>[]}]) {
    let called=false;
    await assert.rejects(()=>authenticateBiometric(device({...override,authenticateAsync:async()=>{called=true;return {success:true};}})),/Configurá/);
    assert.equal(called,false);
  }
});
test('cancelación y bloqueo de intentos no permiten continuar',async()=>{
  for(const error of ['user_cancel','system_cancel','lockout','authentication_failed'])
    await assert.rejects(()=>authenticateBiometric(device({authenticateAsync:async()=>({success:false,error})})));
});
test('éxito requiere biometría y deshabilita fallback al PIN',async()=>{
  let options;
  await authenticateBiometric(device({authenticateAsync:async value=>{options=value;return {success:true};}}));
  assert.equal(options.disableDeviceFallback,true);
  assert.equal(options.promptMessage,'Desbloquear Hallado');
});
test('errores nativos se propagan sin conceder acceso',async()=>{
  await assert.rejects(()=>authenticateBiometric(device({authenticateAsync:async()=>{throw new Error('native failure');}})),/native failure/);
});
