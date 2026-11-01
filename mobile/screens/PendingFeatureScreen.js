// Placeholder para pantallas de otros puntos del TPO todavía no implementados (punto 5
// Publicar, punto 7 Reclamos). Deja preparados el nombre de ruta y los parámetros de
// navegación para que esas ramas solo tengan que reemplazar el `component` en
// AppNavigator.js.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIAS } from '../services/search/searchCriteria';

const TEXTOS = {
  Publish: { titulo: 'Publicar', texto: 'La carga de publicaciones llega con el punto 5 (Publicar).' },
  ClaimStart: { titulo: 'Reclamar', texto: 'El flujo de reclamos y verificación llega con el punto 7 (Reclamos y Verificación).' },
  ManagePublication: { titulo: 'Gestionar publicación', texto: 'Editar, renovar o marcar como resuelta llega con el punto 5 (Publicar).' },
};

function describirParametros(routeName, params = {}) {
  if (!params || !Object.keys(params).length) return null;
  if (routeName === 'Publish') {
    const partes = [];
    if (params.tipo) partes.push(params.tipo === 'lost' ? 'Perdí' : 'Encontré');
    if (params.categoria) partes.push(CATEGORIAS.find(c => c.id === params.categoria)?.etiqueta || params.categoria);
    if (params.barrio) partes.push(params.barrio);
    return partes.length ? `Se precargará: ${partes.join(' · ')}` : null;
  }
  if (routeName === 'ClaimStart') {
    return `Acción: ${params.accion === 'its_mine' ? 'Es mío' : 'Lo encontré'}`;
  }
  return null;
}

export default function PendingFeatureScreen({ route, navigation }) {
  const info = TEXTOS[route.name] || { titulo: 'Próximamente', texto: 'Esta función todavía no está disponible.' };
  const parametros = describirParametros(route.name, route.params);
  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>{info.titulo}</Text>
      <Text style={styles.texto}>{info.texto}</Text>
      {!!parametros && <Text style={styles.parametros}>{parametros}</Text>}
      <TouchableOpacity style={styles.boton} accessibilityRole="button" onPress={() => navigation.goBack()}>
        <Text style={styles.botonTexto}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F6F8F7' },
  titulo: { fontSize: 24, fontWeight: '700', color: '#173F35', marginBottom: 12 },
  texto: { fontSize: 16, lineHeight: 24, color: '#52635B', marginBottom: 12 },
  parametros: { fontSize: 15, lineHeight: 22, color: '#205B46', marginBottom: 24, fontStyle: 'italic' },
  boton: { backgroundColor: '#205B46', minHeight: 52, padding: 16, borderRadius: 10, alignItems: 'center' },
  botonTexto: { color: 'white', fontSize: 16, fontWeight: '600' },
});
