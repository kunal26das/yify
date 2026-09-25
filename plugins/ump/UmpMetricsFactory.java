package io.github.kunal26das.yify.ump;

import com.android.build.api.instrumentation.AsmClassVisitorFactory;
import com.android.build.api.instrumentation.ClassContext;
import com.android.build.api.instrumentation.ClassData;
import com.android.build.api.instrumentation.InstrumentationParameters;
import java.io.File;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.gradle.api.file.ConfigurableFileCollection;
import org.gradle.api.tasks.InputFiles;
import org.gradle.api.tasks.PathSensitive;
import org.gradle.api.tasks.PathSensitivity;
import org.objectweb.asm.ClassVisitor;

public abstract class UmpMetricsFactory implements AsmClassVisitorFactory<UmpMetricsFactory.Parameters> {
    public interface Parameters extends InstrumentationParameters {
        @InputFiles @PathSensitive(PathSensitivity.NONE) ConfigurableFileCollection getUmpArtifact();
    }

    @Override public boolean isInstrumentable(ClassData data) {
        return data.getClassName().equals(UmpMetricsVisitor.TARGET.replace('/', '.'));
    }

    @Override public ClassVisitor createClassVisitor(ClassContext context, ClassVisitor next) {
        try {
            File artifact = getParameters().get().getUmpArtifact().getSingleFile();
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(artifact.toPath())));
            if (!hash.equals("429889c7108caf88207d5d078e8fa7655a0ec6aca718399f27455bebe5978621")) {
                throw new IllegalStateException("UMP 4.0.0 artifact changed; review the metrics guard before building");
            }
        } catch (Exception error) {
            throw new IllegalStateException("Cannot verify the exact Google UMP 4.0.0 artifact", error);
        }
        return new UmpMetricsVisitor(next);
    }
}
