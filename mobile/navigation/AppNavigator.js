import EditProfileScreen from '../screens/EditProfileScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import MeetingPointDemoScreen from '../screens/MeetingPointDemoScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OfflineDemoScreen from '../screens/OfflineDemoScreen';
import UnlockScreen from '../screens/UnlockScreen';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import PendingFeatureScreen from '../screens/PendingFeatureScreen';
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
        <Stack.Screen name="Publish" component={PendingFeatureScreen} options={{ title: 'Publicar' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Menú' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mi perfil' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Perfil público' }} />
        <Stack.Screen name="MeetingPointDemo" component={MeetingPointDemoScreen} options={{ title: 'Punto de encuentro (prueba)' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
        <Stack.Screen name="OfflineDemo" component={OfflineDemoScreen} options={{ title: 'Modo sin conexión (prueba)' }} />
      </> : <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Hallado' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="RecoverPassword" component={RecoverPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
      </>}
    </Stack.Navigator>
  );
}
