import io.github.kunal26das.yify.ump.UmpMetricsVisitor;
import java.nio.file.*;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;

public final class Transform {
    static byte[] transform(byte[] original) {
        ClassWriter output = new ClassWriter(ClassWriter.COMPUTE_FRAMES | ClassWriter.COMPUTE_MAXS);
        new ClassReader(original).accept(new UmpMetricsVisitor(output), ClassReader.EXPAND_FRAMES);
        return output.toByteArray();
    }
    static byte[] mutate(byte[] source, int mutation) {
        ClassNode node = new ClassNode();
        new ClassReader(source).accept(node, 0);
        if (mutation == 0) node.name += "unexpected";
        MethodNode method = node.methods.stream().filter(m -> m.name.equals("zzl") && m.desc.equals("()V")).findFirst().orElseThrow();
        if (mutation == 1) method.name = "other";
        if (mutation == 2) method.access = Opcodes.ACC_PUBLIC;
        if (mutation == 3) for (AbstractInsnNode instruction : method.instructions) {
            if (instruction instanceof MethodInsnNode call && call.owner.equals("java/util/Scanner") && call.name.equals("next")) call.name = "nextLine";
        }
        ClassWriter output = new ClassWriter(0);
        node.accept(output);
        return output.toByteArray();
    }
    public static void main(String[] args) throws Exception {
        byte[] source = Files.readAllBytes(Path.of(args[0]));
        byte[] patched = transform(source);
        for (int mutation = 0; mutation < 5; mutation++) {
            try { transform(mutation == 4 ? patched : mutate(source, mutation)); }
            catch (IllegalStateException expected) { continue; }
            throw new AssertionError("Changed SDK unexpectedly accepted: " + mutation);
        }
        Files.write(Path.of(args[1]), patched);
        System.out.println("Exact-class transform passed; all five changed-SDK guards rejected");
    }
}
