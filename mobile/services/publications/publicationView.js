// Punto 4 - Detalle de la publicación. Módulo puro (sin imports): las tablas se duplican
// desde services/search/searchCriteria.js porque un test puro no puede importar ese módulo.
const CATEGORIAS = { documents: 'Documentos', keys: 'Llaves', electronics: 'Electrónica', pets: 'Mascotas', clothing: 'Ropa', other: 'Otros' };
const FRANJAS = { early_morning: 'Madrugada', morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };
const ESTADOS = { open: 'Abierta', in_claim: 'En reclamo', resolved: 'Resuelta' };

export function etiquetaTipo(tipo) {
  return tipo === 'found' ? 'Encontrado' : 'Perdido';
}
export function etiquetaEstado(estado) {
  return ESTADOS[estado] || estado;
}
export function etiquetaCategoria(categoria) {
  return CATEGORIAS[categoria] || categoria;
}
export function etiquetaFranja(franja) {
  return FRANJAS[franja] || null;
}

function formatearFecha(iso) {
  if (typeof iso !== 'string') return '';
  const [anio, mes, dia] = iso.split('-');
  if (!anio || !mes || !dia) return '';
  return `${dia}/${mes}/${anio}`;
}

export function textoFechaSuceso(publicacion = {}) {
  const fecha = formatearFecha(publicacion.occurred_on);
  const franja = etiquetaFranja(publicacion.time_slot);
  return franja ? `${fecha} · ${franja}` : `${fecha} · Franja horaria sin indicar`;
}

export function textoCoordenadas(publicacion = {}) {
  if (typeof publicacion.approx_latitude !== 'number' || typeof publicacion.approx_longitude !== 'number') return '';
  return `${publicacion.approx_latitude}, ${publicacion.approx_longitude} (aproximadas)`;
}

// La caché offline es compartida por todos los usuarios del dispositivo: solo mostrar la
// dirección exacta si quien mira la publicación guardada es efectivamente su publicador.
export function ubicacionExactaVisible(publicacion = {}, userId) {
  return Boolean(publicacion.exact_location) && Boolean(userId) && publicacion.publisher?.id === userId;
}

export function accionesDisponibles(publicacion = {}, { isOnline = true } = {}) {
  const viewer = publicacion.viewer || {};
  const motivo = !isOnline
    ? 'Necesitás conexión a internet para continuar.'
    : publicacion.status === 'resolved'
      ? 'Esta publicación ya está resuelta.'
      : '';
  return {
    reclamo: {
      visible: !viewer.is_owner,
      habilitado: Boolean(viewer.can_claim) && isOnline,
      titulo: viewer.claim_action === 'its_mine' ? 'Es mío' : 'Lo encontré',
      ruta: 'ClaimStart',
      params: { publicationId: publicacion.id, accion: viewer.claim_action },
    },
    seguir: {
      visible: !viewer.is_owner,
      habilitado: Boolean(viewer.can_follow) && isOnline,
      titulo: viewer.is_following ? 'Dejar de seguir' : 'Seguir publicación',
    },
    gestionar: {
      visible: Boolean(viewer.can_manage),
      ruta: 'ManagePublication',
      params: { publicationId: publicacion.id },
    },
    motivo,
  };
}
