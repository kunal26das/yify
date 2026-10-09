package io.github.kunal26das.hsdpregression;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class Evidence {
    static final String TAG = "YifyHsdpProbe";
    private static Context context;
    private static String run;
    private static String scenario;

    static synchronized void begin(Context value, String runId, String caseName) {
        if (runId == null || !runId.matches("[a-z0-9-]{8,80}")) throw new IllegalArgumentException("Invalid run ID");
        context = value.getApplicationContext();
        run = runId;
        scenario = caseName;
        try (FileOutputStream stream = context.openFileOutput("events.jsonl", Context.MODE_PRIVATE)) {
            stream.getFD().sync();
        } catch (Exception error) {
            throw new IllegalStateException("Cannot create evidence", error);
        }
        event("driver_started", null, null);
    }

    static synchronized void event(String event, Activity activity, String detail) {
        if (context == null) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("run", run);
            payload.put("case", scenario);
            payload.put("event", event);
            payload.put("version", BuildConfig.HSDP_VERSION);
            payload.put("sourceSha", BuildConfig.SOURCE_SHA);
            payload.put("api", Build.VERSION.SDK_INT);
            payload.put("pid", Process.myPid());
            payload.put("elapsedNanos", SystemClock.elapsedRealtimeNanos());
            if (activity != null) {
                payload.put("activity", activity.getClass().getName());
                payload.put("finishing", activity.isFinishing());
                payload.put("windowToken", activity.getWindow().getDecorView().getWindowToken() != null);
            }
            if (detail != null) payload.put("detail", detail);
            String line = payload.toString() + "\n";
            try (FileOutputStream stream = context.openFileOutput("events.jsonl", Context.MODE_APPEND)) {
                stream.write(line.getBytes(StandardCharsets.UTF_8));
                stream.getFD().sync();
            }
            Log.i(TAG, line.trim());
        } catch (Exception error) {
            throw new IllegalStateException("Cannot write evidence", error);
        }
    }
}
