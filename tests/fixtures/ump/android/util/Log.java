package android.util;
import java.util.ArrayList;
import java.util.List;
public final class Log {
    public static final List<String> warnings = new ArrayList<>();
    public static int w(String tag, String message) { warnings.add(message); return 0; }
}
