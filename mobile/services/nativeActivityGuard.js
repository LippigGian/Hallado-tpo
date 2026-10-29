// La galería y el recorte abren actividades de Android que emiten background.
// Esta excepción dura solo mientras termina la operación iniciada por la app.
export function createNativeActivityGuard() {
  let running = 0;
  let waitingForReturn = false;
  return {
    isActive() { return running > 0 || waitingForReturn; },
    onActive() { if (running === 0) waitingForReturn = false; },
    async run(operation, getState) {
      running++;
      try { return await operation(); }
      finally {
        running--;
        if (running === 0) waitingForReturn = getState() !== 'active';
      }
    },
  };
}
