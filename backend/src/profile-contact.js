// Llamar dentro de la transacción que acepta el reclamo, después de verificar sus participantes.
export async function grantAcceptedClaimContact(client, claimId, firstUserId, secondUserId) {
  await client.query(`INSERT INTO public.claim_contact_access(claim_id,owner_id,viewer_id)
    VALUES ($1,$2,$3),($1,$3,$2) ON CONFLICT DO NOTHING`,[claimId,firstUserId,secondUserId]);
}
// Llamar si el flujo revoca la aceptación; no exponer escritura de permisos a la app.
export async function revokeClaimContact(client, claimId) {
  await client.query('DELETE FROM public.claim_contact_access WHERE claim_id=$1',[claimId]);
}
