package com.facebook.react.fabric
import com.facebook.react.uimanager.events.EventDispatcherListener
class FabricUIManager { val eventDispatcher=EventDispatcher(); fun resolveCustomDirectEventName(name:String)=name }
class EventDispatcher { fun addListener(l:EventDispatcherListener) {}; fun removeListener(l:EventDispatcherListener) {} }
