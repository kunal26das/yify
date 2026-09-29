#include <jni.h>
#include <memory>
#include <set>
#include <utility>
#include <string_view>
int operationCount=0; int normalCount=0; int nonLayoutCount=0;
using SurfaceId=int;
struct ShadowTree { void notifyDelegatesOfUpdates() const { ++operationCount; } };
struct Registry { template<class F> void visit(int,F f) { f(ShadowTree{}); } };
struct UIManager { Registry registry; Registry& getShadowTreeRegistry() { return registry; } };
struct StaticFeatureFlags { static constexpr bool getFlag(std::string_view) { return false; } };
struct ReanimatedModuleProxy { std::set<SurfaceId> layoutAnimationFlushRequests_{1}; std::shared_ptr<UIManager> uiManager_=std::make_shared<UIManager>(); void executeLayoutAnimationsRequests(); void performOperations() { ++normalCount; executeLayoutAnimationsRequests(); } void cleanupSensors() {} bool isAnyHandlerWaitingForEvent(const std::string &, int) { return !layoutAnimationFlushRequests_.empty(); } void performNonLayoutOperations() { ++nonLayoutCount; executeLayoutAnimationsRequests(); } };
struct NativeProxy { std::shared_ptr<int> uiRuntime_=std::make_shared<int>(1); std::shared_ptr<ReanimatedModuleProxy> reanimatedModuleProxy_=std::make_shared<ReanimatedModuleProxy>(); void* javaPart_=nullptr; void performOperations(); void performNonLayoutOperations(); bool isAnyHandlerWaitingForEvent(const std::string &, const int); void invalidateCpp(); };
__MODULE_EXECUTE_LAYOUT__
__NATIVE_PERFORM__
__NATIVE_INVALIDATE_CPP__
__NATIVE_NON_LAYOUT__
__NATIVE_QUERY__
static NativeProxy proxy;
extern "C" JNIEXPORT void JNICALL Java_com_swmansion_reanimated_NativeProxy_performOperations(JNIEnv* env,jobject) { jclass cls=env->FindClass("com/swmansion/reanimated/HarnessControl"); env->CallStaticVoidMethod(cls,env->GetStaticMethodID(cls,"beforeOperation","()V")); proxy.performOperations(); }
extern "C" JNIEXPORT void JNICALL Java_com_swmansion_reanimated_NativeProxy_performNonLayoutOperations(JNIEnv*,jobject) { proxy.performNonLayoutOperations(); }
extern "C" JNIEXPORT jint JNICALL Java_com_swmansion_reanimated_NativeProxy_operationCount(JNIEnv*,jobject) { return operationCount; }
extern "C" JNIEXPORT void JNICALL Java_com_swmansion_reanimated_NativeProxy_invalidateCpp(JNIEnv* env,jobject) { proxy.invalidateCpp(); jclass cls=env->FindClass("com/swmansion/reanimated/HarnessControl"); env->CallStaticVoidMethod(cls,env->GetStaticMethodID(cls,"afterReset","()V")); }

extern "C" JNIEXPORT jboolean JNICALL Java_com_swmansion_reanimated_NativeProxy_nativeIsAnyHandlerWaitingForEvent(JNIEnv*,jobject) { return proxy.isAnyHandlerWaitingForEvent("onTransitionProgress",1); }

extern "C" JNIEXPORT jint JNICALL Java_com_swmansion_reanimated_NativeProxy_operationTypes(JNIEnv*,jobject) { return normalCount*1000+nonLayoutCount; }
