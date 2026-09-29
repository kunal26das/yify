package com.facebook.react.uimanager.events
import com.facebook.react.bridge.WritableMap
interface EventDispatcherListener { fun onEventDispatch(event:Event<*>) }
open class Event<T>(val eventName:String="onTransitionProgress", val viewTag:Int=1) { fun dispatchModern(h:RCTModernEventEmitter) { h.receiveEvent(0,viewTag,eventName,false,0,null,0) } }
interface RCTModernEventEmitter { fun receiveEvent(surfaceId:Int,targetTag:Int,eventName:String,canCoalesceEvent:Boolean,customCoalesceKey:Int,payload:WritableMap?,category:Int) {} }
