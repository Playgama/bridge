#!/usr/bin/env node
/**
 * android-setup.js  — часть bridge (EdikN/bridge)
 *
 * Полная автоматизация сборки Android для проектов на Playgama Bridge + Capacitor.
 * Запускать из корня любого игрового проекта, либо передавать путь аргументом.
 *
 * Использование:
 *   node /path/to/bridge/scripts/android-setup.js [путь_к_проекту] [флаги]
 *   npm run android:setup -- [путь_к_проекту] [флаги]   (из папки bridge)
 *
 * Флаги:
 *   --release      собрать release APK (по умолчанию debug)
 *   --install      установить APK на подключённый девайс после сборки
 *   --skip-build   пропустить npm build + cap sync (если уже сделан)
 *   --skip-gradle  пропустить Gradle сборку
 *
 * Переменные окружения (машино-специфичные настройки):
 *   JAVA_HOME         — путь к JDK 17+  (автодетект если не задан)
 *   ANDROID_HOME      — путь к Android SDK  (автодетект если не задан)
 *   ANDROID_SDK_ROOT  — альтернатива ANDROID_HOME
 */

'use strict';

const { execSync } = require('child_process');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const https = require('https');

// ─── Константы ────────────────────────────────────────────────────────────
const BRIDGE_DIR         = path.resolve(__dirname, '..');   // корень bridge-репозитория
const YANDEX_SDK_VERSION = '7.18.6';
const APPMETRICA_VERSION = '7.14.3';

// ─── Аргументы командной строки ───────────────────────────────────────────
const args        = process.argv.slice(2);
const PROJECT     = path.resolve(args.find(a => !a.startsWith('--')) || process.cwd());
const IS_RELEASE  = args.includes('--release');
const DO_INSTALL  = args.includes('--install');
const SKIP_BUILD  = args.includes('--skip-build');
const SKIP_GRADLE = args.includes('--skip-gradle');

// ─── Автодетект инструментов ──────────────────────────────────────────────
function detectJdk() {
    // 1. Из окружения
    if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

    // 2. Типичные пути Windows
    const winRoots = [
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Java',
        'C:\\Program Files\\Microsoft',
    ];
    for (const root of winRoots) {
        if (!fs.existsSync(root)) continue;
        const dirs = fs.readdirSync(root)
            .filter(d => /jdk.*(17|18|19|20|21|22|23|24|25)/i.test(d))
            .sort().reverse();
        if (dirs.length) return path.join(root, dirs[0]);
    }

    // 3. Домашняя папка пользователя (наш скачанный JDK)
    const userJdkDir = path.join(os.homedir(), 'jdk-21');
    if (fs.existsSync(userJdkDir)) {
        const sub = fs.readdirSync(userJdkDir)[0];
        if (sub) return path.join(userJdkDir, sub);
    }

    // 4. macOS
    try {
        const out = execSync('/usr/libexec/java_home -v 17+', { encoding: 'utf8', stdio: 'pipe' });
        if (out.trim()) return out.trim();
    } catch {}

    return null;
}

function detectAndroidSdk() {
    // 1. Из окружения
    const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

    // 2. local.properties текущего проекта
    const localProps = path.join(PROJECT, 'android', 'local.properties');
    if (fs.existsSync(localProps)) {
        const m = fs.readFileSync(localProps, 'utf8').match(/sdk\.dir=(.+)/);
        if (m) {
            const p = m[1].trim().replace(/\\\\/g, '\\');
            if (fs.existsSync(p)) return p;
        }
    }

    // 3. Стандартные пути
    const candidates = [
        path.join(os.homedir(), 'Android', 'Sdk'),
        path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
        'C:\\Users\\Eduard\\Android\\Sdk',
        path.join(os.homedir(), 'Library', 'Android', 'sdk'),  // macOS
        path.join(os.homedir(), 'Android', 'sdk'),              // Linux
    ];
    for (const p of candidates) {
        if (fs.existsSync(path.join(p, 'platform-tools'))) return p;
    }

    return null;
}

const JDK = detectJdk();
const SDK = detectAndroidSdk();

