// Punto 8 - Acuerdo del punto de encuentro dentro del detalle de un reclamo aceptado.
// Quien tiene el objeto propone; la otra persona acepta o sugiere otro punto, por turnos,
// hasta que alguien acepta. Las reglas las valida el backend (meeting-point-rules.js).
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getApiError } from '../../services/api';
import { acceptMeetingPoint, getMeetingPoint, proposeMeetingPoint } from '../../services/claimService';
import { useConnectivity } from '../../context/ConnectivityContext';
import ConnectionRequiredButton from '../offline/ConnectionRequiredButton';
import MeetingPointCard from './MeetingPointCard';
import MeetingPointForm from './MeetingPointForm';

const SUGERENCIAS = [
  { direccion: 'Plaza Serrano, Palermo', horario: 'Sábado 15 hs', referencia: 'Frente a la calesita' },
  { direccion: 'Estación Plaza Italia, Línea D', horario: 'Sábado 16 hs', referencia: 'Salida Santa Fe' },
];

export default function MeetingPointSection({ claimId, counterpartName }) {
  const { isOnline } = useConnectivity();
  const [acuerdo, setAcuerdo] = useState(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    try {
      setAcuerdo(await getMeetingPoint(claimId));
      setError('');
    } catch (cargaError) {
      setError(getApiError(cargaError));
    }
  }, [claimId]);

  // Se recarga al volver a la pantalla, para ver la respuesta de la otra persona.
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function ejecutar(accion, mensaje) {
    setEnviando(true);
    setError('');
    setAviso('');
    try {
      setAcuerdo(await accion());
      setSugiriendo(false);
      setAviso(mensaje);
    } catch (accionError) {
      setError(getApiError(accionError));
      cargar();
    } finally {
      setEnviando(false);
    }
  }

  const proponer = (datos, mensaje) => ejecutar(() => proposeMeetingPoint(claimId, datos), mensaje);

  if (!acuerdo) {
    return (
      <View style={styles.seccion}>
        <Text style={styles.titulo}>Punto de encuentro</Text>
        {error
          ? <><Text style={styles.error}>{error}</Text><ConnectionRequiredButton titulo="Reintentar" variante="secundario" onPress={cargar} /></>
          : <ActivityIndicator accessibilityLabel="Cargando punto de encuentro" />}
      </View>
    );
  }

  const actual = acuerdo.propuestas[acuerdo.propuestas.length - 1] || null;
  const anteriores = acuerdo.propuestas.slice(0, -1).reverse();
  const autor = p => (p.esMia ? 'vos' : counterpartName);
  const sinConexion = !isOnline && <Text style={styles.espera}>Necesitás conexión a internet para continuar.</Text>;

  return (
    <View style={styles.seccion}>
      <Text style={styles.titulo}>Punto de encuentro</Text>
      {!!aviso && <Text style={styles.aviso} accessibilityLiveRegion="polite">{aviso}</Text>}
      {enviando && <ActivityIndicator accessibilityLabel="Enviando" style={styles.espacio} />}

      {acuerdo.estado === 'sin_propuesta' && (acuerdo.puedeProponer
        ? (sinConexion || <MeetingPointForm titulo="Proponé dónde y cuándo devolver el objeto" textoBoton="Proponer punto de encuentro"
            sugerencias={SUGERENCIAS}
            onEnviar={datos => proponer(datos, `Propuesta enviada. Falta que ${counterpartName} la acepte o sugiera otro punto.`)} />)
        : <Text style={styles.espera}>Esperando que {counterpartName} proponga un punto de encuentro, porque tiene el objeto.</Text>)}

      {acuerdo.estado === 'aceptado' && (
        <MeetingPointCard propuesta={acuerdo.aceptado} titulo="Punto de encuentro confirmado" confirmado
          autor={autor(acuerdo.aceptado)} />
      )}

      {acuerdo.estado === 'propuesto' && !sugiriendo && <>
        <MeetingPointCard propuesta={actual} titulo={actual.esMia ? 'Tu propuesta' : 'Propuesta recibida'}
          autor={actual.esMia ? null : counterpartName} />
        {acuerdo.puedeResponder ? <View style={styles.acciones}>
          <ConnectionRequiredButton titulo="Aceptar punto" disabled={enviando} style={styles.accion}
            onPress={() => ejecutar(() => acceptMeetingPoint(claimId), 'Punto de encuentro confirmado. Ya pueden usar "Cómo llegar".')} />
          <ConnectionRequiredButton titulo="Sugerir otro" variante="secundario" disabled={enviando} style={styles.accion}
            onPress={() => { setSugiriendo(true); setAviso(''); }} />
        </View> : <Text style={styles.espera}>Esperando que {counterpartName} acepte o sugiera otro punto.</Text>}
      </>}

      {acuerdo.estado === 'propuesto' && sugiriendo && (sinConexion || (
        <MeetingPointForm titulo="Sugerí un punto alternativo" textoBoton="Enviar alternativa" sugerencias={SUGERENCIAS}
          onCancelar={() => setSugiriendo(false)}
          onEnviar={datos => proponer(datos, `Alternativa enviada. Ahora decide ${counterpartName}.`)} />
      ))}

      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

      {anteriores.length > 0 && <>
        <Text style={styles.subtitulo}>Propuestas anteriores</Text>
        {anteriores.map(p => (
          <Text key={p.id} style={styles.historial}>• {p.direccion} ({p.horario}) — {autor(p)}</Text>
        ))}
      </>}

      {acuerdo.estado !== 'aceptado' && (
        <TouchableOpacity accessibilityRole="button" onPress={cargar} disabled={enviando}>
          <Text style={styles.actualizar}>Actualizar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  seccion: { marginVertical: 16 },
  titulo: { fontSize: 18, fontWeight: '700', color: '#173F35', marginBottom: 4 },
  subtitulo: { fontSize: 15, fontWeight: '700', color: '#173F35', marginTop: 16, marginBottom: 4 },
  aviso: { fontSize: 14, lineHeight: 20, color: '#205B46', marginTop: 6 },
  espera: { fontSize: 15, lineHeight: 22, color: '#52635B', marginTop: 8 },
  error: { fontSize: 14, lineHeight: 20, color: '#A32929', marginTop: 8 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  accion: { flex: 1 },
  espacio: { marginTop: 8 },
  historial: { fontSize: 14, lineHeight: 22, color: '#6B7B74' },
  actualizar: { color: '#205B46', fontWeight: '600', textAlign: 'center', marginTop: 14 },
});
