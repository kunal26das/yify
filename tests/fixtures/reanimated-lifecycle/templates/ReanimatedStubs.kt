package com.swmansion.reanimated
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.events.Event
object BuildConfig { const val REANIMATED_PROFILING=false }
class DrawPassDetector(context:ReactApplicationContext) { companion object { var inDrawPass=false; var initializations=0 }; fun initialize() { initializations++ }; fun invalidate() {}; fun isInDrawPass()=inDrawPass }
class CopiedEvent(event:Event<*>) { val surfaceId=0; val targetTag=0; val eventName=""; val canCoalesceEvent=false; val customCoalesceKey=0; val payload:WritableMap?=null; val category=0 }