// ─── Вспомогательные функции ──────────────────────────────────────────────
const clr = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
const log   = msg => console.log(`${clr.cyan}▶${clr.reset} ${msg}`);
const ok    = msg => console.log(`${clr.green}✓${clr.reset} ${msg}`);
const warn  = msg => console.log(`${clr.yellow}⚠${clr.reset} ${msg}`);
const fail  = msg => { console.error(`${clr.red}✗ ${msg}${clr.reset}`); process.exit(1); };
const title = msg => console.log(`\n${clr.bold}${clr.cyan}═══ ${msg} ═══${clr.reset}`);

function buildEnv() {
    const env = { ...process.env };
    if (JDK) {
        env.JAVA_HOME = JDK;
        env.PATH = `${path.join(JDK, 'bin')}${path.delimiter}${env.PATH}`;
    }
    if (SDK) {
        env.ANDROID_HOME = SDK;
        env.ANDROID_SDK_ROOT = SDK;
        env.PATH = `${path.join(SDK, 'platform-tools')}${path.delimiter}${env.PATH}`;
    }
    return env;
}

function run(cmd, cwd = PROJECT, silent = false) {
    try {
        return execSync(cmd, {
            cwd,
            env: buildEnv(),
            stdio: silent ? 'pipe' : 'inherit',
            encoding: 'utf8',
        }) || '';
    } catch (e) {
        if (silent) return '';
        throw e;
    }
}

function write(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function patchLine(content, regex, replacement) {
    return regex.test(content) ? content.replace(regex, replacement) : `${replacement}\n${content}`;
}

// ─── ШАГ 1: Проверка проекта ──────────────────────────────────────────────
function checkProject() {
    title('Проверка проекта');
    if (!fs.existsSync(path.join(PROJECT, 'package.json'))) fail(`Не найден package.json в ${PROJECT}`);

    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT, 'package.json'), 'utf8'));
    ok(`Проект: ${pkg.name || path.basename(PROJECT)}`);

    if (!fs.existsSync(path.join(PROJECT, 'capacitor.config.json'))) {
        fail('Не найден capacitor.config.json — проект не является Capacitor-проектом');
    }

    if (!fs.existsSync(path.join(PROJECT, 'android'))) {
        log('Папка android/ не найдена, добавляю платформу...');
        run('npx cap add android');
        ok('Платформа android добавлена');
    } else {
        ok('Платформа android уже есть');
    }

    if (!JDK) fail('JDK 17+ не найден. Установите JDK или задайте JAVA_HOME');
    ok(`JDK: ${JDK}`);

    if (!SDK) fail('Android SDK не найден. Установите Android Studio или задайте ANDROID_HOME');
    ok(`Android SDK: ${SDK}`);

    return pkg;
}

// ─── ШАГ 2: npm install ───────────────────────────────────────────────────
function npmInstall() {
    title('Установка зависимостей');
    if (!fs.existsSync(path.join(PROJECT, 'node_modules'))) {
        log('Запускаю npm install...');
        run('npm install');
        ok('npm install завершён');
    } else {
        ok('node_modules уже существует');
    }
}

// ─── ШАГ 3: Пересборка playgama-bridge.js для Android ────────────────────
function rebuildBridge() {
    title('Сборка playgama-bridge.js (Android)');
    const projectPublic = path.join(PROJECT, 'public', 'playgama-bridge.js');

    if (fs.existsSync(projectPublic)) {
        const content = fs.readFileSync(projectPublic, 'utf8');
        if (content.includes('isNativePlatform')) {
            ok('playgama-bridge.js уже содержит Android-детекцию');
            return;
        }
    }

    log('Устанавливаю зависимости bridge...');
    if (!fs.existsSync(path.join(BRIDGE_DIR, 'node_modules'))) {
        run('npm install', BRIDGE_DIR);
    }

    log('Собираю bridge с поддержкой Android...');
    run('npx webpack --config-name platform --env platform=android --env noLint=true', BRIDGE_DIR);

    const bridgeDist = path.join(BRIDGE_DIR, 'dist', 'playgama-bridge.js');
    if (!fs.existsSync(bridgeDist)) fail('Сборка bridge не удалась');

    fs.mkdirSync(path.join(PROJECT, 'public'), { recursive: true });
    fs.copyFileSync(bridgeDist, projectPublic);
    ok('playgama-bridge.js скопирован в public/');
}

// ─── ШАГ 4: Vite build ────────────────────────────────────────────────────
function buildWeb() {
    if (SKIP_BUILD) { warn('Пропускаю npm run build (--skip-build)'); return; }
    title('Сборка веб-приложения');
    run('npm run build');
    ok('Веб-сборка завершена');
}

