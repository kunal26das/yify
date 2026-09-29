import android.view.Choreographer.FrameCallback
import com.facebook.react.internal.ChoreographerProvider
class PlatformFrames:ChoreographerProvider,ChoreographerProvider.Choreographer {
 private val callbacks=mutableListOf<FrameCallback>()
 override fun getChoreographer()=this
 override fun postFrameCallback(callback:FrameCallback) { synchronized(callbacks) { callbacks.add(callback) } }
 override fun removeFrameCallback(callback:FrameCallback) { synchronized(callbacks) { callbacks.removeAll { it===callback } } }
 fun tick() { val next=synchronized(callbacks) { callbacks.toList().also { callbacks.clear() } }; next.forEach { it.doFrame(System.nanoTime()) } }
 fun pending()=synchronized(callbacks) { callbacks.size }
}
