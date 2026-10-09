package io.github.kunal26das.hsdpregression;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;
import com.google.android.play.core.hsdp.service.HsdpShimActivity;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;

public final class DriverActivity extends Activity {
    static final Set<String> CASES = new HashSet<>(Arrays.asList("raw-missing", "attached", "configuration", "new-intent", "empty-create", "null-create"));

    static Intent malformed(Intent intent) {
        intent.putExtra("referrer", "local-framework-regression");
        intent.putExtra("deeplink_url", "https://example.invalid/test");
        intent.removeExtra("target_package_name");
        return intent;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (getIntent().getBooleanExtra("qa_identity_only", false)) {
            finish();
            return;
        }
        String scenario = getIntent().getStringExtra("qa_case");
        String run = getIntent().getStringExtra("qa_run");
        if (!CASES.contains(scenario)) throw new IllegalArgumentException("Unsupported QA case");
        Evidence.begin(this, run, scenario);
        TextView label = new TextView(this);
        label.setText("HSDP framework QA " + BuildConfig.HSDP_VERSION + "\n" + scenario);
        setContentView(label);
        Class<?> target = scenario.equals("raw-missing") ? HsdpShimActivity.class : CallbackProbeActivity.class;
        Intent intent = malformed(new Intent(this, target));
        intent.putExtra("qa_case", scenario);
        Evidence.event("launch_requested", this, target.getName());
        startActivity(intent);
    }
}