// ─── ШАГ 5: cap sync ─────────────────────────────────────────────────────
function capSync() {
    if (SKIP_BUILD) { warn('Пропускаю cap sync (--skip-build)'); return; }
    title('Capacitor sync');
    run('npx cap sync android');
    ok('cap sync завершён');
}

// ─── ШАГ 6: Патч Yandex плагина ──────────────────────────────────────────
function patchYandexPlugin() {
    title('Патч Yandex Mobile Ads плагина');

    const pluginDir = path.join(PROJECT, 'node_modules', 'capacitor-plugin-yandex-mobile-ads', 'android');
    if (!fs.existsSync(pluginDir)) {
        warn('capacitor-plugin-yandex-mobile-ads не найден в node_modules, пропускаю');
        return;
    }

    // build.gradle — версия SDK
    const buildGradle = path.join(pluginDir, 'build.gradle');
    if (fs.existsSync(buildGradle)) {
        let content = fs.readFileSync(buildGradle, 'utf8');
        const match = content.match(/com\.yandex\.android:mobileads:([\d.]+)/);
        const current = match?.[1];
        if (current && current !== YANDEX_SDK_VERSION) {
            content = content.replace(
                /com\.yandex\.android:mobileads:[\d.]+/,
                `com.yandex.android:mobileads:${YANDEX_SDK_VERSION}`,
            );
            fs.writeFileSync(buildGradle, content, 'utf8');
            ok(`Yandex SDK: ${current} → ${YANDEX_SDK_VERSION}`);
        } else {
            ok(`Yandex SDK уже ${YANDEX_SDK_VERSION}`);
        }

        // AppMetrica — analytics for the native build. Declared here rather than
        // relied upon transitively: the ads SDK may or may not pull it in
        // depending on version, and the manager references its classes directly.
        content = fs.readFileSync(buildGradle, 'utf8');
        if (!content.includes('io.appmetrica.analytics:analytics')) {
            content = content.replace(
                /(implementation 'com\.yandex\.android:mobileads:[\d.]+')/,
                `$1\n    implementation 'io.appmetrica.analytics:analytics:${APPMETRICA_VERSION}'`,
            );
            fs.writeFileSync(buildGradle, content, 'utf8');
            ok(`AppMetrica ${APPMETRICA_VERSION} добавлена в зависимости плагина`);
        } else {
            ok('AppMetrica уже в зависимостях плагина');
        }
    }

    // YandexMobileAdsManager.kt — баннер 10%/90%
    const managerKt = path.join(
        pluginDir, 'src', 'main', 'java', 'com', 'playgama', 'yandexads', 'YandexMobileAdsManager.kt',
    );
    if (fs.existsSync(managerKt)) {
        // Marker tracks the NEWEST edit in the template, so an older patched
        // copy is still recognised as stale and gets rewritten.
        const content = fs.readFileSync(managerKt, 'utf8');
        if (!content.includes('AppMetrica.activate')) {
            write(managerKt, YANDEX_MANAGER_KT);
            ok('YandexMobileAdsManager.kt обновлён (баннер без серой полосы, AppMetrica)');
        } else {
            ok('YandexMobileAdsManager.kt уже обновлён');
        }
    }
}

// ─── ШАГ 7: gradle.properties ────────────────────────────────────────────
function fixGradleProperties() {
    title('Настройка gradle.properties');
    const gradleProps = path.join(PROJECT, 'android', 'gradle.properties');
    if (!fs.existsSync(gradleProps)) { warn('gradle.properties не найден'); return; }

    let content = fs.readFileSync(gradleProps, 'utf8');
    let changed = false;

    // JDK путь
    if (JDK) {
        const jdkEscaped = JDK.replace(/\\/g, '\\\\');
        const jdkLine = `org.gradle.java.home=${jdkEscaped}`;
        if (!content.includes(jdkEscaped)) {
            content = patchLine(content, /org\.gradle\.java\.home=.+/, jdkLine);
            changed = true;
        }
    }

    // Отключаем SOCKS proxy если не запущен (ломает Maven загрузку)
    if (/^systemProp\.socksProxyHost=/m.test(content) && !/^#systemProp\.socksProxyHost=/m.test(content)) {
        content = content
            .replace(/^systemProp\.socksProxyHost=/m, '#systemProp.socksProxyHost=')
            .replace(/^systemProp\.socksProxyPort=/m, '#systemProp.socksProxyPort=')
            .replace(/^systemProp\.http\.nonProxyHosts=/m, '#systemProp.http.nonProxyHosts=');
        changed = true;
    }

    if (changed) { fs.writeFileSync(gradleProps, content, 'utf8'); ok('gradle.properties обновлён'); }
    else ok('gradle.properties уже корректен');
}

