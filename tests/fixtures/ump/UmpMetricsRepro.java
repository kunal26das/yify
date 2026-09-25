import java.lang.reflect.*;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class UmpMetricsRepro {
    static int status;
    static String body;
    static boolean unrelated;
    static class Connection extends HttpURLConnection {
        Connection(URL url) { super(url); }
        public void disconnect() {}
        public boolean usingProxy() { return false; }
        public void connect() {}
        public int getResponseCode() {
            if (unrelated) throw new IllegalStateException("unrelated failure");
            return status;
        }
        public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
        public InputStream getErrorStream() { return body == null ? null : new ByteArrayInputStream(body.getBytes()); }
    }
    static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    static void invoke(int code, String errorBody, boolean guarded) throws Exception {
        status = code;
        body = errorBody;
        android.util.Log.warnings.clear();
        Class<?> cls = Class.forName("com.google.android.gms.internal.consent_sdk.zzcr");
        Constructor<?> constructor = cls.getDeclaredConstructors()[0];
        constructor.setAccessible(true);
        Object metrics = constructor.newInstance(null, null, (Executor) Runnable::run, null, false);
        cls.getMethod("zzk", String.class).invoke(metrics, "https://localhost.invalid/metrics");
        Object message = Class.forName("com.google.android.gms.internal.consent_sdk.zzif").getDeclaredConstructor().newInstance();
        Field field = cls.getDeclaredField("zzl");
        field.setAccessible(true);
        Queue queue = (Queue) ((AtomicReference) field.get(metrics)).get();
        queue.add(message);
        Method method = cls.getDeclaredMethod("zzl");
        method.setAccessible(true);
        Throwable error = null;
        try { method.invoke(metrics); } catch (InvocationTargetException failure) { error = failure.getCause(); }
        boolean rejected = code != 200 && code != 204;
        boolean originalCrash = rejected && "".equals(body) && !guarded;
        if (unrelated) {
            check(error instanceof IllegalStateException && "unrelated failure".equals(error.getMessage()), "Unrelated failures must remain visible");
        } else if (originalCrash) {
            check(error instanceof NoSuchElementException, "Original UMP class must reproduce the reported crash");
            check(Arrays.stream(error.getStackTrace()).anyMatch(frame -> frame.getClassName().endsWith(".zzcr") && frame.getMethodName().equals("zzl") && frame.getLineNumber() == 19), "Exact original SDK frame");
        } else {
            if (error != null) throw new AssertionError("Unexpected SDK failure", error);
            check(queue.size() == (rejected ? 1 : 0), "Queue size after response");
            check(!rejected || queue.peek() == message, "Original metrics message must be requeued once");
            check(android.util.Log.warnings.size() == (rejected ? 1 : 0), "Exactly one warning per rejected response");
            if (rejected) check(android.util.Log.warnings.get(0).equals("Fail to ping metrics reporting URL: Http error code - " + code + ".\n" + (body == null ? "null" : body)), "HTTP status and body warning preserved");
        }
        System.out.println((guarded ? "guarded" : "original") + " status=" + code + " body=" + (body == null ? "null" : body.isEmpty() ? "empty" : "nonempty") + " passed");
    }
    public static void main(String[] args) throws Exception {
        boolean guarded = Boolean.parseBoolean(args[0]);
        URL.setURLStreamHandlerFactory(protocol -> new URLStreamHandler() {
            protected URLConnection openConnection(URL url) { return new Connection(url); }
        });
        for (int code : new int[]{200, 204, 403, 500}) for (String body : new String[]{null, "", "server error"}) invoke(code, body, guarded);
        unrelated = true;
        invoke(500, "", guarded);
    }
}
