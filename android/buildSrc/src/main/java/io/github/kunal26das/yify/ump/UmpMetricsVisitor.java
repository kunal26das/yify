package io.github.kunal26das.yify.ump;

import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.JumpInsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;

public final class UmpMetricsVisitor extends ClassVisitor {
    public static final String TARGET = "com/google/android/gms/internal/consent_sdk/zzcr";
    private int methods;

    public UmpMetricsVisitor(ClassVisitor next) { super(Opcodes.ASM9, next); }

    @Override public void visit(int version, int access, String name, String signature, String parent, String[] interfaces) {
        if (!TARGET.equals(name)) throw new IllegalStateException("Unexpected UMP class: " + name);
        super.visit(version, access, name, signature, parent, interfaces);
    }

    @Override public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
        MethodVisitor next = super.visitMethod(access, name, descriptor, signature, exceptions);
        if (!name.equals("zzl") || !descriptor.equals("()V")) return next;
        if (access != (Opcodes.ACC_PRIVATE | Opcodes.ACC_FINAL)) throw new IllegalStateException("Unexpected UMP metrics method access");
        methods++;
        return new MethodNode(Opcodes.ASM9, access, name, descriptor, signature, exceptions) {
            @Override public void visitEnd() {
                int count = 0;
                int delimiters = 0;
                MethodInsnNode target = null;
                for (AbstractInsnNode item : instructions) {
                    if (!(item instanceof MethodInsnNode call) || !call.owner.equals("java/util/Scanner")) continue;
                    if (call.name.equals("hasNext")) throw new IllegalStateException("UMP metrics method is already guarded or changed");
                    if (call.name.equals("useDelimiter") && call.desc.equals("(Ljava/lang/String;)Ljava/util/Scanner;")) delimiters++;
                    if (call.name.equals("next") && call.desc.equals("()Ljava/lang/String;") && call.getOpcode() == Opcodes.INVOKEVIRTUAL) {
                        count++;
                        target = call;
                    }
                }
                if (count != 1 || delimiters != 1) throw new IllegalStateException("Expected exactly one UMP metrics Scanner read");
                LabelNode nonempty = new LabelNode();
                LabelNode done = new LabelNode();
                InsnList guard = new InsnList();
                guard.add(new InsnNode(Opcodes.DUP));
                guard.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "java/util/Scanner", "hasNext", "()Z", false));
                guard.add(new JumpInsnNode(Opcodes.IFNE, nonempty));
                guard.add(new InsnNode(Opcodes.POP));
                guard.add(new LdcInsnNode(""));
                guard.add(new JumpInsnNode(Opcodes.GOTO, done));
                guard.add(nonempty);
                guard.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "java/util/Scanner", "next", "()Ljava/lang/String;", false));
                guard.add(done);
                instructions.insertBefore(target, guard);
                instructions.remove(target);
                accept(next);
            }
        };
    }

    @Override public void visitEnd() {
        if (methods != 1) throw new IllegalStateException("Expected exactly one UMP metrics method");
        super.visitEnd();
    }
}
