import com.swmansion.reanimated.*
import com.swmansion.worklets.runloop.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.ReactChoreographer
import com.facebook.react.uimanager.events.*
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger
import java.lang.management.ManagementFactory
fun waitBlocked(thread:Thread) { val until=System.nanoTime()+TimeUnit.SECONDS.toNanos(5); while(thread.state!=Thread.State.BLOCKED && System.nanoTime()<until) Thread.yield(); check(thread.state==Thread.State.BLOCKED) { "Thread did not block: "+thread.state } }
fun main(args:Array<String>) {
 Thread.setDefaultUncaughtExceptionHandler { _, error -> error.printStackTrace(); kotlin.system.exitProcess(1) }
 val mode=args.single(); val frames=PlatformFrames(); ReactChoreographer.initialize(frames)
 val context=ReactApplicationContext(); val nodes=NodesManager(context); val native=nodes.getNativeProxy()!!
 val queue=AnimationFrameQueue(context); val choreographer=ReactChoreographer.getInstance()
 val callbacks=AtomicInteger(); val events=AtomicInteger()
 nodes.registerEventHandler(object:RCTModernEventEmitter { override fun receiveEvent(a:Int,b:Int,c:String,d:Boolean,e:Int,f:WritableMap?,g:Int) { events.incrementAndGet() } })
 fun post() { nodes.postOnAnimation(object:NodesManager.OnAnimationFrame { override fun onAnimationFrame(t:Double) { callbacks.incrementAndGet() } }) }
 if(mode=="lock-order" || mode=="cancel-lock-order") {
  val workerDone=CountDownLatch(1); val tested=CountDownLatch(1)
  lateinit var worker:Thread
  choreographer.postFrameCallback(ReactChoreographer.CallbackType.PERF_MARKERS,android.view.Choreographer.FrameCallback {
   HarnessControl.pauseQuery=mode=="lock-order"
   worker=Thread({ if(mode=="lock-order") nodes.onEventDispatch(Event<Any>()) else nodes.invalidate(); workerDone.countDown() },"background-native-lifecycle")
   worker.isDaemon=true; worker.start()
   if(mode=="lock-order") { check(HarnessControl.queryEntered.await(5,TimeUnit.SECONDS)); HarnessControl.releaseQuery.countDown() }
   waitBlocked(worker); tested.countDown()
  })
  if(mode=="lock-order") queue.requestAnimationFrame(AnimationFrameCallback { nodes.performOperations() }) else post()
  val ui=Thread({ UiThreadUtil.ui=Thread.currentThread(); frames.tick() },"UI-real-choreographer")
  ui.isDaemon=true; ui.start(); check(tested.await(5,TimeUnit.SECONDS))
  ui.join(5000)
  val deadlocks=ManagementFactory.getThreadMXBean().findDeadlockedThreads()
  if(deadlocks!=null) { println("DEADLOCK real ReactChoreographer holds callbackQueues while waiting for Nodes lifecycle monitor; "+deadlocks.joinToString()); return }
  check(!ui.isAlive); check(workerDone.await(5,TimeUnit.SECONDS)); println("PASS "+mode+" completes with real lock-held callback dispatch"); return
 }
 if(mode=="late-schedule") {
  val field=choreographer.javaClass.getDeclaredField("callbackQueues"); field.isAccessible=true; val actualQueues=field.get(choreographer)
  lateinit var worker:Thread
  synchronized(actualQueues) {
   worker=Thread({ nodes.onEventDispatch(Event<Any>()) },"late-frame-scheduler"); worker.isDaemon=true; worker.start(); waitBlocked(worker)
   nodes.invalidate()
  }
  worker.join(5000); check(!worker.isAlive); check(frames.pending()==0); frames.tick(); check(native.operationCount()==0)
  println("PASS delayed background post cancels its own callback after disposal"); return
 }
 if(mode!="draw-pass") post()
 if(mode=="duplicate") { nodes.invalidate(); nodes.invalidate(); nodes.onHostPause(); nodes.onHostResume(); nodes.onHostPause(); nodes.onHostResume(); nodes.postOnAnimation(object:NodesManager.OnAnimationFrame { override fun onAnimationFrame(t:Double) { error("retired callback ran") } }); frames.tick(); check(HarnessControl.resetCount.get()==1); check(frames.pending()==0); println("PASS duplicate invalidation resets native once and rejects new frames"); return }
 if(mode=="active") { frames.tick(); check(native.operationCount()==1); check(callbacks.get()==1); nodes.onEventDispatch(Event<Any>()); check(events.get()==1); println("PASS active frame and event reach native operations"); return }
 if(mode=="draw-pass") { DrawPassDetector.inDrawPass=true; nodes.performOperationsRespectingDrawPass(); check(native.operationTypes()==1); check(frames.pending()>0); DrawPassDetector.inDrawPass=false; frames.tick(); check(native.operationTypes()==1001); nodes.invalidate(); val before=DrawPassDetector.initializations; nodes.performOperationsRespectingDrawPass(); check(DrawPassDetector.initializations==before); println("PASS draw-pass flushes non-layout immediately and layout on frame; disposed detector stays detached"); return }
 if(mode=="active-background") { val worker=Thread { nodes.onEventDispatch(Event<Any>()) }; worker.start(); worker.join(); frames.tick(); check(callbacks.get()==1); check(events.get()==1); check(native.operationCount()==1); println("PASS active background event reaches the UI handler and native operations"); return }
 if(mode=="reentrant") { var entered=false; HarnessControl.beforeNativeOperation={ if(!entered) { entered=true; post(); nodes.performNonLayoutOperations(); nodes.performOperationsRespectingDrawPass() } }; frames.tick(); HarnessControl.beforeNativeOperation=null; frames.tick(); check(callbacks.get()==2); println("PASS synchronous native callback reenters Nodes lifecycle gate"); return }
 if(mode=="pause-resume") { nodes.onHostPause(); frames.tick(); check(callbacks.get()==0); nodes.onHostResume(); frames.tick(); check(callbacks.get()==1); println("PASS healthy pause and resume"); return }
 if(mode=="completed") { nodes.invalidate(); frames.tick(); check(native.operationCount()==0); check(callbacks.get()==0 && events.get()==0 && frames.pending()==0); println("PASS completed invalidation drops NodesManager native call; callbacks="+callbacks.get()); return }
 if(mode=="queued-event") { val worker=Thread { nodes.onEventDispatch(Event<Any>()) }; worker.start(); worker.join(); nodes.invalidate(); frames.tick(); check(callbacks.get()==0 && events.get()==0 && frames.pending()==0); println("QUEUED callbacks="+callbacks.get()+" events="+events.get()+" pending="+frames.pending()); return }
 if(mode=="inflight") {
  HarnessControl.pauseAfterReset=true
  lateinit var invalidator:Thread
  HarnessControl.beforeNativeOperation={ invalidator=Thread({ nodes.invalidate() },"invalidation-during-operation"); invalidator.isDaemon=true; invalidator.start(); waitBlocked(invalidator); check(HarnessControl.reset.count==1L); HarnessControl.beforeNativeOperation=null }
  frames.tick(); check(HarnessControl.reset.await(5,TimeUnit.SECONDS)); check(native.operationCount()==1); HarnessControl.release.countDown(); invalidator.join(5000); check(!invalidator.isAlive); println("PASS already-running native operation completes before reset"); return
 }
 if(mode=="paused" || mode=="event-window") nodes.onHostPause()
 if(mode=="queue-stopped") { queue.requestAnimationFrame(AnimationFrameCallback { error("Invalidated Worklets callback ran") }); queue.invalidate() }
 if(mode=="worklets-only") { nodes.onHostPause(); queue.requestAnimationFrame(AnimationFrameCallback { nodes.performOperations() }); queue.invalidate() }
 HarnessControl.pauseAfterReset=true
 val invalidator=Thread({ nodes.invalidate() },"ReactHost-background"); invalidator.isDaemon=true; invalidator.start()
 check(HarnessControl.reset.await(10,TimeUnit.SECONDS))
 println("Native module reset; testing "+mode)
 when(mode) {
  "event-window" -> nodes.onEventDispatch(Event<Any>())
  "query-window" -> { val worker=Thread { nodes.onEventDispatch(Event<Any>()) }; worker.start(); worker.join(5000); check(!worker.isAlive) }
  "direct-window" -> { nodes.performOperations(); nodes.performNonLayoutOperations(); nodes.performOperationsRespectingDrawPass() }
  "arriving-frame" -> { post(); frames.tick() }
  else -> frames.tick()
 }
 HarnessControl.release.countDown(); invalidator.join(10000); check(!invalidator.isAlive)
 check(native.operationCount()==0)
 check(callbacks.get()==0 && events.get()==0 && frames.pending()==0)
 println("PASS no native operation during "+mode+"; callbacks="+callbacks.get()+" events="+events.get()+" pending="+frames.pending())
}
