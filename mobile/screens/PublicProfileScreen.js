import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity } from 'react-native';
import { getPublicProfile } from '../services/profileService';
import { getApiError } from '../services/api';
import ProfileSummary from '../components/ProfileSummary';
export default function PublicProfileScreen({route}){
 const [profile,setProfile]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 async function load(){setLoading(true);setError('');try{setProfile(await getPublicProfile(route.params.userId));}catch(error){setError(getApiError(error));}finally{setLoading(false);}}
 useEffect(()=>{load();},[route.params.userId]);
 return <ScrollView contentContainerStyle={{flexGrow:1,padding:24,backgroundColor:'#F6F8F7'}}>
  {loading?<ActivityIndicator size="large"/>:error?<><Text accessibilityLiveRegion="polite" style={{fontSize:16,color:'#A32929'}}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={load} style={{minHeight:48,padding:12}}><Text>Reintentar</Text></TouchableOpacity></>:profile&&<ProfileSummary profile={profile}/>}
 </ScrollView>;
}