// ─── ШАГ 8: local.properties ─────────────────────────────────────────────
function createLocalProperties() {
    title('local.properties');
    const localProps = path.join(PROJECT, 'android', 'local.properties');
    const sdkEscaped = SDK.replace(/\\/g, '\\\\');

    if (!fs.existsSync(localProps) || !fs.readFileSync(localProps, 'utf8').includes(sdkEscaped)) {
        write(localProps, `## Автогенерировано android-setup.js — не коммитить!\nsdk.dir=${sdkEscaped}\n`);
        ok('local.properties создан');
    } else {
        ok('local.properties уже корректен');
    }
}

// ─── ШАГ 9: MainActivity.java — fullscreen ───────────────────────────────
function fixMainActivity() {
    title('MainActivity.java (fullscreen)');
    const capCfg = JSON.parse(fs.readFileSync(path.join(PROJECT, 'capacitor.config.json'), 'utf8'));
    const appId = capCfg.appId;
    if (!appId) { warn('appId не задан в capacitor.config.json'); return; }

    const javaPath = path.join(PROJECT, 'android', 'app', 'src', 'main', 'java',
        ...appId.split('.'), 'MainActivity.java');

    if (!fs.existsSync(javaPath)) { warn(`MainActivity.java не найден: ${javaPath}`); return; }

    const existing = fs.readFileSync(javaPath, 'utf8');
    if (existing.includes('WindowInsetsControllerCompat')) {
        ok('MainActivity.java уже настроен');
        return;
    }

    write(javaPath, MAIN_ACTIVITY_JAVA.replace(/\{\{PACKAGE\}\}/g, appId));
    ok('MainActivity.java обновлён (fullscreen + hide system bars)');
}

