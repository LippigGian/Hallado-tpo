import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';
export default function App() {
  return <AuthProvider><NavigationContainer><StatusBar style="dark" /><AppNavigator /></NavigationContainer></AuthProvider>;
}
