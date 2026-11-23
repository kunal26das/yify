package com.facebook.react.bridge
open class ReactApplicationContext {
 fun assertOnJSQueueThread() {}
}
object UiThreadUtil { var ui:Thread=Thread.currentThread(); fun runOnUiThread(callback:()->Unit) { check(isOnUiThread()); callback() }; fun assertOnUiThread() { check(isOnUiThread()) }; fun isOnUiThread()=Thread.currentThread()===ui }
interface WritableMap
