package com.swmansion.worklets.runloop
class AnimationFrameCallback(private val callback: (Double)->Unit) { fun onAnimationFrame(time:Double)=callback(time) }
