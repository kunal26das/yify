package com.swmansion.reanimated.nativeProxy
import com.facebook.react.bridge.WritableMap
open class EventHandler:com.facebook.react.uimanager.events.RCTModernEventEmitter { open fun handle(eventName:String,targetTag:Int,params:WritableMap?) {} }
