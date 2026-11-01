// Punto 8 - Botón "Cómo llegar": abre Google Maps (o la app de mapas por defecto)
// en modo navegación con la dirección del punto de encuentro precargada.
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { abrirComoLlegar } from '../../services/meetingPoint/directions';

export default function ComoLlegarButton({ punto, style }) {
  const [abriendo, setAbriendo] = useState(false);
  async function abrir() {
    setAbriendo(true);
    try {
      await abrirComoLlegar(punto);
    } catch (error) {
      Alert.alert('Cómo llegar', error.message);
    } finally {
      setAbriendo(false);
    }
  }
  return (
    <TouchableOpacity style={[styles.boton, style]} accessibilityRole="button"
      accessibilityHint="Abre la aplicación de mapas con la navegación hacia el punto de encuentro"
      disabled={abriendo} onPress={abrir}>
      <Text style={styles.texto}>{abriendo ? 'Abriendo mapas…' : 'Cómo llegar'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  boton: { backgroundColor: '#205B46', minHeight: 48, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  texto: { color: 'white', fontSize: 16, fontWeight: '600' },
});
