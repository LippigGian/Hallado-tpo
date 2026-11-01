import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import AppNavigator from './navigation/AppNavigator';
import OfflineBanner from './components/offline/OfflineBanner';
export default function App() {
  return <SafeAreaProvider><AuthProvider><ConnectivityProvider>
    <View style={{ flex: 1 }}>
      <NavigationContainer><StatusBar style="dark" /><AppNavigator /></NavigationContainer>
      <OfflineBanner />
    </View>
  </ConnectivityProvider></AuthProvider></SafeAreaProvider>;
}
