// Punto 4: la dirección exacta de una publicación solo la ve su publicador.
// Punto 7: ampliar acá a "o contraparte de un reclamo aceptado", consultando la tabla de
// reclamos con el mismo criterio que claim_contact_access en profile-contact.js. No exponer
// escritura de este permiso desde la app.
export async function canSeeExactLocation(database, publication, viewerId) {
  return Boolean(viewerId) && viewerId === publication.publisher_id;
}
