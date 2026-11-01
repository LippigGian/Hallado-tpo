// Punto 8 - Muestra una propuesta de punto de encuentro con su botón "Cómo llegar".
import { StyleSheet, Text, View } from 'react-native';
import ComoLlegarButton from './ComoLlegarButton';

export default function MeetingPointCard({ propuesta, titulo, autor, confirmado }) {
  return (
    <View style={[styles.tarjeta, confirmado && styles.confirmado]}>
      <Text style={styles.etiqueta}>{titulo}</Text>
      <Text style={styles.direccion}>{propuesta.direccion}</Text>
      <Text style={styles.texto}>Cuándo: {propuesta.horario}</Text>
      {!!propuesta.referencia && <Text style={styles.texto}>Referencia: {propuesta.referencia}</Text>}
      {!!autor && <Text style={styles.autor}>Propuesto por {autor}</Text>}
      <ComoLlegarButton punto={propuesta} style={styles.boton} />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E1E7E4', marginTop: 12 },
  confirmado: { borderColor: '#205B46', borderWidth: 2 },
  etiqueta: { fontSize: 13, fontWeight: '700', color: '#205B46', textTransform: 'uppercase', marginBottom: 6 },
  direccion: { fontSize: 18, fontWeight: '700', color: '#173F35', marginBottom: 4 },
  texto: { fontSize: 15, lineHeight: 22, color: '#52635B' },
  autor: { fontSize: 13, color: '#6B7B74', marginTop: 6 },
  boton: { marginTop: 12 },
});
