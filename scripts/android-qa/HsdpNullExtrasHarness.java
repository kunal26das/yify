import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipFile;
import javax.tools.ToolProvider;

class HsdpNullExtrasHarness {
    static final String ACTIVITY = "com.google.android.play.core.hsdp.service.HsdpShimActivity";
    static final Map<String, String> HASHES = Map.of(
        "2.0.1", "5e57065e411d985f4e4eb0cd028c617c3a5d3bf836d20fc524ec23a0df39af75",
        "2.2.0", "39e1e335b512c66b166fd6c74e360a480564541745c57ad4a89bdb581d0bdcdd"
    );

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Usage: java scripts/android-qa/HsdpNullExtrasHarness.java <directory-containing-hsdp-AARs>");
        Path temporary = Files.createTempDirectory("yify-hsdp-regression-");
        try {
            Path stubs = temporary.resolve("stubs");
            compileStubs(stubs);
            for (String version : List.of("2.0.1", "2.2.0")) {
                Path aar = Path.of(args[0], "hsdp-" + version + ".aar");
                String sha256 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(aar)));
                if (!HASHES.get(version).equals(sha256)) throw new AssertionError("Unexpected AAR bytes: " + version);
                Path jar = temporary.resolve("hsdp-" + version + ".jar");
                try (ZipFile archive = new ZipFile(aar.toFile())) {
                    Files.copy(archive.getInputStream(archive.getEntry("classes.jar")), jar);
                }
                try (URLClassLoader loader = new URLClassLoader(new URL[]{stubs.toUri().toURL(), jar.toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
                    run(loader, version);
                }
                System.out.println("Verified HSDP " + version + " AAR SHA-256 " + sha256);
            }
            System.out.println("PASS: unmodified HSDP bytecode on isolated JVM Android stubs; no Android device, Firebase, ads, or network services exercised.");
        } finally {
            try (var paths = Files.walk(temporary)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.delete(path);
            }
        }
    }

    static void run(ClassLoader loader, String version) throws Exception {
        Class<?> type = loader.loadClass(ACTIVITY);
        Class<?> intentType = loader.loadClass("android.content.Intent");
        Class<?> configType = loader.loadClass("android.content.res.Configuration");
        Class<?> bundleType = loader.loadClass("android.os.Bundle");
        boolean fixed = version.equals("2.2.0");
        for (String lifecycle : List.of("onAttachedToWindow", "onConfigurationChanged", "onNewIntent")) {
            Object activity = type.getConstructor().newInstance();
            Object intent = intentType.getConstructor().newInstance();
            intentType.getMethod("putExtra", String.class, String.class).invoke(intent, "referrer", "local-regression");
            intentType.getMethod("putExtra", String.class, String.class).invoke(intent, "deeplink_url", "https://example.invalid/test");
            type.getMethod("setIntent", intentType).invoke(activity, intent);
            Method method = switch (lifecycle) {
                case "onConfigurationChanged" -> type.getDeclaredMethod(lifecycle, configType);
                case "onNewIntent" -> type.getDeclaredMethod(lifecycle, intentType);
                default -> type.getDeclaredMethod(lifecycle);
            };
            method.setAccessible(true);
            Object[] parameters = switch (lifecycle) {
                case "onConfigurationChanged" -> new Object[]{configType.getConstructor().newInstance()};
                case "onNewIntent" -> new Object[]{intent};
                default -> new Object[]{};
            };
            Throwable error = invoke(method, activity, parameters);
            if (!fixed) {
                if (!(error instanceof IllegalStateException) || !"targetPackageName is null".equals(error.getMessage())) {
                    throw new AssertionError(version + " " + lifecycle + " did not reproduce targetPackageName failure", error);
                }
            } else {
                if (error != null || !(boolean) type.getMethod("isFinishing").invoke(activity)) {
                    throw new AssertionError(version + " " + lifecycle + " did not finish safely", error);
                }
                if (invoke(method, activity, parameters) != null) throw new AssertionError("Repeated lifecycle failed");
            }
            System.out.println("PASS " + version + " " + lifecycle + " missing target_package_name: " + (fixed ? "finished safely; repeated call safe" : "expected IllegalStateException reproduced"));
        }
        if (fixed) {
            for (boolean nullIntent : List.of(false, true)) {
                Object activity = type.getConstructor().newInstance();
                Object intent = nullIntent ? null : intentType.getConstructor().newInstance();
                type.getMethod("setIntent", intentType).invoke(activity, intent);
                Method method = type.getDeclaredMethod("onCreate", bundleType);
                method.setAccessible(true);
                Throwable error = invoke(method, activity, new Object[]{null});
                if (error != null || !(boolean) type.getMethod("isFinishing").invoke(activity)) {
                    throw new AssertionError("onCreate did not finish for " + (nullIntent ? "null intent" : "empty extras"), error);
                }
                type.getMethod("onAttachedToWindow").invoke(activity);
                System.out.println("PASS " + version + " onCreate " + (nullIntent ? "null intent" : "empty extras") + ": finished before attached callback");
            }
        }
    }

    static Throwable invoke(Method method, Object target, Object[] arguments) throws Exception {
        try {
            method.invoke(target, arguments);
            return null;
        } catch (InvocationTargetException exception) {
            return exception.getCause();
        }
    }

    static void compileStubs(Path directory) throws IOException {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("android.content.Context", "public class Context {}");
        sources.put("android.os.IBinder", "public interface IBinder {}");
        sources.put("android.os.IInterface", "public interface IInterface { IBinder asBinder(); }");
        sources.put("android.os.Bundle", "public class Bundle extends java.util.HashMap<String,Object> { public String getString(String key) { return (String)get(key); } }");
        sources.put("android.os.Build", "public class Build { public static class VERSION { public static int SDK_INT = 35; } }");
        sources.put("android.content.res.Configuration", "public class Configuration {}");
        sources.put("android.content.Intent", """
            public class Intent {
                private final java.util.Map<String,String> extras = new java.util.HashMap<>();
                public Intent putExtra(String key, String value) { extras.put(key, value); return this; }
                public String getStringExtra(String key) { return extras.get(key); }
                public boolean hasExtra(String key) { return extras.containsKey(key); }
                public boolean getBooleanExtra(String key, boolean fallback) { return fallback; }
                public long getLongExtra(String key, long fallback) { return fallback; }
                public byte[] getByteArrayExtra(String key) { return null; }
                public android.os.Bundle getBundleExtra(String key) { return null; }
            }
            """);
        sources.put("android.view.View", "public class View { public android.os.IBinder getWindowToken() { return new android.os.IBinder() {}; } }");
        sources.put("android.view.WindowManager", "public interface WindowManager { public static class LayoutParams { public int layoutInDisplayCutoutMode; } }");
        sources.put("android.view.Window", "public class Window { public View getDecorView() { return new View(); } public void setLayout(int a, int b) {} public WindowManager.LayoutParams getAttributes() { return new WindowManager.LayoutParams(); } public void setAttributes(WindowManager.LayoutParams value) {} }");
        sources.put("android.util.Log", "public class Log { public static int i(String a, String b) { return 0; } public static int e(String a, String b) { return 0; } public static int e(String a, String b, Throwable c) { return 0; } public static int w(String a, String b) { return 0; } public static boolean isLoggable(String a, int b) { return false; } }");
        sources.put("android.app.Activity", """
            public class Activity extends android.content.Context {
                private android.content.Intent intent = new android.content.Intent();
                private boolean finishing;
                public android.view.Window getWindow() { return new android.view.Window(); }
                public android.content.Intent getIntent() { return intent; }
                public void setIntent(android.content.Intent value) { intent = value; }
                public void finish() { finishing = true; }
                public boolean isFinishing() { return finishing; }
                public void setContentView(int value) { throw new AssertionError("Unexpected rendering outside malformed-intent path"); }
                public void onAttachedToWindow() {}
                public void onConfigurationChanged(android.content.res.Configuration value) {}
                protected void onCreate(android.os.Bundle value) {}
                protected void onNewIntent(android.content.Intent value) {}
                protected void onDestroy() {}
                protected void onPause() {}
                protected void onResume() {}
                protected void onStart() {}
                protected void onStop() {}
            }
            """);
        List<String> arguments = new ArrayList<>(List.of("-d", directory.toString()));
        for (var entry : sources.entrySet()) {
            Path file = directory.resolve(entry.getKey().replace('.', '/') + ".java");
            Files.createDirectories(file.getParent());
            int lastDot = entry.getKey().lastIndexOf('.');
            Files.writeString(file, "package " + entry.getKey().substring(0, lastDot) + ";\n" + entry.getValue());
            arguments.add(file.toString());
        }
        var compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null || compiler.run(null, null, null, arguments.toArray(String[]::new)) != 0) {
            throw new IllegalStateException("Java compiler module required for isolated Android stubs");
        }
    }
}
