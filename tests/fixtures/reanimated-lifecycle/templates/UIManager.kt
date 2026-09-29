package com.facebook.react.uimanager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.fabric.FabricUIManager
abstract class GuardedFrameCallback(context:ReactApplicationContext):android.view.Choreographer.FrameCallback { abstract fun doFrameGuarded(frameTimeNanos:Long); override fun doFrame(frameTimeNanos:Long)=doFrameGuarded(frameTimeNanos) }
object UIManagerHelper { private val manager=FabricUIManager(); fun getUIManager(c:ReactApplicationContext,t:Int)=manager }
object UIManagerModule { interface CustomEventNamesResolver { fun resolveCustomEventName(eventName:String):String? } }
