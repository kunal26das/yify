package com.facebook.react.bridge
import com.facebook.react.modules.core.DeviceEventManagerModule
open class ReactApplicationContext {
 fun assertOnJSQueueThread() {}
 fun <T> getJSModule(clazz:Class<T>):T = clazz.cast(object:DeviceEventManagerModule.RCTDeviceEventEmitter { override fun emit(n:String,b:WritableMap) {} })
}
object UiThreadUtil { var ui:Thread=Thread.currentThread(); fun runOnUiThread(callback:()->Unit) { check(isOnUiThread()); callback() }; fun assertOnUiThread() { check(isOnUiThread()) }; fun isOnUiThread()=Thread.currentThread()===ui }
interface WritableMap
