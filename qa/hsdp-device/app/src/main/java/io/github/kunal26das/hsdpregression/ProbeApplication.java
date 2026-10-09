package io.github.kunal26das.hsdpregression;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import com.google.android.play.core.hsdp.service.HsdpShimActivity;

public final class ProbeApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            public void onActivityCreated(Activity activity, Bundle state) { record("framework_created", activity); }
            public void onActivityStarted(Activity activity) { record("framework_started", activity); }
            public void onActivityResumed(Activity activity) { record("framework_resumed", activity); }
            public void onActivityPaused(Activity activity) { record("framework_paused", activity); }
            public void onActivityStopped(Activity activity) { record("framework_stopped", activity); }
            public void onActivitySaveInstanceState(Activity activity, Bundle state) {}
            public void onActivityDestroyed(Activity activity) { record("framework_destroyed", activity); }
            private void record(String name, Activity activity) {
                if (activity instanceof HsdpShimActivity) Evidence.event(name, activity, null);
            }
        });
    }
}
