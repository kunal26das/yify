package com.swmansion.reanimated
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
class Boundary { fun invalidate() {} }
class Hybrid { val isValid=true }
object HarnessControl {
 @Volatile var pauseAfterReset=false
 @Volatile var pauseQuery=false
 @Volatile var beforeNativeOperation:(()->Unit)?=null
 val resetCount=java.util.concurrent.atomic.AtomicInteger()
 val queryEntered=CountDownLatch(1); val releaseQuery=CountDownLatch(1)
 @JvmStatic fun beforeOperation() { beforeNativeOperation?.invoke() }
 fun beforeQuery() { if(pauseQuery) { queryEntered.countDown(); check(releaseQuery.await(10,TimeUnit.SECONDS)) } }

 val reset=CountDownLatch(1); val release=CountDownLatch(1)
 @JvmStatic fun afterReset() { resetCount.incrementAndGet(); if(pauseAfterReset) { reset.countDown(); check(release.await(10,TimeUnit.SECONDS)) } }
}
class NativeProxy(context:ReactApplicationContext,nodes:NodesManager) {
 companion object { init { System.load(System.getProperty("probe.library")) } }
 private val mInvalidated=AtomicBoolean(false)
 private val pseudoSelectorManager=Boundary(); private val cssPlatformTransitionsManager=Boundary(); private val mHybridData=Hybrid()
 external fun performOperations()
 external fun performNonLayoutOperations()
 private external fun invalidateCpp()
 external fun operationCount():Int
 external fun operationTypes():Int
 fun isAnyHandlerWaitingForEvent(n:String,t:Int):Boolean { HarnessControl.beforeQuery(); return nativeIsAnyHandlerWaitingForEvent() }
 external fun nativeIsAnyHandlerWaitingForEvent():Boolean
__NATIVE_INVALIDATE__
}
