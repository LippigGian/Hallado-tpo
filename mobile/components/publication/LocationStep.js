import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import FormField from '../FormField';
import PrimaryButton from '../PrimaryButton';
import { colors } from '../../config/theme';
import { LIMITS } from '../../config/publicationOptions';

const roundCoordinate = value => Math.round(value * 1e6) / 1e6;

export default function LocationStep({ form, onChange }) {
  const { runNativeActivity } = useAuth();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const hasCoordinates = form.latitude !== null && form.longitude !== null;

  async function fillCurrentLocation() {
    setMessage('');
    setLocating(true);
    try {
      const position = await runNativeActivity(async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return null;
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      });
      if (position === null) {
        setMessage('Sin permiso de ubicación no podemos cargar las coordenadas. Escribí la dirección igualmente.');
      } else {
        onChange({
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        });
      }
    } catch {
      setMessage('No se pudo obtener la ubicación. Revisá que el GPS esté activado o escribí la dirección.');
    } finally {
      setLocating(false);
    }
  }

  return (
    <View>
      <FormField
        label="Barrio o localidad"
        placeholder="Ej.: Caballito"
        maxLength={LIMITS.neighborhood[1]}
        value={form.neighborhood}
        onChangeText={neighborhood => onChange({ neighborhood })}
      />
      <FormField
        label="Dirección exacta"
        placeholder="Ej.: Av. Rivadavia 5000"
        hint="Solo la ves vos. Las demás personas la ven cuando se acepta un reclamo."
        maxLength={LIMITS.address[1]}
        value={form.address}
        onChangeText={address => onChange({ address })}
      />
      <PrimaryButton
        title={hasCoordinates ? 'Actualizar con mi ubicación actual' : 'Usar mi ubicación actual'}
        variant="secondary"
        busy={locating}
        onPress={fillCurrentLocation}
      />
      {hasCoordinates && (
        <View style={styles.coordinates}>
          <Text style={styles.text} accessibilityLiveRegion="polite">
            Coordenadas cargadas: {form.latitude}, {form.longitude}
          </Text>
          <PrimaryButton title="Quitar coordenadas" variant="secondary" onPress={() => onChange({ latitude: null, longitude: null })} />
        </View>
      )}
      {!!message && <Text style={styles.error} accessibilityLiveRegion="polite">{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  coordinates: { marginTop: 12 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 8 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginTop: 12 },
});
