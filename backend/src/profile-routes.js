import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { readReputation } from './reputation.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const columns='id,name,neighborhood,created_at,profile_updated_at,photo_mime';

async function profile(database,id,privateView=false) {
  const result=await database.query(`SELECT ${columns}${privateView?',email,phone,share_phone_after_claim':''} FROM public.users WHERE id=$1`,[id]);
  if (!result.rowCount) return null;
  const row=result.rows[0];
  const {photo_mime,...data}=row;
  return { ...data, photo_url:photo_mime?`/profiles/${id}/photo?v=${new Date(row.profile_updated_at).getTime()}`:null,
    reputation:await readReputation(database,id) };
}

export function profileRouter(database,tokens) {
  const router=Router();
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.use(rateLimit({windowMs:60000,limit:100,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Demasiadas solicitudes de perfil. Intentá más tarde.'}}));
  async function authenticate(req,res,next) {
    const match=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'');
    if (!tokens.ready) return res.status(503).json({error:'Sesión no configurada.'});
    let payload;
    try {payload=tokens.verify(match?.[1]||'');} catch {return res.status(401).json({error:'Sesión inválida o vencida.'});}
    if (!uuid.test(payload.sub||'')) return res.status(401).json({error:'Sesión inválida o vencida.'});
    try {
      const user=await database.query('SELECT id,session_version FROM public.users WHERE id=$1',[payload.sub]);
      if (!user.rowCount || (payload.ver??0)!==user.rows[0].session_version) return res.status(401).json({error:'Sesión inválida o vencida.'});
      req.userId=payload.sub; next();
    } catch {res.status(503).json({error:'No se pudo validar la sesión.'});}
  }
  router.get('/me',authenticate,async(req,res)=>{
    try {res.json({profile:await profile(database,req.userId,true)});}
    catch {res.status(503).json({error:'No se pudo cargar tu perfil.'});}
  });
  router.patch('/me',authenticate,async(req,res)=>{
    const body=req.body;
    const allowed=['name','neighborhood','phone','share_phone_after_claim','photo'];
    if (!body || Array.isArray(body) || typeof body!=='object' || !Object.keys(body).length || Object.keys(body).some(key=>!allowed.includes(key))) return res.status(400).json({error:'Campos de perfil inválidos.'});
    const fields=[],values=[];
    function add(column,value){values.push(value);fields.push(`${column}=$${values.length}`);}
    for(const [key,max] of [['name',80],['neighborhood',100],['phone',30]]) {
      if (!(key in body)) continue;
      if(typeof body[key]!=='string'||body[key].trim().length>max||(key==='name'&&!body[key].trim())) return res.status(400).json({error:`Revisá el campo ${key}: máximo ${max} caracteres${key==='name'?', sin dejarlo vacío':''}.`});
      if(key==='phone'&&body[key]&&!/^[+\d\s().-]{3,30}$/.test(body[key])) return res.status(400).json({error:'Ingresá un teléfono válido o dejalo vacío.'});
      add(key,body[key].trim());
    }
    if('share_phone_after_claim' in body){if(typeof body.share_phone_after_claim!=='boolean')return res.status(400).json({error:'Preferencia de privacidad inválida.'});add('share_phone_after_claim',body.share_phone_after_claim);}
    if('photo' in body){
      if(body.photo===null){add('photo_data',null);add('photo_mime',null);}
      else {
        const photo=body.photo;
        if(!photo||!['image/jpeg','image/png'].includes(photo.mimeType)||typeof photo.base64!=='string'||photo.base64.length>1398104||!/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) return res.status(400).json({error:'Usá una foto JPEG o PNG de hasta 1 MB.'});
        const bytes=Buffer.from(photo.base64,'base64');
        const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        if(!bytes.length||bytes.length>1048576||bytes.toString('base64')!==photo.base64||!(photo.mimeType==='image/jpeg'?jpeg:png)) return res.status(400).json({error:'La foto no es un JPEG o PNG válido de hasta 1 MB.'});
        add('photo_data',bytes);add('photo_mime',photo.mimeType);
      }
    }
    values.push(req.userId);
    try {
      await database.query(`UPDATE public.users SET ${fields.join(',')},profile_updated_at=clock_timestamp() WHERE id=$${values.length}`,values);
      res.json({profile:await profile(database,req.userId,true)});
    } catch {res.status(503).json({error:'No se pudo guardar el perfil.'});}
  });
  router.get('/:id/contact',authenticate,async(req,res)=>{
    if(!uuid.test(req.params.id)||!uuid.test(req.query.claimId||''))return res.status(400).json({error:'Perfil o reclamo inválido.'});
    try {
      const permission=await database.query('SELECT 1 FROM public.claim_contact_access WHERE claim_id=$1 AND owner_id=$2 AND viewer_id=$3',[req.query.claimId,req.params.id,req.userId]);
      if(!permission.rowCount)return res.status(403).json({error:'Solo la contraparte de un reclamo aceptado puede consultar este contacto.'});
      const result=await database.query('SELECT phone,share_phone_after_claim FROM public.users WHERE id=$1',[req.params.id]);
      const owner=result.rows[0];
      res.json({phone:owner?.share_phone_after_claim?owner.phone||null:null});
    }catch{res.status(503).json({error:'No se pudo consultar el contacto.'});}
  });
  router.get('/:id/photo',async(req,res)=>{
    if(!uuid.test(req.params.id))return res.status(400).json({error:'Identificador inválido.'});
    try {
      const result=await database.query('SELECT photo_data,photo_mime FROM public.users WHERE id=$1',[req.params.id]);
      if(!result.rows[0]?.photo_data)return res.status(404).json({error:'Foto no disponible.'});
      res.set('X-Content-Type-Options','nosniff');res.type(result.rows[0].photo_mime).send(result.rows[0].photo_data);
    }catch{res.status(503).json({error:'No se pudo cargar la foto.'});}
  });
  router.get('/:id',async(req,res)=>{
    if(!uuid.test(req.params.id))return res.status(400).json({error:'Identificador inválido.'});
    try {
      const data=await profile(database,req.params.id);
      if(!data)return res.status(404).json({error:'Perfil no encontrado.'});
      res.json({profile:data});
    }catch{res.status(503).json({error:'No se pudo cargar el perfil público.'});}
  });
  return router;
}
