// Punto 6 - Pantalla de prueba del modo sin conexión.
// Usa datos de ejemplo porque la API de publicaciones (puntos 3, 4 y 5) todavía no existe.
// Cuando esas pantallas estén listas, esta pantalla se puede quitar: la integración real
// está documentada en docs/modo-offline.md.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import ConnectionRequiredButton from '../components/offline/ConnectionRequiredButton';
import {
  guardarPublicacionVista, guardarResultadosBusqueda, listarPublicacionesGuardadas, obtenerResultadosGuardados,
} from '../services/offline/offlineCache';
import {
  ESTADO_PENDIENTE, descartarPendiente, encolarPublicacion, hayEnviadorRegistrado, registrarEnviadorPublicaciones,
} from '../services/offline/pendingPublications';

const PUBLICACIONES_EJEMPLO = [
  { id: 'demo-1', tipo: 'perdido', categoria: 'Mascota', titulo: 'Perro mestizo marrón', barrio: 'Palermo',
    descripcion: 'Collar rojo, responde a "Toby". Se perdió cerca de Plaza Serrano.',
    fotos: ['https://picsum.photos/seed/hallado-perro/600/400'] },
  { id: 'demo-2', tipo: 'encontrado', categoria: 'Billetera', titulo: 'Billetera de cuero negra', barrio: 'Caballito',
    descripcion: 'Encontrada en Parque Rivadavia, sin documentos a la vista.',
    fotos: ['https://picsum.photos/seed/hallado-billetera/600/400'] },
];
const SECCIONES = [['guardadas', 'Guardadas'], ['busqueda', 'Búsqueda'], ['publicar', 'Publicar'], ['acciones', 'Acciones']];
const CRITERIOS_EJEMPLO = { queOcurrio: 'perdido', categoria: 'Mascota', barrio: 'Palermo', cuando: 'ultima-semana' };

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));
const dosDigitos = n => String(n).padStart(2, '0');
function formatearFecha(ms) {
  const d = new Date(ms);
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)} ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
}

