import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RecoverPasswordScreen from '../screens/RecoverPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{
      headerStyle: { backgroundColor: '#F6F8F7' },
      headerTintColor: '#173F35',
      contentStyle: { backgroundColor: '#F6F8F7' },
    }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Hallado' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="RecoverPassword" component={RecoverPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
    </Stack.Navigator>
  );
}
