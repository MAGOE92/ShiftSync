// Native-Bridge (Capacitor): kapselt ALLES Plattform-Spezifische der
// iOS-/Android-Apps. Im Web-Build sind alle Funktionen harmlose No-ops,
// damit App.jsx keine Plattform-Weichen braucht.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

// StatusBar an Hell/Dunkel anpassen + Splash ausblenden (einmalig beim Start)
export async function initNativeShell(dark) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (platform === "android") {
      await StatusBar.setBackgroundColor({ color: dark ? "#0c0c0e" : "#f0f0ed" });
    }
  } catch { /* Plugin fehlt / Simulator ohne StatusBar */ }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch { /* ignore */ }
}

// Push-Registrierung nach Login. onToken(token, platform) speichert den
// Geräte-Token am Server (Gateway-Aktion register_push). onNotification
// (optional) wird bei angetippter Benachrichtigung gerufen.
export async function initPush(onToken, onNotification) {
  if (!isNative) return () => {};
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return () => {};

    const subs = [];
    subs.push(await PushNotifications.addListener("registration", t => {
      try { onToken?.(t.value, platform); } catch { /* Server nicht erreichbar → nächster Login */ }
    }));
    subs.push(await PushNotifications.addListener("pushNotificationActionPerformed", a => {
      try { onNotification?.(a.notification); } catch { /* ignore */ }
    }));
    await PushNotifications.register();

    return () => subs.forEach(s => s.remove?.());
  } catch {
    return () => {};
  }
}
