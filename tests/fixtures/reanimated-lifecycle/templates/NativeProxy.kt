package com.swmansion.reanimated
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.fabric.FabricUIManager
import com.swmansion.worklets.runloop.AnimationFrameCallback
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.write
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
@RequiresOptIn annotation class UnstableReactNativeAPI
class Boundary { fun invalidate() {} }
class Hybrid { val isValid=true }
object HarnessControl {
 @Volatile var pauseAfterReset=false
 @Volatile var pauseQuery=false
 @Volatile var beforeNativeOperation:(()->Unit)?=null
 val resetCount=java.util.concurrent.atomic.AtomicInteger()
 val queryEntered=CountDownLatch(1); val releaseQuery=CountDownLatch(1)
 @JvmStatic fun beforeOperation() { beforeNativeOperation?.invoke() }
 @JvmStatic fun beforeQuery() { if(pauseQuery) { queryEntered.countDown(); check(releaseQuery.await(10,TimeUnit.SECONDS)) } }

 val reset=CountDownLatch(1); val release=CountDownLatch(1)
 @JvmStatic fun afterReset() { resetCount.incrementAndGet(); if(pauseAfterReset) { reset.countDown(); check(release.await(10,TimeUnit.SECONDS)) } }
}
class NativeProxy(context:ReactApplicationContext,nodes:NodesManager) {
 companion object { init { System.load(System.getProperty("probe.library")) } }
 private val mInvalidated=AtomicBoolean(false)
 private val mNativeStateLock=ReentrantReadWriteLock()
 private val mFabricUIManager=FabricUIManager()
 private val mountListener=Any()
 private val mNodesManager:NodesManager?=nodes
 private val pseudoSelectorManager=Boundary(); private val cssPlatformTransitionsManager=Boundary(); private val mHybridData=Hybrid()
 private external fun performOperationsCpp()
 private external fun performNonLayoutOperationsCpp()
 private external fun invalidateCpp()
 external fun operationCount():Int
 external fun operationTypes():Int
 private external fun isAnyHandlerWaitingForEventCpp(eventName:String,emitterReactTag:Int):Boolean
__NATIVE_GUARD__
__NATIVE_KOTLIN_PERFORM__
__NATIVE_KOTLIN_NON_LAYOUT__
__NATIVE_KOTLIN_QUERY__
__NATIVE_RENDER__
__NATIVE_INVALIDATE__
}
