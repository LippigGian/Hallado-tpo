import { Image, StyleSheet, Text, View } from 'react-native';
import { photoUri } from '../services/profileService';
export default function ProfileSummary({ profile, privateDetails = false }) {
  const reputation=profile.reputation;
  return <View>
    {profile.photo_url ? <Image source={{uri:photoUri(profile.photo_url)}} style={styles.photo} accessibilityLabel={`Foto de ${profile.name || 'perfil'}`} /> : <View style={[styles.photo,styles.empty]}><Text style={styles.initial}>{profile.name?.trim().charAt(0).toUpperCase() || 'H'}</Text></View>}
    <Text style={styles.title}>{profile.name || 'Vecino de Hallado'}</Text>
    {!!profile.neighborhood && <Text style={styles.text}>{profile.neighborhood}</Text>}
    <Text style={styles.text}>En Hallado desde {new Date(profile.created_at).toLocaleDateString('es-AR')}</Text>
    {privateDetails && <View>
      <Text style={styles.heading}>Datos de contacto</Text>
      <Text style={styles.text}>Email: {profile.email}</Text>
      <Text style={styles.text}>Teléfono: {profile.phone || 'Sin cargar'}</Text>
      <Text style={styles.text}>{profile.share_phone_after_claim ? 'Compartís el teléfono con la contraparte de un reclamo aceptado.' : 'Preferís comunicarte solo a través de la app.'}</Text>
      <Text style={styles.author}>Estos datos de contacto no aparecen en tu perfil público.</Text>
    </View>}
    <Text style={styles.heading}>Reputación</Text>
    <Text style={styles.score}>{reputation.score} puntos</Text>
    <Text style={styles.text}>{reputation.completed_returns} devoluciones concretadas</Text>
    <Text style={styles.text}>{reputation.positive_ratings} valoraciones positivas · {reputation.negative_ratings} negativas</Text>
    {reputation.completed_returns===0 && reputation.positive_ratings===0 && reputation.negative_ratings===0 && <Text style={styles.text}>Todavía no hay actividad para calcular una trayectoria.</Text>}
    <Text style={styles.heading}>Insignias</Text>
    {reputation.badges.length ? reputation.badges.map(badge=><Text key={badge.id} style={styles.badge}>{badge.name}</Text>) : <Text style={styles.text}>La insignia Vecino solidario se obtiene al concretar 5 devoluciones.</Text>}
    <Text style={styles.heading}>Agradecimientos públicos</Text>
    {reputation.thanks.length ? reputation.thanks.map(item=><View key={item.id} style={styles.thanks}><Text style={styles.text}>{item.message || '¡Gracias por la devolución!'}</Text><Text style={styles.author}>{item.author_name} · {new Date(item.created_at).toLocaleDateString('es-AR')}</Text></View>) : <Text style={styles.text}>Todavía no hay agradecimientos.</Text>}
  </View>;
}
const styles=StyleSheet.create({
 photo:{width:104,height:104,borderRadius:52,alignSelf:'center',marginBottom:16},empty:{backgroundColor:'#DCEAE1',justifyContent:'center',alignItems:'center'},initial:{fontSize:38,color:'#205B46',fontWeight:'700'},
 title:{fontSize:28,fontWeight:'700',color:'#173F35',textAlign:'center',marginBottom:12},text:{fontSize:16,lineHeight:24,color:'#52635B',marginBottom:8},heading:{fontSize:20,fontWeight:'700',color:'#173F35',marginTop:20,marginBottom:12},score:{fontSize:26,fontWeight:'700',color:'#205B46',marginBottom:12},badge:{color:'#205B46',backgroundColor:'#DCEAE1',padding:12,borderRadius:8,fontSize:16,fontWeight:'600'},thanks:{padding:12,backgroundColor:'white',borderRadius:8,marginBottom:12},author:{fontSize:14,color:'#52635B'},
});
