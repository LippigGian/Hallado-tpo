// Punto 9: antes, "Guardar búsqueda como alerta" guardaba la búsqueda solo en el dispositivo
// (recentSearches.js, flag `guardada`). Esta función las sube una vez al backend y las quita
// del dispositivo. Las fechas se calculan con el momento en que se guardó cada una
// (`guardadaEn`), así "Hoy" sigue siendo aquel día.
import { createAlert } from '../alertService';
import { alertas, criteriosAAlerta } from '../search/searchCriteria';
import { listarBusquedas, quitarAlertaGuardada } from '../search/recentSearches';

let enCurso = null;

async function migrar(userId) {
  const locales = alertas(await listarBusquedas(userId));
  let migradas = 0;
  for (const item of locales) {
    const cuerpo = criteriosAAlerta(item.criterios, new Date(item.guardadaEn ?? Date.now()));
    try {
      await createAlert(cuerpo);
      migradas += 1;
      await quitarAlertaGuardada(userId, item.clave);
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.code;
      // Ya existía en el backend, o no es una alerta válida: no hay nada más que subir.
      if ((status === 409 && code === 'duplicate') || status === 400) {
        await quitarAlertaGuardada(userId, item.clave);
        continue;
      }
      // Tope alcanzado, sin conexión o error del servidor: se reintenta la próxima vez.
      break;
    }
  }
  return migradas;
}

// Devuelve cuántas alertas se subieron. Seguro de llamar varias veces a la vez.
export function migrarAlertasLocales(userId) {
  if (!userId) return Promise.resolve(0);
  if (!enCurso) enCurso = migrar(userId).catch(() => 0).finally(() => { enCurso = null; });
  return enCurso;
}
