package io.github.kunal26das.hsdpregression;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.google.android.play.core.hsdp.service.HsdpShimActivity;

public final class CallbackProbeActivity extends HsdpShimActivity {
    private String scenario;
    private boolean armed;
    private boolean exercised;

    @Override
    protected void onCreate(Bundle state) {
        scenario = getIntent().getStringExtra("qa_case");
        Evidence.event("probe_create_enter", this, scenario);
        if (scenario.equals("null-create")) setIntent(null);
        else if (scenario.equals("empty-create")) setIntent(new Intent());
        else getIntent().putExtra("target_package_name", getPackageName());
        super.onCreate(state);
        Evidence.event("probe_create_exit", this, null);
        if (scenario.endsWith("-create")) return;
        if (isFinishing()) throw new IllegalStateException("SDK initialization finished before callback probe");
        setIntent(DriverActivity.malformed(new Intent(this, CallbackProbeActivity.class)));
    }

    @Override
    public void onAttachedToWindow() {
        Evidence.event("framework_attached", this, null);
        if (scenario.endsWith("-create")) {
            super.onAttachedToWindow();
            return;
        }
        if (getWindow().getDecorView().getWindowToken() == null) {
            throw new IllegalStateException("Real Android window token is required");
        }
        armed = true;
        if (scenario.equals("attached")) {
            exercise("attached", () -> super.onAttachedToWindow());
        } else {
            Evidence.event("sdk_attach_deferred", this, "Only the requested HSDP callback will be invoked");
            new Handler(Looper.getMainLooper()).post(() -> {
                if (scenario.equals("configuration")) {
                    Evidence.event("configuration_requested", this, null);
                } else if (scenario.equals("new-intent")) {
                    Evidence.event("new_intent_requested", this, null);
                    Intent next = DriverActivity.malformed(new Intent(this, CallbackProbeActivity.class));
                    next.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(next);
                }
            });
        }
    }

    @Override
    public void onConfigurationChanged(Configuration config) {
        if (exercised && isFinishing()) {
            super.onConfigurationChanged(config);
            Evidence.event("framework_configuration_after_finish", this, null);
        } else if (armed && scenario.equals("configuration")) {
            Evidence.event("framework_configuration", this, null);
            exercise("configuration", () -> super.onConfigurationChanged(config));
        } else {
            throw new IllegalStateException("Unexpected configuration before the requested SDK probe");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (exercised && isFinishing()) {
            super.onNewIntent(intent);
            Evidence.event("framework_new_intent_after_finish", this, null);
        } else if (armed && scenario.equals("new-intent")) {
            Evidence.event("framework_new_intent", this, null);
            exercise("new-intent", () -> super.onNewIntent(intent));
        } else {
            throw new IllegalStateException("Unexpected new intent before the probe was armed");
        }
    }

    private void exercise(String callback, Runnable action) {
        if (exercised) return;
        exercised = true;
        Evidence.event("sdk_callback_enter", this, callback);
        try {
            action.run();
            Evidence.event("sdk_callback_exit", this, callback);
            if (!isFinishing()) throw new IllegalStateException("Malformed intent did not finish activity");
            action.run();
            Evidence.event("sdk_callback_repeat_exit", this, callback);
        } catch (RuntimeException error) {
            Evidence.event("sdk_callback_throw", this, error.getClass().getName() + ": " + error.getMessage());
            throw error;
        }
    }
}
