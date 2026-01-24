# CalGuard - Calendario de Guardias

> Aplicación PWA moderna para gestionar guardias, días libres, asuntos propios y vacaciones

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Características Principales

- Calendario anual interactivo y dinámico
- Gestión de guardias y días libres
- Control de asuntos propios y vacaciones
- Modo oscuro automático y manual
- Exportación de datos (JSON y CSV)
- Funciona 100% offline (PWA)
- Responsive design para móvil y escritorio
- Almacenamiento local con IndexedDB
- Notificaciones y recordatorios
- Integración con WhatsApp para envío de solicitudes

## Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3 (Variables CSS, Grid, Flexbox)
- **JavaScript**: ES6+ Modules
- **Storage**: IndexedDB
- **PWA**: Service Worker, Web Manifest
- **Arquitectura**: Modular (MVC pattern)

## Instalación

### Opción 1: Servidor Local

```bash
# Clona el repositorio
git clone https://github.com/tu-usuario/calguard.git
cd calguard

# Sirve la aplicación (con cualquier servidor HTTP)
python -m http.server 8000
# o
npx serve

# Abre en el navegador
http://localhost:8000
```

### Opción 2: PWA (Instalar en dispositivo)

1. Abre la aplicación en un navegador compatible
2. Haz clic en el botón "Instalar" o en el menú del navegador
3. La aplicación se instalará como app nativa

## Uso

### Marcar Guardias

1. Haz clic en cualquier día del calendario
2. Selecciona "Guardia" del menú
3. Se marcará toda la semana automáticamente
4. Se generarán días libres según la configuración

### Solicitar Días Libres

1. Haz clic en un día
2. Selecciona "Pedir Días"
3. Selecciona los días que deseas librar
4. Haz clic en "Confirmar Selección"
5. Opcionalmente envía la solicitud por WhatsApp

### Marcar Vacaciones

1. Haz clic en el día de inicio
2. Selecciona "Vacaciones"
3. Haz clic en el día de fin
4. Confirma los días a descontar

### Configuración

Accede al menú de configuración (⚙️) para ajustar:

- Asuntos propios anuales
- Días por guardia
- Vacaciones anuales
- Días extra

### Modo Oscuro

- Haz clic en el botón de luna/sol (🌙/☀️) en la esquina superior
- El tema se guarda automáticamente
- Se adapta a la preferencia del sistema

### Exportar Datos

1. Haz clic en el botón de exportación (📥)
2. Selecciona formato:
   - **JSON**: Backup completo de la aplicación
   - **CSV**: Registro de días en formato tabla

## Estructura del Proyecto

```
calguard/
├── index.html              # Página principal
├── manifest.webmanifest    # Configuración PWA
├── service-worker.js       # Service Worker para offline
├── css/
│   └── styles.css         # Estilos con tema claro/oscuro
├── scripts/
│   ├── calendar.js        # Generación del calendario
│   ├── events.js          # Lógica de eventos
│   ├── db.js              # Gestión de IndexedDB
│   └── utils.js           # Funciones utilitarias
└── icons/                 # Iconos de la PWA
```

## Arquitectura

### Módulos

- **calendar.js**: Gestión del calendario (generación, navegación)
- **events.js**: Lógica de negocio (guardias, vacaciones, etc.)
- **db.js**: Persistencia con IndexedDB
- **utils.js**: Utilidades (tema, exportación, validación)

### Flujo de Datos

```
Usuario → Events.js → DB.js → IndexedDB
                ↓
           Calendar.js
                ↓
             Vista HTML
```

## Características Avanzadas

### PWA (Progressive Web App)

- Instalable en cualquier dispositivo
- Funciona 100% offline
- Sincronización en segundo plano
- Notificaciones push
- Actualizaciones automáticas

### Accesibilidad

- Navegación por teclado completa
- ARIA labels y roles
- Contraste adecuado (WCAG AA)
- Soporte para lectores de pantalla
- Reducción de movimiento (prefers-reduced-motion)

### Rendimiento

- Lazy loading de módulos
- Service Worker optimizado
- CSS Grid para layouts eficientes
- Minimal reflows y repaints

## Compatibilidad

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+
- Navegadores móviles modernos

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Roadmap

- [ ] Sincronización con Google Calendar
- [ ] Exportación a PDF
- [ ] Temas personalizables
- [ ] Estadísticas y gráficos
- [ ] Compartir calendario
- [ ] Múltiples calendarios
- [ ] Backend opcional para sync entre dispositivos

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Autor

**Tu Nombre**
- GitHub: [@tu-usuario](https://github.com/tu-usuario)

## Agradecimientos

- Diseño inspirado en Material Design y Neumorphism
- Iconos de Emoji Unicode
- Comunidad de desarrolladores PWA

---

**Hecho con ❤️ para facilitar la gestión de guardias y días libres**
