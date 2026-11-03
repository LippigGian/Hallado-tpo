// Punto 4 - Detalle de la publicación.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import ConnectionRequiredButton from '../components/offline/ConnectionRequiredButton';
import PhotoGallery from '../components/publication/PhotoGallery';
import PublisherCard from '../components/publication/PublisherCard';
import { conFotosAbsolutas, followPublication, getPublication, unfollowPublication } from '../services/publicationService';
import { getApiError } from '../services/api';
import { guardarPublicacionVista, obtenerPublicacionGuardada } from '../services/offline/offlineCache';
import {
  accionesDisponibles, etiquetaCategoria, etiquetaEstado, etiquetaTipo, textoCoordenadas, textoFechaSuceso, ubicacionExactaVisible,
} from '../services/publications/publicationView';
import { formatShortDateTime } from '../utils/dateTime';

export default function PublicationDetailScreen({ route, navigation }) {
  const { publicationId } = route.params;
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const { isOnline } = useConnectivity();
  const [publicacion, setPublicacion] = useState(null);
  const [fotosLocales, setFotosLocales] = useState(null);
  const [offlineInfo, setOfflineInfo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ocupadoSeguir, setOcupadoSeguir] = useState(false);
  const [errorSeguir, setErrorSeguir] = useState('');

  useFocusEffect(useCallback(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        if (!isOnline) throw Object.assign(new Error('offline'), { response: undefined, __forceOffline: true });
        const data = await getPublication(publicationId);
        const conFotos = conFotosAbsolutas(data);
        if (!activo) return;
        setPublicacion(conFotos);
        setFotosLocales(null);
        setOfflineInfo(null);
        guardarPublicacionVista(conFotos).catch(() => {});
      } catch (err) {
        if (!activo) return;
        if (err.response) {
          setError(getApiError(err));
        } else {
          const guardada = await obtenerPublicacionGuardada(publicationId);
          if (!activo) return;
          if (guardada) {
            setPublicacion(guardada.publicacion);
            setFotosLocales(guardada.fotosLocales);
            setOfflineInfo({ guardadoEn: guardada.guardadoEn });
          } else {
            setPublicacion(null);
            setOfflineInfo({ vacio: true });
          }
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    cargar();
    return () => { activo = false; };
  }, [publicationId, isOnline]));

  async function alternarSeguir() {
    if (!publicacion) return;
    setOcupadoSeguir(true);
    setErrorSeguir('');
    try {
      const resultado = publicacion.viewer.is_following ? await unfollowPublication(publicationId) : await followPublication(publicationId);
      setPublicacion(p => ({ ...p, followers_count: resultado.followers_count, viewer: { ...p.viewer, is_following: resultado.following } }));
    } catch (err) {
      setErrorSeguir(getApiError(err));
    } finally {
      setOcupadoSeguir(false);
    }
  }

  if (cargando) return <View style={styles.centro}><ActivityIndicator size="large" accessibilityLabel="Cargando publicación" /></View>;

  if (!publicacion) {
    return (
      <View style={styles.centro}>
        <Text style={styles.texto}>{offlineInfo?.vacio ? 'Esta publicación no está guardada en el dispositivo. Conectate para verla.' : (error || 'No se pudo cargar la publicación.')}</Text>
      </View>
    );
  }

  const fotos = fotosLocales?.length ? fotosLocales : (publicacion.fotos || []);
  const acciones = accionesDisponibles(publicacion, { isOnline });
  const mostrarExacta = ubicacionExactaVisible(publicacion, userId);

  return (
    <ScrollView contentContainerStyle={styles.contenedor}>
      <PhotoGallery uris={fotos} titulo={publicacion.title} />

      {offlineInfo && !offlineInfo.vacio && (
        <Text style={styles.advertencia} accessibilityRole="alert">
          Sin conexión. Mostramos la versión guardada el {formatShortDateTime(offlineInfo.guardadoEn)}; podría no estar actualizada.
        </Text>
      )}

      <View style={styles.cuerpo}>
        <View style={styles.fila}>
          <View style={styles.insignia}><Text style={styles.insigniaTexto}>{etiquetaTipo(publicacion.type)}</Text></View>
          <View style={[styles.insignia, styles.insigniaEstado]}><Text style={styles.insigniaTexto}>{etiquetaEstado(publicacion.status)}</Text></View>
        </View>
        <Text style={styles.titulo}>{publicacion.title}</Text>
        <Text style={styles.texto}>{etiquetaCategoria(publicacion.category)} · {publicacion.neighborhood}</Text>
        <Text style={styles.texto}>Fecha del suceso: {textoFechaSuceso(publicacion)}</Text>
        {!!textoCoordenadas(publicacion) && <Text style={styles.textoSecundario}>Coordenadas aprox.: {textoCoordenadas(publicacion)}</Text>}
        {!!publicacion.description && <Text style={[styles.texto, styles.descripcion]}>{publicacion.description}</Text>}

        {mostrarExacta
          ? <Text style={styles.ubicacionExacta}>Dirección exacta (solo vos la ves): {publicacion.exact_location.address}</Text>
          : <Text style={styles.textoSecundario}>La dirección exacta se comparte cuando se acepta un reclamo.</Text>}

        <PublisherCard publisher={publicacion.publisher} onVerPerfil={() => navigation.navigate('PublicProfile', { userId: publicacion.publisher.id })} />

        <View style={styles.acciones}>
          {acciones.reclamo.visible && (
            <ConnectionRequiredButton
              titulo={acciones.reclamo.titulo}
              onPress={() => navigation.navigate(acciones.reclamo.ruta, acciones.reclamo.params)}
              disabled={!acciones.reclamo.habilitado && isOnline}
              mensaje={acciones.motivo || undefined}
              style={styles.espacio}
            />
          )}
          {acciones.seguir.visible && (
            <ConnectionRequiredButton
              titulo={ocupadoSeguir ? 'Guardando…' : acciones.seguir.titulo}
              variante="secundario"
              disabled={ocupadoSeguir || (!acciones.seguir.habilitado && isOnline)}
              onPress={alternarSeguir}
              style={styles.espacio}
            />
          )}
          {!!errorSeguir && <Text style={styles.error} accessibilityLiveRegion="polite">{errorSeguir}</Text>}
          <Text style={styles.textoSecundario}>{publicacion.followers_count} persona{publicacion.followers_count === 1 ? '' : 's'} siguiendo esta publicación</Text>
          {acciones.gestionar.visible && (
            <TouchableOpacity style={styles.botonGestionar} accessibilityRole="button" onPress={() => navigation.navigate(acciones.gestionar.ruta, acciones.gestionar.params)}>
              <Text style={styles.botonGestionarTexto}>Gestionar publicación</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { paddingBottom: 140, backgroundColor: '#F6F8F7' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F6F8F7' },
  cuerpo: { padding: 20 },
  fila: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  insignia: { backgroundColor: '#DCEFE6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  insigniaEstado: { backgroundColor: '#E1E7E4' },
  insigniaTexto: { color: '#173F35', fontSize: 12, fontWeight: '700' },
  titulo: { fontSize: 22, fontWeight: '700', color: '#173F35', marginBottom: 6 },
  texto: { fontSize: 15, color: '#52635B', lineHeight: 22 },
  textoSecundario: { fontSize: 13, color: '#6B7B74', marginTop: 4 },
  descripcion: { marginTop: 10 },
  ubicacionExacta: { fontSize: 14, color: '#205B46', fontWeight: '600', marginTop: 10 },
  advertencia: { fontSize: 14, lineHeight: 20, color: '#8A3B2E', padding: 16, paddingBottom: 0 },
  acciones: { marginTop: 16 },
  espacio: { marginBottom: 10 },
  error: { fontSize: 13, color: '#A32929', marginBottom: 8 },
  botonGestionar: { minHeight: 48, borderRadius: 10, backgroundColor: '#205B46', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  botonGestionarTexto: { color: 'white', fontSize: 15, fontWeight: '600' },
});
