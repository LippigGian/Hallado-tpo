// Punto 8 - Pantalla de prueba del punto de encuentro.
// El acuerdo vive en memoria porque todavía no existen los reclamos (punto 7) ni sus
// endpoints. El selector de rol simula a las dos personas en un mismo dispositivo; en la
// app real el rol sale del reclamo aceptado. Ver docs/punto-encuentro.md.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MeetingPointCard from '../components/meetingPoint/MeetingPointCard';
import MeetingPointForm from '../components/meetingPoint/MeetingPointForm';
import {
  ESTADO_ACEPTADO, ESTADO_PROPUESTO, ESTADO_SIN_PROPUESTA, ROL_OTRA_PARTE, ROL_TIENE_OBJETO,
  aceptar, nuevoAcuerdo, propuestaActual, proponer, puedeProponer, puedeResponder, sugerirAlternativa,
} from '../services/meetingPoint/meetingPointFlow';

const ROLES = [[ROL_TIENE_OBJETO, 'Tengo el objeto'], [ROL_OTRA_PARTE, 'Soy el dueño']];
const NOMBRE_ROL = { [ROL_TIENE_OBJETO]: 'quien tiene el objeto', [ROL_OTRA_PARTE]: 'el dueño' };
const SUGERENCIAS = [
  { direccion: 'Plaza Serrano, Palermo', horario: 'Sábado 15 hs', referencia: 'Frente a la calesita' },
  { direccion: 'Estación Plaza Italia, Línea D', horario: 'Sábado 16 hs', referencia: 'Salida Santa Fe' },
];

// Se conserva mientras la app esté abierta, aunque se salga de la pantalla.
let acuerdoDemo = nuevoAcuerdo();

export default function MeetingPointDemoScreen() {
  const [acuerdo, setAcuerdoState] = useState(acuerdoDemo);
  const [rol, setRol] = useState(ROL_TIENE_OBJETO);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const actual = propuestaActual(acuerdo);
  const anteriores = acuerdo.propuestas.slice(0, -1).reverse();

  function guardar(nuevo, mensaje) {
    acuerdoDemo = nuevo;
    setAcuerdoState(nuevo);
    setSugiriendo(false);
    setAviso(mensaje);
  }

  function cambiarRol(nuevoRol) { setRol(nuevoRol); setSugiriendo(false); setAviso(''); }

  return (
    <ScrollView contentContainerStyle={styles.contenedor} keyboardShouldPersistTaps="handled">
      <Text style={styles.nota}>Prueba del punto 8 con un reclamo de ejemplo ya aceptado. Cambiá de rol para simular a cada persona.</Text>
      <View style={styles.pestanas} accessibilityRole="tablist">
        {ROLES.map(([clave, nombre]) => (
          <TouchableOpacity key={clave} style={[styles.pestana, rol === clave && styles.pestanaActiva]}
            accessibilityRole="tab" accessibilityState={{ selected: rol === clave }} onPress={() => cambiarRol(clave)}>
            <Text style={[styles.pestanaTexto, rol === clave && styles.pestanaTextoActivo]}>{nombre}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!aviso && <Text style={styles.aviso} accessibilityLiveRegion="polite">{aviso}</Text>}

      {acuerdo.estado === ESTADO_SIN_PROPUESTA && (puedeProponer(acuerdo, rol)
        ? <MeetingPointForm titulo="Proponé un punto de encuentro" textoBoton="Proponer punto de encuentro" sugerencias={SUGERENCIAS}
            onEnviar={datos => guardar(proponer(acuerdo, rol, datos), 'Propuesta enviada. Falta que el dueño la acepte o sugiera otro punto.')} />
        : <Text style={styles.espera}>Esperando que quien tiene el objeto proponga un punto de encuentro.</Text>)}

      {acuerdo.estado === ESTADO_ACEPTADO && (
        <MeetingPointCard propuesta={actual} titulo="Punto de encuentro confirmado" confirmado
          autor={`${NOMBRE_ROL[actual.propuestoPor]} · aceptado por ${NOMBRE_ROL[acuerdo.aceptadoPor]}`} />
      )}

      {acuerdo.estado === ESTADO_PROPUESTO && !sugiriendo && <>
        <MeetingPointCard propuesta={actual} titulo={actual.propuestoPor === rol ? 'Tu propuesta' : 'Propuesta recibida'}
          autor={actual.propuestoPor === rol ? null : NOMBRE_ROL[actual.propuestoPor]} />
        {puedeResponder(acuerdo, rol) ? <View style={styles.acciones}>
          <TouchableOpacity style={styles.boton} accessibilityRole="button"
            onPress={() => guardar(aceptar(acuerdo, rol), 'Punto de encuentro confirmado. Ya pueden usar "Cómo llegar".')}>
            <Text style={styles.botonTexto}>Aceptar punto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.boton, styles.botonSecundario]} accessibilityRole="button" onPress={() => { setSugiriendo(true); setAviso(''); }}>
            <Text style={[styles.botonTexto, styles.botonTextoSecundario]}>Sugerir otro</Text>
          </TouchableOpacity>
        </View> : <Text style={styles.espera}>Esperando que la otra persona acepte o sugiera otro punto.</Text>}
      </>}

      {acuerdo.estado === ESTADO_PROPUESTO && sugiriendo && (
        <MeetingPointForm titulo="Sugerí un punto alternativo" textoBoton="Enviar alternativa" sugerencias={SUGERENCIAS}
          onCancelar={() => setSugiriendo(false)}
          onEnviar={datos => guardar(sugerirAlternativa(acuerdo, rol, datos), 'Alternativa enviada. Ahora decide la otra persona.')} />
      )}

      {anteriores.length > 0 && <>
        <Text style={styles.seccion}>Propuestas anteriores</Text>
        {anteriores.map(p => (
          <Text key={p.propuestoEn} style={styles.historial}>• {p.direccion} ({p.horario}) — {NOMBRE_ROL[p.propuestoPor]}</Text>
        ))}
      </>}

      <TouchableOpacity accessibilityRole="button" onPress={() => guardar(nuevoAcuerdo(), 'Ejemplo reiniciado.')}>
        <Text style={styles.reiniciar}>Reiniciar ejemplo</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 20, paddingBottom: 60, backgroundColor: '#F6F8F7' },
  nota: { fontSize: 14, lineHeight: 20, color: '#52635B', marginBottom: 10 },
  pestanas: { flexDirection: 'row', backgroundColor: '#E1E7E4', borderRadius: 10, padding: 4 },
  pestana: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  pestanaActiva: { backgroundColor: 'white' },
  pestanaTexto: { fontSize: 14, color: '#52635B', fontWeight: '600' },
  pestanaTextoActivo: { color: '#173F35' },
  aviso: { fontSize: 14, lineHeight: 20, color: '#205B46', marginTop: 10 },
  espera: { fontSize: 15, lineHeight: 22, color: '#52635B', marginTop: 16 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  boton: { flex: 1, backgroundColor: '#205B46', minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  botonSecundario: { backgroundColor: 'white', borderWidth: 1, borderColor: '#205B46' },
  botonTexto: { color: 'white', fontSize: 15, fontWeight: '600' },
  botonTextoSecundario: { color: '#205B46' },
  seccion: { fontSize: 16, fontWeight: '700', color: '#173F35', marginTop: 20, marginBottom: 6 },
  historial: { fontSize: 14, lineHeight: 22, color: '#6B7B74' },
  reiniciar: { color: '#205B46', fontWeight: '600', textAlign: 'center', marginTop: 24 },
});
