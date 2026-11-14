# SECURITY.md - Seguridad de CalGuard

## Principios

1. **Offline-first**: La app funciona sin conexión. Solo habla con el propio origen (GitHub Pages) y, en el móvil del administrador, con `api.github.com` para publicar
2. **Cero dependencias remotas**: Sin CDN, sin analytics, sin tracking. Las librerías de importación (SheetJS 0.20.3 y pdf.js 4.4.168) están **vendorizadas** en `vendor/` y se sirven desde el propio origen, con carga perezosa solo al importar archivos
3. **Datos locales**: Todo se almacena en IndexedDB del navegador
4. **Sin PII por defecto**: La app advierte contra introducir datos personales sensibles

## Content Security Policy (CSP)

La CSP está definida en `index.html` vía meta tag:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
connect-src 'self' https://api.github.com;
font-src 'self';
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
```

- **script-src 'self'**: Solo scripts del mismo origen. No inline scripts.
- **style-src 'self'** (sin `'unsafe-inline'`, desde v3.16.0): solo la hoja de estilos propia. El HTML que genera `js/ui/*` **no lleva atributos `style="…"`**: los colores y tamaños van por clases (p. ej. `avatar hue-7`) y los tamaños calculados (barras de las gráficas) se escriben como `data-w` / `data-h` y se aplican con `el.style.setProperty` tras insertar el HTML (`watchDataSizes` en `js/ui/utils.js`). `tests/csp.test.js` falla si alguien vuelve a añadir `style=` o `'unsafe-inline'`.
- **connect-src 'self' https://api.github.com**: el propio origen y la API de GitHub (solo la usa el administrador para publicar).
- **object-src 'none'**: Bloquea plugins (Flash, Java).

## PIN de Bloqueo

### Implementación (formato v3)
- El PIN se hashea con **PBKDF2** (600.000 iteraciones, SHA-256) y **salt aleatorio de 16 bytes** por registro
- Se almacena `{salt, hash, v:3}` en IndexedDB (`pinHash`); el PIN original **nunca se almacena**
- La comparación de hashes es en **tiempo constante**
- Los PIN creados con el formato antiguo (v2, salt fijo) se migran automáticamente a v3 en el primer desbloqueo correcto
- **Límite de intentos**: a partir del 5.º fallo se aplica una espera exponencial (2s, 4s, 8s... hasta 60s) con cuenta atrás visible; el contador persiste entre recargas

### Auto-bloqueo
- Configurable: 1-60 minutos de inactividad
- Detecta: click, keydown, touchstart, scroll
- Al bloquear: la UI se reemplaza completamente por la pantalla de PIN
- Al bloquear, se cierran las hojas abiertas y se descarta lo que estuviera sin guardar. El PIN protege lo que se ve en pantalla

### Longitud
- **PIN nuevo: de 6 a 8 cifras** (desde v3.16.0). Los PIN de 4 o 5 cifras creados antes siguen valiendo para desbloquear; al cambiarlo, el nuevo ya tiene que tener 6 o más

### Qué protege y qué no
- El PIN **bloquea la pantalla**; **no cifra los datos** de IndexedDB (días, contabilidad, bitácora, cuadrante). Quien tenga acceso al navegador desbloqueado del móvil puede leerlos. Protege también el móvil con su propio bloqueo
- Lo único que se cifra con el PIN es el **token de GitHub del administrador** (ver abajo)

### Desbloqueo con el móvil

- El móvil verifica la huella, la cara o su código mediante WebAuthn. CalGuard solo guarda la clave pública, el identificador y su vínculo con el PIN de CalGuard, y verifica la firma localmente.
- El acceso abre la pantalla. El token de GitHub requiere el PIN de CalGuard para descifrarse.
- Se activa con el PIN vigente y queda fuera de las copias de seguridad. Si cambias o quitas el PIN, o eliminas la credencial del móvil, podrás volver a usar el PIN si sigue configurado.

### Recomendaciones
- Activar auto-bloqueo a 2-5 minutos en entornos compartidos

## Token de GitHub del administrador

- Se guarda en IndexedDB (`config` → `ghPublish`) **cifrado con AES-GCM de 256 bits**: `{ owner, repo, branch, lastPublishedAt, tokenEnc: { v: 1, data: base64(iv + texto cifrado) } }`. El token **nunca** se guarda en claro
- La clave se deriva del PIN con **PBKDF2** (600.000 iteraciones, SHA-256) y una **sal aleatoria de 16 bytes** propia de este móvil (`config` → `secretSalt`). Es **no exportable** y solo vive **en memoria** mientras la app está desbloqueada; se olvida al bloquear (`js/persistence/vaultSession.js`)
- **El modo administrador exige PIN.** Si no hay PIN, al guardar el token (o al publicar) la app pide crear uno
- **Migración**: un token antiguo en claro se cifra en el **primer desbloqueo** tras actualizar. Se comprueba que el cifrado se descifra bien antes de sustituirlo; si algo falla, el token antiguo se deja como estaba y se reintenta en el siguiente desbloqueo. Un administrador antiguo **sin PIN** sigue viendo «Publicar»; al publicar se le pide crear el PIN y el token se cifra en ese momento
- **Cambiar el PIN** genera una sal nueva y vuelve a cifrar el token. **Quitar el PIN** borra el token y su sal (hay que volver a pegarlo)
- `ghPublish`, `secretSalt` y `groupKey` (contraseña del grupo) **nunca van en las copias** ni se restauran desde una copia (`SECRET_CONFIG_KEYS` en `js/persistence/backup.js`)
- Pruebas: `tests/tokenVault.test.js` (cifrado) y `tests/vaultSession.test.js` (migración, cambio de PIN, fallo de migración)

## Almacenamiento persistente

Al arrancar, la app llama a `navigator.storage.persist()` para que el navegador no borre los datos cuando le falte espacio. El navegador puede decir que no; la app funciona igual

## Cifrado (Modo Seguro)

### Backup cifrado
- **Algoritmo**: AES-GCM con clave de 256 bits
- **Derivación de clave**: PBKDF2 con 600.000 iteraciones y salt aleatorio de 16 bytes
- **IV**: 12 bytes aleatorios por cifrado
- **Formato**: base64(salt + iv + ciphertext)
- La contraseña **no se almacena** en ningún lugar

### Uso
1. En Ajustes → Copia de seguridad, marca «Proteger con contraseña» y pulsa «Guardar copia»
2. Introduce una contraseña fuerte (mínimo 8 caracteres)
3. El archivo descargado contiene los datos cifrados
4. Para restaurar: importar y proporcionar la misma contraseña

## Datos sensibles

### Política por defecto
- La app NO almacena datos personales sensibles (PII)
- Los servicios de la bitácora usan campos genéricos (municipio, tipo de servicio)
- Se muestra una advertencia al crear servicios: "No introducir nombres, DNI, direcciones exactas"

### Marcado SENSIBLE
- Si el usuario decide registrar datos más específicos, puede marcar un servicio como "SENSIBLE"
- Los servicios sensibles se excluyen de las exportaciones CSV
- En un futuro, el Modo Seguro cifrará estos campos en reposo

## Recomendaciones operativas

1. **No compartir el dispositivo** sin bloqueo por PIN
2. **Realizar backups periódicos** (semanales recomendado)
3. **Usar backup cifrado** si se transfiere a otro dispositivo
4. **No introducir**:
   - Nombres de víctimas, testigos o imputados
   - Números de atestado
   - Direcciones exactas de domicilios
   - DNI, pasaportes u otros identificadores
5. **Borrar datos** antes de entregar/reciclar el dispositivo (Ajustes → Avanzado → Borrar todos los datos; hay que escribir BORRAR)

## Auditoría

Todas las acciones relevantes se registran en el store `audit`:
- Creación/modificación de tags en días
- Movimientos del ledger
- Creación de servicios
- Migración de datos

El log de auditoría no contiene datos sensibles, solo referencias (fechas, tipos).
