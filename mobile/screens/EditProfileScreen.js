import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getMyProfile, saveMyProfile, photoUri } from '../services/profileService';
import { getApiError } from '../services/api';

export default function EditProfileScreen({ navigation }) {
  const { runNativeActivity } = useAuth();
  const [profile,setProfile]=useState(null);
  const [name,setName]=useState('');
  const [neighborhood,setNeighborhood]=useState('');
  const [phone,setPhone]=useState('');
  const [sharePhone,setSharePhone]=useState(false);
  const [photo,setPhoto]=useState(undefined);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  function fill(data){setProfile(data);setName(data.name);setNeighborhood(data.neighborhood);setPhone(data.phone);setSharePhone(data.share_phone_after_claim);setPhoto(undefined);}
  async function load(){setLoading(true);setError('');try{fill(await getMyProfile());}catch(error){setError(getApiError(error));}finally{setLoading(false);}}
  useEffect(()=>{load();},[]);
  async function pickPhoto(){
    setError('');setMessage('');
    try {
      const result=await runNativeActivity(() => ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.5,base64:true}));
      if(result.canceled)return;
      const asset=result.assets[0];
      if(!asset.base64 || asset.base64.length>1398104){setError('Elegí una foto de hasta 1 MB. Podés recortarla antes de guardarla.');return;}
      // ImagePicker entrega el base64 de la imagen procesada en JPEG.
      setPhoto({base64:asset.base64,mimeType:'image/jpeg',uri:asset.uri});
    } catch {setError('No se pudo abrir la galería. Intentá nuevamente.');}
  }
  async function save(){
    if(busy)return;
    if(!name.trim()){setError('Ingresá tu nombre.');return;}
    setBusy(true);setError('');setMessage('');
    const payload={name:name.trim(),neighborhood:neighborhood.trim(),phone:phone.trim(),share_phone_after_claim:sharePhone};
    if(photo!==undefined)payload.photo=photo?{base64:photo.base64,mimeType:photo.mimeType}:null;
    try{await saveMyProfile(payload);navigation.goBack();}catch(error){setError(getApiError(error));}finally{setBusy(false);}
  }
  if(loading)return <ActivityIndicator style={{flex:1}} size="large" accessibilityLabel="Cargando perfil"/>;
  if(!profile)return <View style={styles.container}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.button} onPress={load} accessibilityRole="button"><Text style={styles.buttonText}>Reintentar</Text></TouchableOpacity></View>;
  const preview=photo===undefined?photoUri(profile.photo_url):photo?.uri;
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Editar perfil</Text>
    {preview && <Image source={{uri:preview}} style={styles.photo} accessibilityLabel="Foto seleccionada"/>}
    <TouchableOpacity style={styles.secondary} disabled={busy} accessibilityRole="button" onPress={pickPhoto}><Text style={styles.link}>Elegir foto de la galería</Text></TouchableOpacity>
    {!!preview && <TouchableOpacity style={styles.secondary} disabled={busy} accessibilityRole="button" onPress={()=>setPhoto(null)}><Text style={styles.link}>Quitar foto</Text></TouchableOpacity>}
    <Text style={styles.label}>Nombre</Text><TextInput accessibilityLabel="Nombre" style={styles.input} editable={!busy} maxLength={80} value={name} onChangeText={setName}/>
    <Text style={styles.label}>Barrio o localidad</Text><TextInput accessibilityLabel="Barrio o localidad" style={styles.input} editable={!busy} maxLength={100} value={neighborhood} onChangeText={setNeighborhood}/>
    <Text style={styles.label}>Teléfono de contacto</Text><TextInput accessibilityLabel="Teléfono de contacto" style={styles.input} editable={!busy} maxLength={30} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Opcional"/>
    <View style={styles.row}><Text style={[styles.text,{flex:1}]}>Compartir mi teléfono después de aceptar un reclamo</Text><Switch accessibilityLabel="Compartir teléfono tras aceptar reclamo" value={sharePhone} disabled={busy} onValueChange={setSharePhone}/></View>
    <Text style={styles.text}>{sharePhone?'Tu teléfono solo podrá compartirse con la contraparte de un reclamo aceptado.':'Preferís comunicarte solo a través de la app.'} El perfil público nunca muestra tu teléfono.</Text>
    {!!error&&<Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    {!!message&&<Text style={styles.text} accessibilityLiveRegion="polite">{message}</Text>}
    <TouchableOpacity style={styles.button} disabled={busy} accessibilityRole="button" onPress={save}><Text style={styles.buttonText}>{busy?'Guardando…':'Guardar cambios'}</Text></TouchableOpacity>
    <TouchableOpacity style={styles.secondary} disabled={busy} accessibilityRole="button" onPress={()=>navigation.goBack()}><Text style={styles.link}>Cancelar</Text></TouchableOpacity>
  </ScrollView>;
}
const styles=StyleSheet.create({
 container:{flexGrow:1,padding:24,backgroundColor:'#F6F8F7'},title:{fontSize:28,fontWeight:'700',color:'#173F35',marginBottom:20},photo:{width:104,height:104,borderRadius:52,alignSelf:'center',marginBottom:12},label:{fontSize:16,fontWeight:'600',color:'#173F35',marginBottom:8,marginTop:16},input:{minHeight:52,borderWidth:1,borderColor:'#A9B9B0',borderRadius:10,padding:12,backgroundColor:'white',fontSize:16,color:'#173F35'},row:{flexDirection:'row',alignItems:'center',marginTop:20,marginBottom:12},text:{fontSize:15,lineHeight:23,color:'#52635B',marginBottom:12},button:{minHeight:52,padding:16,borderRadius:10,backgroundColor:'#205B46',justifyContent:'center',marginTop:12},buttonText:{color:'white',fontWeight:'600',fontSize:16,textAlign:'center'},secondary:{minHeight:48,padding:12,justifyContent:'center'},link:{color:'#205B46',fontSize:16,fontWeight:'600',textAlign:'center'},error:{fontSize:15,color:'#A32929',lineHeight:23,marginVertical:12},
});
