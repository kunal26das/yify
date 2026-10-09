package io.github.kunal26das.hsdpregression;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Process;
import android.system.Os;
import android.system.OsConstants;
import android.system.ErrnoException;
import java.io.FileDescriptor;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

final class IdentityEvidence {
    static void verify(Context context) {
        try {
            JSONArray groups = new JSONArray();
            String groupLine = null;
            String uidLine = null;
            String gidLine = null;
            try (BufferedReader reader = new BufferedReader(new FileReader("/proc/self/status"))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("Uid:")) {
                        if (uidLine != null) throw new IllegalStateException("Duplicate process UID");
                        uidLine = line.substring(4).trim();
                    }
                    if (line.startsWith("Gid:")) {
                        if (gidLine != null) throw new IllegalStateException("Duplicate process GID");
                        gidLine = line.substring(4).trim();
                    }
                    if (line.startsWith("Groups:")) {
                        if (groupLine != null) throw new IllegalStateException("Duplicate process groups");
                        groupLine = line.substring(7).trim();
                    }
                }
            }
            if (uidLine == null || gidLine == null) throw new IllegalStateException("Missing actual UID/GID");
            if (groupLine == null) throw new IllegalStateException("Missing process groups");
            boolean hasInetGroup = false;
            if (!groupLine.isEmpty()) {
                for (String value : groupLine.split("\\s+")) {
                    int group = Integer.parseInt(value);
                    groups.put(group);
                    if (group == 3003) hasInetGroup = true;
                }
            }
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), PackageManager.GET_PERMISSIONS);
            JSONArray permissions = new JSONArray();
            if (info.requestedPermissions != null) for (String permission : info.requestedPermissions) permissions.put(permission);
            int permission = context.checkSelfPermission(Manifest.permission.INTERNET);
            JSONObject payload = new JSONObject();
            payload.put("evidenceVersion", 1);
            payload.put("sourceSha", BuildConfig.SOURCE_SHA);
            payload.put("hsdpVersion", BuildConfig.HSDP_VERSION);
            payload.put("packageName", context.getPackageName());
            payload.put("uid", Process.myUid());
            payload.put("pid", Process.myPid());
            payload.put("packageUid", context.getApplicationInfo().uid);
            payload.put("groups", groups);
            payload.put("procUid", uidLine);
            payload.put("procGid", gidLine);
            payload.put("procGroups", groupLine);
            payload.put("internetPermission", permission);
            payload.put("requestedPermissions", permissions);
            payload.put("sharedUserId", info.sharedUserId == null ? JSONObject.NULL : info.sharedUserId);
            save(context, payload);
            if (Process.myUid() < 10000 || Process.myUid() != context.getApplicationInfo().uid || hasInetGroup || permission != PackageManager.PERMISSION_DENIED || permissions.length() != 0 || info.sharedUserId != null) {
                throw new IllegalStateException("Application process isolation boundary failed");
            }
            for (String line : new String[]{uidLine, gidLine}) {
                String[] ids = line.split("\\s+");
                if (ids.length != 4) throw new IllegalStateException("Invalid actual process IDs");
                for (String id : ids) if (Integer.parseInt(id) != Process.myUid()) throw new IllegalStateException("Unexpected actual process identity");
            }
            JSONArray probes = new JSONArray();
            boolean denied = true;
            for (int family : new int[]{OsConstants.AF_INET, OsConstants.AF_INET6}) {
                for (int type : new int[]{OsConstants.SOCK_STREAM, OsConstants.SOCK_DGRAM}) {
                    JSONObject probe = new JSONObject();
                    probe.put("family", family);
                    probe.put("type", type);
                    probe.put("noAddressOrTraffic", true);
                    FileDescriptor descriptor = null;
                    try {
                        descriptor = Os.socket(family, type, 0);
                        probe.put("created", true);
                        probe.put("errno", JSONObject.NULL);
                        denied = false;
                    } catch (ErrnoException error) {
                        probe.put("created", false);
                        probe.put("errno", error.errno);
                        if (error.errno != OsConstants.EACCES && error.errno != OsConstants.EPERM) denied = false;
                    }
                    probes.put(probe);
                    if (descriptor != null) Os.close(descriptor);
                }
            }
            payload.put("socketCreationProbes", probes);
            save(context, payload);
            if (!denied) throw new IllegalStateException("Actual process socket denial not established");
        } catch (Exception error) {
            throw new IllegalStateException("Cannot verify application process identity", error);
        }
    }
    private static void save(Context context, JSONObject payload) throws Exception {
        try (FileOutputStream stream = context.openFileOutput("identity.json", Context.MODE_PRIVATE)) {
            stream.write((payload.toString() + "\n").getBytes(StandardCharsets.UTF_8));
            stream.getFD().sync();
        }
    }
}
