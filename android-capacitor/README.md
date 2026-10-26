# Cliente Android — preparación de Capacitor y Firebase

**Importante:** esta carpeta es una guía, no un APK. La recepción real de push requiere proyecto Firebase, `google-services.json` privado y compilación con Android Studio. No se adjuntan secretos.

1. Abrir `frontend`; usar Node 20+ y ejecutar `npm ci`, `npm run build`.
2. Instalar dependencias del cliente Android: `npm install @capacitor/core @capacitor/android @capacitor/push-notifications`; para desarrollo `npm install -D @capacitor/cli`.
3. Configurar `capacitor.config.ts` (ejemplo en esta carpeta) en `frontend/`; `npx cap add android` y `npx cap sync android`.
4. Registrar una aplicación Android en Firebase con el identificador `com.sismoia.enterprise`; obtener `google-services.json` desde Firebase, almacenarlo localmente en `frontend/android/app/` **sin subirlo al repositorio**.
5. Seguir la documentación oficial de Capacitor Push Notifications y Firebase para el plugin Gradle de Google Services y el canal Android `sismoia_informativos` con importancia HIGH, sonido predeterminado y vibración.
6. Solicitar permiso `POST_NOTIFICATIONS` en Android 13+ e invocar `PushNotifications.requestPermissions()` después de un gesto del usuario. Con la app instalada, registrar el token de FCM mediante `POST /api/v1/alerts/devices` usando JWT válido.
7. Configurar `FIREBASE_CREDENTIALS_PATH` del backend con una cuenta de servicio guardada **fuera del repositorio** y `PUSH_ENABLED=true` solo después de revisar la seguridad y probar con dispositivos autorizados.
8. Hacer pruebas físicas en Android con app cerrada, modo silencio, No molestar y sin conexión. El sonido no está garantizado ni puede superar preferencias del usuario.

No utilizar como sistema de alerta sísmica temprana ni para decisiones de seguridad. FCM confirma aceptación, no recepción.
