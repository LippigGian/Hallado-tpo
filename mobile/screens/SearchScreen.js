// Punto 3 - Buscador inicial y resultados: pantalla inicial con el buscador guiado.
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario } from '../context/ConnectivityContext';
import SearchFilters from '../components/search/SearchFilters';
import { alertas, describirBusqueda, recientes, validarCriterios } from '../services/search/searchCriteria';
import { listarBusquedas, quitarAlertaGuardada, registrarBusqueda } from '../services/search/recentSearches';

const CRITERIOS_INICIALES = { queTePaso: null, categoria: null, palabras: '', origenUbicacion: null, barrio: '', cuando: null, desde: '', hasta: '', orden: 'recientes' };

export default function SearchScreen({ navigation }) {
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const [criterios, setCriterios] = useState(CRITERIOS_INICIALES);
  const [errores, setErrores] = useState({});
  const [listaBusquedas, setListaBusquedas] = useState([]);

  useFocusEffect(useCallback(() => {
    let activo = true;
    listarBusquedas(userId).then(lista => { if (activo) setListaBusquedas(lista); });
    return () => { activo = false; };
  }, [userId]));

  async function buscar(criteriosAUsar = criterios) {
    const erroresEncontrados = validarCriterios(criteriosAUsar);
    if (Object.keys(erroresEncontrados).length) { setErrores(erroresEncontrados); return; }
    setErrores({});
    await registrarBusqueda(userId, criteriosAUsar);
    navigation.navigate('SearchResults', { criterios: criteriosAUsar });
  }

  async function repetir(item) {
    setCriterios({ ...CRITERIOS_INICIALES, ...item.criterios });
    await buscar(item.criterios);
  }

  async function quitar(clave) {
    setListaBusquedas(await quitarAlertaGuardada(userId, clave));
  }

  const ultimasBusquedas = recientes(listaBusquedas).slice(0, 5);
  const alertasGuardadas = alertas(listaBusquedas);

  return (
    <ScrollView contentContainerStyle={styles.contenedor} keyboardShouldPersistTaps="handled">
      {!!ultimasBusquedas.length && (
        <View style={styles.seccionRecientes}>
          <Text style={styles.seccionTitulo}>Últimas búsquedas</Text>
          {ultimasBusquedas.map(item => (
            <TouchableOpacity key={item.clave} style={styles.itemReciente} accessibilityRole="button" onPress={() => repetir(item)}>
              <Text style={styles.itemRecienteTexto}>{describirBusqueda(item.criterios)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!alertasGuardadas.length && (
        <View style={styles.seccionRecientes}>
          <Text style={styles.seccionTitulo}>Alertas guardadas en este dispositivo</Text>
          {alertasGuardadas.map(item => (
            <View key={item.clave} style={styles.itemAlerta}>
              <TouchableOpacity style={styles.itemAlertaTexto} accessibilityRole="button" onPress={() => repetir(item)}>
                <Text style={styles.itemRecienteTexto}>{describirBusqueda(item.criterios)}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => quitar(item.clave)}>
                <Text style={styles.quitar}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <SearchFilters valor={criterios} onChange={parcial => setCriterios(c => ({ ...c, ...parcial }))} errores={errores} />

      <TouchableOpacity style={styles.boton} accessibilityRole="button" onPress={() => buscar()}>
        <Text style={styles.botonTexto}>Buscar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 20, paddingBottom: 140, backgroundColor: '#F6F8F7' },
  seccionRecientes: { marginBottom: 12 },
  seccionTitulo: { fontSize: 15, fontWeight: '700', color: '#173F35', marginBottom: 6 },
  itemReciente: { backgroundColor: 'white', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E1E7E4' },
  itemRecienteTexto: { color: '#205B46', fontSize: 14, fontWeight: '600' },
  itemAlerta: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E1E7E4' },
  itemAlertaTexto: { flex: 1 },
  quitar: { color: '#A32929', fontSize: 13, fontWeight: '600', marginLeft: 12 },
  boton: { backgroundColor: '#205B46', minHeight: 52, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  botonTexto: { color: 'white', fontSize: 16, fontWeight: '600' },
});
