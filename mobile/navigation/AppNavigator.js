import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RecoverPasswordScreen from '../screens/RecoverPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex:1, justifyContent:'center' }}><ActivityIndicator size="large" accessibilityLabel="Restaurando sesión" /></View>;
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: '#F6F8F7' },
      headerTintColor: '#173F35',
      contentStyle: { backgroundColor: '#F6F8F7' },
    }}>
      {user ? <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Hallado' }} /> : <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Hallado' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="RecoverPassword" component={RecoverPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
      </>}
    </Stack.Navigator>
  );
}
