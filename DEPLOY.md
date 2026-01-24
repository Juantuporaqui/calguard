# 🚀 Guía de Despliegue en Netlify

## Paso 1: Crear Cuenta en Netlify

1. Ve a: **https://app.netlify.com/signup**
2. Haz clic en **"Sign up with GitHub"**
3. Autoriza a Netlify para acceder a tu cuenta de GitHub

## Paso 2: Crear Nuevo Sitio

1. Una vez dentro de Netlify, haz clic en **"Add new site"**
2. Selecciona **"Import an existing project"**
3. Haz clic en **"GitHub"**
4. Busca y selecciona tu repositorio: **`calguard`**

## Paso 3: Configurar el Deploy

En la pantalla de configuración:

### Branch to deploy:
```
claude/refactor-app-spectacular-HoCmc
```
(O `main` si ya hiciste el merge)

### Build command:
```
(dejar vacío)
```

### Publish directory:
```
.
```
(solo un punto)

### Build settings (avanzadas - opcional):
Haz clic en **"Show advanced"** y añade:

- **Environment variables**: (ninguna necesaria por ahora)

## Paso 4: Deploy!

1. Haz clic en **"Deploy [nombre-del-sitio]"**
2. Espera 1-2 minutos mientras se despliega
3. ¡Listo! Tu app estará en: `https://[nombre-random].netlify.app`

## Paso 5: Personalizar el Dominio (Opcional pero Recomendado)

1. En Netlify, ve a **"Site settings"**
2. Haz clic en **"Change site name"**
3. Escribe: **`calguard`** (si está disponible)
4. Tu nueva URL será: **`https://calguard.netlify.app`**

## Paso 6: Configurar Deploy Automático

¡Ya está configurado! Cada vez que hagas push a la rama:
- Se desplegará automáticamente
- Recibirás un email de confirmación
- Puedes ver el progreso en tiempo real

## 🎯 URLs Útiles Después del Deploy

### Tu Aplicación:
```
https://calguard.netlify.app
```

### Panel de Netlify:
```
https://app.netlify.com/sites/calguard/overview
```

### Ver Deploys:
```
https://app.netlify.com/sites/calguard/deploys
```

## ✅ Verificaciones Post-Deploy

Una vez desplegada, verifica:

- [ ] La app carga correctamente
- [ ] El modo oscuro funciona
- [ ] El calendario se muestra
- [ ] IndexedDB funciona (marca una guardia y recarga)
- [ ] Se puede instalar como PWA (botón "Instalar")
- [ ] Service Worker funciona offline

## 🔧 Troubleshooting

### Error: "Failed to load resource"
- **Solución**: Verifica que los paths en HTML sean correctos
- Los paths deben empezar con `/` o ser relativos

### Error: Service Worker no carga
- **Solución**: Asegúrate de que estás en HTTPS (Netlify usa HTTPS automáticamente)
- Limpia la caché del navegador

### Error: Iconos no se muestran
- **Solución**: Genera los iconos usando `icons/generate-placeholder.html`
- O temporalmente comenta las referencias en `manifest.webmanifest`

## 📱 Instalar como PWA

### En Chrome/Edge (Escritorio):
1. Abre tu app en Netlify
2. Haz clic en el ícono de instalar (⊕) en la barra de direcciones
3. Haz clic en "Instalar"

### En Chrome/Safari (Móvil):
1. Abre tu app en el navegador
2. Toca el menú (⋮ o compartir)
3. Selecciona "Agregar a la pantalla de inicio"
4. Toca "Agregar"

## 🎨 Siguientes Pasos

1. **Generar Iconos Reales**:
   - Abre `icons/generate-placeholder.html` en tu navegador
   - Descarga todos los tamaños
   - Súbelos a GitHub en la carpeta `/icons/`

2. **Dominio Personalizado** (Opcional):
   - Compra un dominio en Namecheap, Google Domains, etc.
   - En Netlify: Site settings → Domain management → Add custom domain

3. **Analytics** (Opcional):
   - En Netlify: Site settings → Build & deploy → Post processing
   - Activa "Netlify Analytics" (pago) o integra Google Analytics

---

**¡Felicidades! Tu app CalGuard está en producción! 🎉**