export default function OfflineDemoScreen() {
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const { isOnline, pendientes, ultimoEnvio, sincronizarPendientes } = useConnectivity();
  const [guardadas, setGuardadas] = useState([]);
  const [busqueda, setBusqueda] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [seccion, setSeccion] = useState('guardadas');

  // Al cambiar el estado de la conexión, el último mensaje deja de ser válido.
  useEffect(() => { setMensaje(''); }, [isOnline]);

  const recargarGuardadas = useCallback(() => { listarPublicacionesGuardadas().then(setGuardadas); }, []);
  useFocusEffect(recargarGuardadas);

  // Envío simulado mientras no exista POST /publicaciones (lo registrará el punto 5).
  useEffect(() => {
    if (hayEnviadorRegistrado()) return undefined;
    const quitar = registrarEnviadorPublicaciones(async datos => { await esperar(800); return { ...datos, id: Date.now() }; });
    if (isOnline) sincronizarPendientes();
    return quitar;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function consultarPublicacion(publicacion) {
    setOcupado(true);
    setMensaje('Descargando detalle y fotos…');
    try {
      await esperar(400); // simula GET /publicaciones/:id
      await guardarPublicacionVista(publicacion);
      recargarGuardadas();
      setMensaje(`"${publicacion.titulo}" quedó guardada para verla sin conexión.`);
    } finally { setOcupado(false); }
  }

  async function buscar() {
    setOcupado(true);
    try {
      if (isOnline) {
        await esperar(400); // simula la búsqueda en la API
        const resultados = PUBLICACIONES_EJEMPLO.filter(p => p.tipo === CRITERIOS_EJEMPLO.queOcurrio);
        await guardarResultadosBusqueda(CRITERIOS_EJEMPLO, resultados);
        setBusqueda({ resultados, guardadoEn: Date.now(), desdeCache: false, coincideConBusqueda: true });
      } else {
        const guardado = await obtenerResultadosGuardados(CRITERIOS_EJEMPLO);
        setBusqueda(guardado ? { ...guardado, desdeCache: true } : { resultados: [], desdeCache: true, vacio: true });
      }
    } finally { setOcupado(false); }
  }

  async function publicar() {
    const datos = { tipo: 'encontrado', categoria: 'Llaves', titulo: `Llavero con 3 llaves (${formatearFecha(Date.now())})`,
      barrio: 'Almagro', descripcion: 'Encontrado en la parada del 132.', fotos: [] };
    setOcupado(true);
    try {
      await encolarPublicacion(userId, datos);
      if (isOnline) {
        await sincronizarPendientes();
        setMensaje('Publicación enviada.');
      } else {
        setMensaje('Sin conexión: la publicación quedó pendiente de envío y se publicará sola al recuperar la conexión.');
      }
    } finally { setOcupado(false); }
  }

  const accionSimulada = nombre => Alert.alert(nombre, 'Acción simulada: requiere conexión y se habilita solo si hay internet.');

  return (
    <ScrollView contentContainerStyle={styles.contenedor}>
      <View style={[styles.estado, isOnline ? styles.estadoOnline : styles.estadoOffline]}>
        <Text style={styles.estadoTexto}>{isOnline ? 'Con conexión' : 'Sin conexión'}</Text>
      </View>
      <Text style={styles.nota}>Pantalla de prueba del punto 6 con datos de ejemplo. Para probar sin conexión, cortá la red del emulador.</Text>
      {!!mensaje && <Text style={styles.mensaje} accessibilityLiveRegion="polite">{mensaje}</Text>}

      <View style={styles.pestanas} accessibilityRole="tablist">
        {SECCIONES.map(([clave, nombre]) => (
          <TouchableOpacity key={clave} style={[styles.pestana, seccion === clave && styles.pestanaActiva]}
            accessibilityRole="tab" accessibilityState={{ selected: seccion === clave }} onPress={() => setSeccion(clave)}>
            <Text style={[styles.pestanaTexto, seccion === clave && styles.pestanaTextoActivo]}>{nombre}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {seccion === 'guardadas' && <>
      <Text style={styles.seccion}>1. Publicaciones consultadas</Text>
      {PUBLICACIONES_EJEMPLO.map(p => (
        <ConnectionRequiredButton key={p.id} titulo={`Abrir "${p.titulo}"`} variante="secundario" disabled={ocupado}
          onPress={() => consultarPublicacion(p)} style={styles.espacio}
          mensaje="Sin conexión solo se pueden ver las publicaciones ya consultadas (abajo)." />
      ))}
      {guardadas.length === 0 && <Text style={styles.texto}>Todavía no hay publicaciones guardadas.</Text>}
      {guardadas.map(({ publicacion, fotosLocales, guardadoEn }) => (
        <View key={publicacion.id} style={styles.tarjeta}>
          {fotosLocales[0]
            ? <Image source={{ uri: fotosLocales[0] }} style={styles.foto} accessibilityLabel={`Foto de ${publicacion.titulo}`} />
            : <View style={[styles.foto, styles.sinFoto]}><Text style={styles.texto}>Sin foto guardada</Text></View>}
          <Text style={styles.titulo}>{publicacion.titulo}</Text>
          <Text style={styles.texto}>{publicacion.categoria} · Barrio: {publicacion.barrio}</Text>
          <Text style={styles.texto}>{publicacion.descripcion}</Text>
          <Text style={styles.fecha}>Guardada el {formatearFecha(guardadoEn)}</Text>
        </View>
      ))}

      </>}

      {seccion === 'busqueda' && <>
      <Text style={styles.seccion}>2. Búsqueda</Text>
      <Text style={styles.texto}>Perdí · Mascota · Palermo · Última semana</Text>
      <TouchableOpacity style={[styles.boton, styles.espacio]} accessibilityRole="button" disabled={ocupado} onPress={buscar}>
        <Text style={styles.botonTexto}>Buscar</Text>
      </TouchableOpacity>
      {busqueda?.desdeCache && !busqueda.vacio && (
        <Text style={styles.advertencia} accessibilityRole="alert">
          Sin conexión. Mostramos los últimos resultados cargados el {formatearFecha(busqueda.guardadoEn)}; la información podría no estar actualizada.
          {!busqueda.coincideConBusqueda ? ' Corresponden a tu última búsqueda, no a esta.' : ''}
        </Text>
      )}
      {busqueda?.vacio && <Text style={styles.advertencia}>Sin conexión y sin resultados guardados. Buscá con conexión al menos una vez.</Text>}
      {busqueda?.resultados?.map(r => <Text key={r.id} style={styles.resultado}>• {r.titulo} ({r.barrio})</Text>)}

      </>}

      {seccion === 'publicar' && <>
      <Text style={styles.seccion}>3. Publicar sin conexión</Text>
      <TouchableOpacity style={[styles.boton, styles.espacio]} accessibilityRole="button" disabled={ocupado} onPress={publicar}>
        <Text style={styles.botonTexto}>Crear publicación de ejemplo</Text>
      </TouchableOpacity>
      {ultimoEnvio?.enviadas > 0 && <Text style={styles.mensaje}>Conexión recuperada: se publicaron {ultimoEnvio.enviadas} pendiente(s) a las {formatearFecha(ultimoEnvio.fecha)}.</Text>}
      {pendientes.map(p => (
        <View key={p.idLocal} style={styles.tarjeta}>
          <Text style={styles.titulo}>{p.datos.titulo}</Text>
          <Text style={p.estado === ESTADO_PENDIENTE ? styles.pendiente : styles.advertencia}>
            {p.estado === ESTADO_PENDIENTE ? 'Pendiente de envío' : `No se pudo publicar: ${p.ultimoError}`}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => descartarPendiente(userId, p.idLocal)}>
            <Text style={styles.enlace}>Descartar</Text>
          </TouchableOpacity>
        </View>
      ))}

      </>}

      {seccion === 'acciones' && <>
      <Text style={styles.seccion}>4. Acciones que requieren conexión</Text>
      <ConnectionRequiredButton titulo="Es mío" onPress={() => accionSimulada('Es mío')} style={styles.espacio} />
      <ConnectionRequiredButton titulo="Seguir publicación" variante="secundario" onPress={() => accionSimulada('Seguir publicación')} style={styles.espacio} />
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 20, paddingBottom: 140, backgroundColor: '#F6F8F7' },
  estado: { borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  estadoOnline: { backgroundColor: '#DCEFE6' },
  estadoOffline: { backgroundColor: '#F4DCD6' },
  estadoTexto: { fontSize: 16, fontWeight: '700', color: '#173F35' },
  nota: { fontSize: 14, lineHeight: 20, color: '#52635B', marginBottom: 8 },
  mensaje: { fontSize: 14, lineHeight: 20, color: '#205B46', marginVertical: 8 },
  seccion: { fontSize: 20, fontWeight: '700', color: '#173F35', marginTop: 16, marginBottom: 10 },
  pestanas: { flexDirection: 'row', backgroundColor: '#E1E7E4', borderRadius: 10, padding: 4, marginTop: 4 },
  pestana: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  pestanaActiva: { backgroundColor: 'white' },
  pestanaTexto: { fontSize: 13, color: '#52635B', fontWeight: '600' },
  pestanaTextoActivo: { color: '#173F35' },
  texto: { fontSize: 15, lineHeight: 22, color: '#52635B' },
  espacio: { marginBottom: 10 },
  tarjeta: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#E1E7E4' },
  foto: { width: '100%', height: 110, borderRadius: 8, marginBottom: 10, backgroundColor: '#E1E7E4' },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 17, fontWeight: '700', color: '#173F35', marginBottom: 4 },
  fecha: { fontSize: 13, color: '#6B7B74', marginTop: 6 },
  boton: { backgroundColor: '#205B46', minHeight: 52, padding: 16, borderRadius: 10, alignItems: 'center' },
  botonTexto: { color: 'white', fontSize: 16, fontWeight: '600' },
  advertencia: { fontSize: 14, lineHeight: 20, color: '#8A3B2E', marginVertical: 6 },
  pendiente: { fontSize: 14, fontWeight: '700', color: '#9A6A00', marginVertical: 4 },
  resultado: { fontSize: 15, lineHeight: 24, color: '#173F35' },
  enlace: { color: '#205B46', fontWeight: '600', marginTop: 6 },
});
