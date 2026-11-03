import EditProfileScreen from '../screens/EditProfileScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UnlockScreen from '../screens/UnlockScreen';
import PublishPublicationScreen from '../screens/PublishPublicationScreen';
import MyPublicationsScreen from '../screens/MyPublicationsScreen';
import CreateClaimScreen from '../screens/CreateClaimScreen';
import MyClaimsScreen from '../screens/MyClaimsScreen';
import ClaimDetailScreen from '../screens/ClaimDetailScreen';
import ClaimDemoScreen from '../screens/ClaimDemoScreen';
import MyAlertsScreen from '../screens/MyAlertsScreen';
import AlertResultsScreen from '../screens/AlertResultsScreen';
import FollowedPublicationsScreen from '../screens/FollowedPublicationsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HistoryFeedbackScreen from '../screens/HistoryFeedbackScreen';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import PublicationDetailScreen from '../screens/PublicationDetailScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RecoverPasswordScreen from '../screens/RecoverPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading, locked } = useAuth();
  if (loading) return <View style={{ flex:1, justifyContent:'center' }}><ActivityIndicator size="large" accessibilityLabel="Restaurando sesión" /></View>;
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: '#F6F8F7' },
      headerTintColor: '#173F35',
      contentStyle: { backgroundColor: '#F6F8F7' },
    }}>
      {locked ? <Stack.Screen name="Unlock" component={UnlockScreen} options={{ title: 'Hallado', headerBackVisible:false }} /> : user ? <>
        <Stack.Screen name="Search" component={SearchScreen} options={({ navigation }) => ({
          title: 'Buscar',
          headerRight: () => <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Home')}>
            <Text style={{ color:'#205B46', fontWeight:'600', fontSize:16 }}>Menú</Text>
          </TouchableOpacity>,
        })} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ title: 'Resultados' }} />
        <Stack.Screen name="PublicationDetail" component={PublicationDetailScreen} options={{ title: 'Publicación' }} />
        <Stack.Screen name="ClaimStart" component={CreateClaimScreen} options={{ title: 'Reclamar' }} />
        <Stack.Screen name="ManagePublication" component={MyPublicationsScreen} options={{ title: 'Mis publicaciones' }} />
        <Stack.Screen name="Publish" component={PublishPublicationScreen} options={{ title: 'Nueva publicación' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Menú' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mi perfil' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Perfil público' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
        <Stack.Screen name="PublishPublication" component={PublishPublicationScreen} options={{ title: 'Nueva publicación' }} />
        <Stack.Screen name="MyPublications" component={MyPublicationsScreen} options={{ title: 'Mis publicaciones' }} />
        <Stack.Screen name="CreateClaim" component={CreateClaimScreen} options={{ title: 'Reclamar' }} />
        <Stack.Screen name="MyClaims" component={MyClaimsScreen} options={{ title: 'Mis reclamos' }} />
        <Stack.Screen name="ClaimDetail" component={ClaimDetailScreen} options={{ title: 'Detalle del reclamo' }} />
        <Stack.Screen name="ClaimDemo" component={ClaimDemoScreen} options={{ title: 'Reclamar (prueba)' }} />
        <Stack.Screen name="MyAlerts" component={MyAlertsScreen} options={{ title: 'Mis alertas' }} />
        <Stack.Screen name="AlertResults" component={AlertResultsScreen} options={{ title: 'Coincidencias' }} />
        <Stack.Screen name="FollowedPublications" component={FollowedPublicationsScreen} options={{ title: 'Seguidas' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
        <Stack.Screen name="HistoryFeedback" component={HistoryFeedbackScreen} options={({ route }) => ({ title: route.params?.tipo === 'thanks' ? 'Agradecer' : 'Valorar' })} />
      </> : <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Hallado' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="RecoverPassword" component={RecoverPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
      </>}
    </Stack.Navigator>
  );
}
