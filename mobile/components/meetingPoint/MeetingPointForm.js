// Punto 8 - Formulario para proponer o sugerir un punto de encuentro.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { validarPropuesta } from '../../services/meetingPoint/meetingPointFlow';

export default function MeetingPointForm({ titulo, textoBoton, onEnviar, onCancelar, sugerencias = [] }) {
  const [direccion, setDireccion] = useState('');
  const [horario, setHorario] = useState('');
  const [referencia, setReferencia] = useState('');
  const [errores, setErrores] = useState({});

  function enviar() {
    const datos = { direccion, horario, referencia };
    const nuevos = validarPropuesta(datos);
    setErrores(nuevos);
    if (!Object.keys(nuevos).length) onEnviar(datos);
  }

  function usarSugerencia(s) {
    setDireccion(s.direccion); setHorario(s.horario); setReferencia(s.referencia || ''); setErrores({});
  }

  return (
    <View style={styles.formulario}>
      <Text style={styles.titulo}>{titulo}</Text>
      {sugerencias.length > 0 && <View style={styles.sugerencias}>
        {sugerencias.map(s => (
          <TouchableOpacity key={s.direccion} style={styles.chip} accessibilityRole="button" onPress={() => usarSugerencia(s)}>
            <Text style={styles.chipTexto}>{s.direccion}</Text>
          </TouchableOpacity>
        ))}
      </View>}
      <Text style={styles.label}>Dirección o lugar</Text>
      <TextInput style={styles.input} value={direccion} onChangeText={setDireccion}
        placeholder="Ej.: Plaza Serrano, Palermo" accessibilityLabel="Dirección o lugar" />
      {!!errores.direccion && <Text style={styles.error}>{errores.direccion}</Text>}
      <Text style={styles.label}>Día y horario</Text>
      <TextInput style={styles.input} value={horario} onChangeText={setHorario}
        placeholder="Ej.: Sábado 15 hs" accessibilityLabel="Día y horario" />
      {!!errores.horario && <Text style={styles.error}>{errores.horario}</Text>}
      <Text style={styles.label}>Referencia (opcional)</Text>
      <TextInput style={styles.input} value={referencia} onChangeText={setReferencia}
        placeholder="Ej.: frente a la heladería" accessibilityLabel="Referencia" />
      <TouchableOpacity style={styles.boton} accessibilityRole="button" onPress={enviar}>
        <Text style={styles.botonTexto}>{textoBoton}</Text>
      </TouchableOpacity>
      {!!onCancelar && <TouchableOpacity accessibilityRole="button" onPress={onCancelar}>
        <Text style={styles.cancelar}>Cancelar</Text>
      </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  formulario: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E1E7E4', marginTop: 12 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#173F35', marginBottom: 8 },
  sugerencias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#205B46', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipTexto: { color: '#205B46', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#173F35', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#C9D3CE', borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 15, color: '#173F35', backgroundColor: '#FBFCFB' },
  error: { color: '#8A3B2E', fontSize: 13, marginTop: 4 },
  boton: { backgroundColor: '#205B46', minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  botonTexto: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelar: { color: '#205B46', fontWeight: '600', textAlign: 'center', marginTop: 12 },
});
