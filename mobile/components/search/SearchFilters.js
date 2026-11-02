// Punto 3 - Buscador inicial y resultados: los cuatro bloques del buscador guiado.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORIAS, CUANDO, SITUACIONES } from '../../services/search/searchCriteria';
import { barrioMasCercano, filtrarBarrios } from '../../services/search/neighborhoods';
import { obtenerUbicacionActual } from '../../services/search/currentLocation';

function Chip({ etiqueta, seleccionado, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, seleccionado && styles.chipSeleccionado]}
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
    >
      <Text style={[styles.chipTexto, seleccionado && styles.chipTextoSeleccionado]}>{etiqueta}</Text>
    </TouchableOpacity>
  );
}

export default function SearchFilters({ valor, onChange, errores = {}, permitirTodos = false }) {
  const [textoBarrio, setTextoBarrio] = useState('');
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState('');

  function set(parcial) { onChange({ ...parcial }); }

  async function usarUbicacionActual() {
    setBuscandoUbicacion(true);
    setAvisoUbicacion('');
    try {
      const { lat, lng } = await obtenerUbicacionActual();
      const cercano = barrioMasCercano(lat, lng);
      if (!cercano) {
        setAvisoUbicacion('Estás fuera de la zona cubierta, elegí tu barrio de la lista.');
        set({ origenUbicacion: 'dispositivo', lat, lng, barrio: '' });
      } else {
        setAvisoUbicacion(`Cerca de tu ubicación: ${cercano.nombre}`);
        set({ origenUbicacion: 'dispositivo', lat, lng, barrio: cercano.nombre });
      }
    } catch (error) {
      setAvisoUbicacion(error.message);
    } finally {
      setBuscandoUbicacion(false);
    }
  }

  const barriosFiltrados = filtrarBarrios(textoBarrio);

  return (
    <View>
      <Text style={styles.bloque}>1. ¿Qué te pasó?</Text>
      <View style={styles.fila}>
        {SITUACIONES.map(s => (
          <Chip key={s.id} etiqueta={s.etiqueta} seleccionado={valor.queTePaso === s.id} onPress={() => set({ queTePaso: s.id })} />
        ))}
      </View>
      {!!errores.queTePaso && <Text style={styles.error}>{errores.queTePaso}</Text>}

      <Text style={styles.bloque}>2. ¿Qué es?</Text>
      <View style={styles.fila}>
        {CATEGORIAS.map(c => (
          <Chip key={c.id} etiqueta={c.etiqueta} seleccionado={valor.categoria === c.id} onPress={() => set({ categoria: c.id })} />
        ))}
      </View>
      {!!errores.categoria && <Text style={styles.error}>{errores.categoria}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Palabras clave (opcional)"
        value={valor.palabras || ''}
        onChangeText={texto => set({ palabras: texto })}
        maxLength={100}
      />
      {!!errores.palabras && <Text style={styles.error}>{errores.palabras}</Text>}

      <Text style={styles.bloque}>3. ¿Dónde?</Text>
      <TouchableOpacity style={styles.botonSecundario} accessibilityRole="button" disabled={buscandoUbicacion} onPress={usarUbicacionActual}>
        {buscandoUbicacion
          ? <ActivityIndicator accessibilityLabel="Buscando tu ubicación" />
          : <Text style={styles.botonSecundarioTexto}>Usar mi ubicación actual</Text>}
      </TouchableOpacity>
      {!!avisoUbicacion && <Text style={styles.aviso} accessibilityLiveRegion="polite">{avisoUbicacion}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Buscar barrio o localidad"
        value={textoBarrio}
        onChangeText={setTextoBarrio}
      />
      <View style={styles.fila}>
        {permitirTodos && (
          <Chip etiqueta="Cualquier barrio" seleccionado={valor.origenUbicacion === 'todos'} onPress={() => set({ origenUbicacion: 'todos', barrio: '' })} />
        )}
        {barriosFiltrados.map(nombre => (
          <Chip key={nombre} etiqueta={nombre} seleccionado={valor.barrio === nombre && valor.origenUbicacion !== 'todos'}
            onPress={() => set({ origenUbicacion: 'lista', barrio: nombre })} />
        ))}
      </View>
      {!!errores.barrio && <Text style={styles.error}>{errores.barrio}</Text>}

      <Text style={styles.bloque}>4. ¿Cuándo?</Text>
      <View style={styles.fila}>
        {CUANDO.map(c => (
          <Chip key={c.id} etiqueta={c.etiqueta} seleccionado={valor.cuando === c.id} onPress={() => set({ cuando: c.id })} />
        ))}
      </View>
      {valor.cuando === 'rango' && (
        <View style={styles.fila}>
          <TextInput style={[styles.input, styles.inputFecha]} placeholder="Desde DD/MM/AAAA" value={valor.desde || ''} onChangeText={texto => set({ desde: texto })} keyboardType="numbers-and-punctuation" />
          <TextInput style={[styles.input, styles.inputFecha]} placeholder="Hasta DD/MM/AAAA" value={valor.hasta || ''} onChangeText={texto => set({ hasta: texto })} keyboardType="numbers-and-punctuation" />
        </View>
      )}
      {!!errores.cuando && <Text style={styles.error}>{errores.cuando}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { fontSize: 17, fontWeight: '700', color: '#173F35', marginTop: 16, marginBottom: 8 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#205B46', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8 },
  chipSeleccionado: { backgroundColor: '#205B46' },
  chipTexto: { color: '#205B46', fontSize: 14, fontWeight: '600' },
  chipTextoSeleccionado: { color: 'white' },
  input: { borderWidth: 1, borderColor: '#D5DDD9', borderRadius: 10, padding: 12, fontSize: 15, marginTop: 8, backgroundColor: 'white' },
  inputFecha: { flex: 1 },
  botonSecundario: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#205B46', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 4 },
  botonSecundarioTexto: { color: '#205B46', fontSize: 15, fontWeight: '600' },
  aviso: { color: '#52635B', fontSize: 13, marginTop: 6 },
  error: { color: '#A32929', fontSize: 13, marginTop: 4 },
});