// ─── ШАГ 10: styles.xml ──────────────────────────────────────────────────
function fixStyles() {
    title('styles.xml');
    const stylesPath = path.join(PROJECT, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');
    if (!fs.existsSync(stylesPath)) { warn('styles.xml не найден'); return; }

    let content = fs.readFileSync(stylesPath, 'utf8');
    if (content.includes('android:windowFullscreen')) { ok('styles.xml уже настроен'); return; }

    content = content.replace(
        /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
        `$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>`,
    );
    fs.writeFileSync(stylesPath, content, 'utf8');
    ok('styles.xml обновлён');
}

// ─── ШАГ 11: Gradle distribution ─────────────────────────────────────────
async function ensureGradle() {
    title('Проверка Gradle');

    const wrapperProps = path.join(PROJECT, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
    if (!fs.existsSync(wrapperProps)) { warn('gradle-wrapper.properties не найден'); return; }

    const content = fs.readFileSync(wrapperProps, 'utf8');
    const m = content.match(/gradle-([\d.]+)-(\w+)\.zip/);
    if (!m) { warn('Версия Gradle не определена'); return; }

    const [, version, type] = m;
    const distsDir = path.join(os.homedir(), '.gradle', 'wrapper', 'dists');
    const versionDir = path.join(distsDir, `gradle-${version}-${type}`);

    // Проверяем есть ли уже скачанный zip (без .part файла)
    if (fs.existsSync(versionDir)) {
        const subdirs = fs.readdirSync(versionDir);
        for (const sub of subdirs) {
            const zip = path.join(versionDir, sub, `gradle-${version}-${type}.zip`);
            const part = zip + '.part';
            if (fs.existsSync(zip) && !fs.existsSync(part)) {
                ok(`Gradle ${version} уже скачан`);
                return;
            }
            // Удаляем битый .part файл
            if (fs.existsSync(part)) fs.unlinkSync(part);
        }
    }

    log(`Gradle ${version} не найден, скачиваю...`);
    const tmpDir = path.join(versionDir, Math.random().toString(36).slice(2, 12));
    fs.mkdirSync(tmpDir, { recursive: true });
    const dest = path.join(tmpDir, `gradle-${version}-${type}.zip`);
    await downloadFile(`https://services.gradle.org/distributions/gradle-${version}-${type}.zip`, dest);
    ok(`Gradle ${version} скачан`);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const get = u => https.get(u, res => {
            if (res.statusCode === 301 || res.statusCode === 302) { get(res.headers.location); return; }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', e => { fs.unlink(dest, () => {}); reject(e); });
        get(url);
    });
}

// ─── ШАГ 12: Gradle build ────────────────────────────────────────────────
function buildApk() {
    if (SKIP_GRADLE) { warn('Пропускаю Gradle build (--skip-gradle)'); return null; }
    title(`Gradle: ${IS_RELEASE ? 'assembleRelease' : 'assembleDebug'}`);

    const gradlew = path.join(PROJECT, 'android', os.platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
    const task = IS_RELEASE ? 'assembleRelease' : 'assembleDebug';
    run(`"${gradlew}" ${task}`, path.join(PROJECT, 'android'));

    const apkDir = path.join(PROJECT, 'android', 'app', 'build', 'outputs', 'apk',
        IS_RELEASE ? 'release' : 'debug');
    const apks = fs.existsSync(apkDir) ? fs.readdirSync(apkDir).filter(f => f.endsWith('.apk')) : [];
    if (!apks.length) fail('APK не найден после сборки');

    const apkPath = path.join(apkDir, apks[0]);
    ok(`APK: ${apkPath}`);
    return apkPath;
}

// ─── ШАГ 13: ADB install ─────────────────────────────────────────────────
function adbInstall(apkPath) {
    if (!DO_INSTALL || !apkPath) return;
    title('ADB: установка на устройство');

    const adb = path.join(SDK, 'platform-tools', os.platform() === 'win32' ? 'adb.exe' : 'adb');
    if (!fs.existsSync(adb)) { warn('adb не найден'); return; }

    const devices = run(`"${adb}" devices`, PROJECT, true);
    if (!devices.split('\n').slice(1).some(l => l.includes('\tdevice'))) {
        warn('Нет подключённых устройств'); return;
    }

    try {
        run(`"${adb}" install -r "${apkPath}"`, PROJECT);
    } catch {
        const { appId } = JSON.parse(fs.readFileSync(path.join(PROJECT, 'capacitor.config.json'), 'utf8'));
        run(`"${adb}" uninstall ${appId}`, PROJECT, true);
        run(`"${adb}" install "${apkPath}"`, PROJECT);
    }
    ok('APK установлен');

    try {
        const { appId } = JSON.parse(fs.readFileSync(path.join(PROJECT, 'capacitor.config.json'), 'utf8'));
        run(`"${adb}" shell am start -n ${appId}/.MainActivity`, PROJECT);
        ok('Приложение запущено');
    } catch {}
}

// ─── Шаблон: MainActivity.java ────────────────────────────────────────────
const MAIN_ACTIVITY_JAVA = `package {{PACKAGE}};

import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    private void hideSystemUI() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
    }
}
`;

// ─── Шаблон: YandexMobileAdsManager.kt ───────────────────────────────────
const YANDEX_MANAGER_KT = `package com.playgama.yandexads

import android.util.DisplayMetrics
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.getcapacitor.JSObject
import io.appmetrica.analytics.AppMetrica
import io.appmetrica.analytics.AppMetricaConfig
import com.yandex.mobile.ads.banner.BannerAdEventListener
import com.yandex.mobile.ads.banner.BannerAdSize
import com.yandex.mobile.ads.banner.BannerAdView
import com.yandex.mobile.ads.common.AdError
import com.yandex.mobile.ads.common.AdRequest
import com.yandex.mobile.ads.common.AdRequestConfiguration
import com.yandex.mobile.ads.common.AdRequestError
import com.yandex.mobile.ads.common.ImpressionData
import com.yandex.mobile.ads.common.MobileAds
import com.yandex.mobile.ads.interstitial.InterstitialAd
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader
import com.yandex.mobile.ads.rewarded.Reward
import com.yandex.mobile.ads.rewarded.RewardedAd
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoader

class YandexMobileAdsManager(
    private val activity: AppCompatActivity,
    private val plugin: YandexMobileAdsPlugin,
) {
    private val bannerViews = mutableMapOf<String, BannerAdView>()

    // AppMetrica is optional: without a key in playgama-bridge-config.json the
    // ads still work, there is simply no analytics. Activation goes first
    // because the ads SDK reports through AppMetrica when it is present.
    fun initialize(appMetricaKey: String?) {
        if (!appMetricaKey.isNullOrBlank()) {
            try {
                val config = AppMetricaConfig.newConfigBuilder(appMetricaKey).build()
                AppMetrica.activate(activity.applicationContext, config)
                // Sessions are counted from activity transitions; without this
                // every launch looks like one endless session.
                AppMetrica.enableActivityAutoTracking(activity.application)
            } catch (e: Exception) {
                // Analytics must never be the reason a game fails to start.
            }
        }
        MobileAds.initialize(activity) {}
    }

    fun showInterstitial(adUnitId: String, callback: (String?) -> Unit) {
        val loader = InterstitialAdLoader(activity)
        loader.setAdLoadListener(object : InterstitialAdLoadListener {
            override fun onAdLoaded(ad: InterstitialAd) {
                ad.setAdEventListener(object : InterstitialAdEventListener {
                    override fun onAdShown() { plugin.emit("interstitialOpened") }
                    override fun onAdFailedToShow(adError: AdError) {
                        plugin.emit("interstitialFailed", JSObject().put("error", adError.description))
                        callback(adError.description)
                    }
                    override fun onAdDismissed() {
                        plugin.emit("interstitialClosed")
                        ad.setAdEventListener(null)
                    }
                    override fun onAdClicked() {}
                    override fun onAdImpression(data: ImpressionData?) {}
                })
                activity.runOnUiThread { ad.show(activity) }
                callback(null)
            }
            override fun onAdFailedToLoad(error: AdRequestError) {
                plugin.emit("interstitialFailed", JSObject().put("error", error.description))
                callback(error.description)
            }
        })
        loader.loadAd(AdRequestConfiguration.Builder(adUnitId).build())
    }

    fun preloadInterstitial(adUnitId: String) {
        val loader = InterstitialAdLoader(activity)
        loader.setAdLoadListener(object : InterstitialAdLoadListener {
            override fun onAdLoaded(ad: InterstitialAd) {}
            override fun onAdFailedToLoad(error: AdRequestError) {}
        })
        loader.loadAd(AdRequestConfiguration.Builder(adUnitId).build())
    }

    fun showRewarded(adUnitId: String, callback: (String?) -> Unit) {
        val loader = RewardedAdLoader(activity)
        loader.setAdLoadListener(object : RewardedAdLoadListener {
            override fun onAdLoaded(ad: RewardedAd) {
                ad.setAdEventListener(object : RewardedAdEventListener {
                    override fun onAdShown() { plugin.emit("rewardedOpened") }
                    override fun onAdFailedToShow(adError: AdError) {
                        plugin.emit("rewardedFailed", JSObject().put("error", adError.description))
                        callback(adError.description)
                    }
                    override fun onAdDismissed() {
                        plugin.emit("rewardedClosed")
                        ad.setAdEventListener(null)
                    }
                    override fun onRewarded(reward: Reward) {
                        plugin.emit("userEarned", JSObject().put("type", reward.type).put("amount", reward.amount))
                    }
                    override fun onAdClicked() {}
                    override fun onAdImpression(data: ImpressionData?) {}
                })
                activity.runOnUiThread { ad.show(activity) }
                callback(null)
            }
            override fun onAdFailedToLoad(error: AdRequestError) {
                plugin.emit("rewardedFailed", JSObject().put("error", error.description))
                callback(error.description)
            }
        })
        loader.loadAd(AdRequestConfiguration.Builder(adUnitId).build())
    }

    fun preloadRewarded(adUnitId: String) {
        val loader = RewardedAdLoader(activity)
        loader.setAdLoadListener(object : RewardedAdLoadListener {
            override fun onAdLoaded(ad: RewardedAd) {}
            override fun onAdFailedToLoad(error: AdRequestError) {}
        })
        loader.loadAd(AdRequestConfiguration.Builder(adUnitId).build())
    }

    fun showBanner(adUnitId: String, position: String, callback: (String?) -> Unit) {
        activity.runOnUiThread {
            try {
                val metrics = DisplayMetrics()
                @Suppress("DEPRECATION")
                activity.windowManager.defaultDisplay.getMetrics(metrics)

                // Measure the container the banner is actually placed in, not
                // the display. getMetrics() reports the screen MINUS the system
                // bars, while a fullscreen activity's content view spans the
                // whole panel — so sizing the WebView by the former left a strip
                // of bare activity background between the game and the banner,
                // exactly as tall as the navigation bar that isn't there.
                val rootView = activity.window.decorView.findViewById<ViewGroup>(android.R.id.content)
                val screenHeightPx = if (rootView.height > 0) rootView.height else metrics.heightPixels
                val bannerHeightPx = (screenHeightPx * 0.10).toInt()
                val webViewHeightPx = screenHeightPx - bannerHeightPx

                val webView = plugin.bridge.webView
                val webViewParams = webView.layoutParams
                webViewParams.height = webViewHeightPx
                webView.layoutParams = webViewParams

                val widthDp = (metrics.widthPixels / metrics.density).toInt()
                val bannerAdView = BannerAdView(activity)
                // The ad rarely fills its slot to the pixel; a black backing
                // keeps whatever is left over reading as part of the frame
                // rather than as a grey seam.
                bannerAdView.setBackgroundColor(android.graphics.Color.BLACK)
                bannerAdView.setAdUnitId(adUnitId)
                bannerAdView.setAdSize(BannerAdSize.stickySize(activity, widthDp))
                bannerAdView.setBannerAdEventListener(object : BannerAdEventListener {
                    override fun onAdLoaded() {
                        plugin.emit("bannerShown")
                        callback(null)
                    }
                    override fun onAdFailedToLoad(error: AdRequestError) {
                        val wv = plugin.bridge.webView
                        val wvp = wv.layoutParams
                        wvp.height = ViewGroup.LayoutParams.MATCH_PARENT
                        wv.layoutParams = wvp
                        plugin.emit("bannerFailed", JSObject().put("error", error.description))
                        callback(error.description)
                    }
                    override fun onAdClicked() {}
                    override fun onLeftApplication() {}
                    override fun onReturnedToApplication() {}
                    override fun onImpression(data: ImpressionData?) {}
                })

                val gravity = if (position == "top") Gravity.TOP else Gravity.BOTTOM
                val params = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    bannerHeightPx,
                    gravity,
                )
                rootView.addView(bannerAdView, params)
                bannerAdView.loadAd(AdRequest.Builder().build())
                bannerViews[adUnitId] = bannerAdView
            } catch (e: Exception) {
                callback(e.message)
            }
        }
    }

    fun hideBanner(adUnitId: String) {
        activity.runOnUiThread {
            bannerViews.remove(adUnitId)?.let { view ->
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                plugin.emit("bannerHidden")
            }
            val webView = plugin.bridge.webView
            val webViewParams = webView.layoutParams
            webViewParams.height = ViewGroup.LayoutParams.MATCH_PARENT
            webView.layoutParams = webViewParams
        }
    }
}
`;

// ─── Запуск ───────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${clr.bold}${clr.green}Playgama Android Setup${clr.reset}  (bridge: ${BRIDGE_DIR})`);
    console.log(`Проект: ${clr.cyan}${PROJECT}${clr.reset}`);
    console.log(`Режим:  ${clr.cyan}${IS_RELEASE ? 'release' : 'debug'}${clr.reset}\n`);

    checkProject();
    npmInstall();
    rebuildBridge();
    buildWeb();
    capSync();
    patchYandexPlugin();
    fixGradleProperties();
    createLocalProperties();
    fixMainActivity();
    fixStyles();
    await ensureGradle();
    const apkPath = buildApk();
    adbInstall(apkPath);

    console.log(`\n${clr.bold}${clr.green}✓ Готово!${clr.reset}`);
    if (apkPath) {
        console.log(`APK: ${clr.cyan}${apkPath}${clr.reset}`);
        if (!DO_INSTALL) {
            const adb = path.join(SDK, 'platform-tools', os.platform() === 'win32' ? 'adb.exe' : 'adb');
            console.log(`\nУстановить:\n  ${clr.yellow}"${adb}" install "${apkPath}"${clr.reset}`);
        }
    }
}

main().catch(e => fail(e.message || String(e)));
