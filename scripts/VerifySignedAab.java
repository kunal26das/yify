import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Path;
import java.security.CodeSigner;
import java.security.MessageDigest;
import java.security.cert.Certificate;
import java.util.Enumeration;
import java.util.Locale;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

public final class VerifySignedAab {
    private static boolean isSignatureMetadata(String name) {
        String upper = name.toUpperCase(Locale.ROOT);
        if (!upper.startsWith("META-INF/")) return false;
        String relative = upper.substring("META-INF/".length());
        if (relative.contains("/")) return false;
        return relative.equals("MANIFEST.MF") || relative.endsWith(".SF") || relative.endsWith(".RSA") ||
            relative.endsWith(".DSA") || relative.endsWith(".EC") || relative.startsWith("SIG-");
    }

    private static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) text.append(String.format("%02X", value & 255));
        return text.toString();
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 2 || !args[1].matches("[0-9A-Fa-f]{64}")) throw new IllegalArgumentException("Expected AAB path and certificate SHA256");
        String expected = args[1].toUpperCase(Locale.ROOT);
        int verified = 0;
        try (JarFile jar = new JarFile(Path.of(args[0]).toFile(), true)) {
            Enumeration<JarEntry> entries = jar.entries();
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                if (entry.isDirectory() || isSignatureMetadata(entry.getName())) continue;
                try (InputStream stream = jar.getInputStream(entry)) {
                    stream.transferTo(OutputStream.nullOutputStream());
                }
                CodeSigner[] signers = entry.getCodeSigners();
                if (signers == null || signers.length != 1) throw new SecurityException("An AAB payload entry has no unique signer");
                Certificate leaf = signers[0].getSignerCertPath().getCertificates().get(0);
                String actual = hex(MessageDigest.getInstance("SHA-256").digest(leaf.getEncoded()));
                if (!actual.equals(expected)) throw new SecurityException("An AAB payload entry has the wrong signer");
                verified++;
            }
        }
        if (verified == 0) throw new SecurityException("AAB has no signed payload entries");
        System.out.println("Verified every AAB payload entry against the pinned upload certificate");
    }
}
