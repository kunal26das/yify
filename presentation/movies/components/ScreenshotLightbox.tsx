import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    FlatList,
    Modal,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {runOnJS, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {ThemedText} from '../../components/themed-text';

interface ScreenshotLightboxProps {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

const LOOP_COPIES = 21;

export function ScreenshotLightbox({images, initialIndex, onClose}: ScreenshotLightboxProps) {
    const {width, height} = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList<string>>(null);
    const count = images.length;
    const loop = count > 1;

    const centerStart = loop ? Math.floor(LOOP_COPIES / 2) * count : 0;
    const startDataIndex = centerStart + initialIndex;

    const data = useMemo(
        () => (loop ? Array.from({length: LOOP_COPIES * count}, (_, i) => images[i % count]) : images),
        [images, loop, count]
    );

    const dataIndexRef = useRef(startDataIndex);
    const pagingRef = useRef(false);
    const pagingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [index, setIndex] = useState(initialIndex);
    const [zoomed, setZoomed] = useState(false);

    const goTo = useCallback(
        (dir: 1 | -1) => {
            if (!loop && (dataIndexRef.current + dir < 0 || dataIndexRef.current + dir >= count)) return;
            if (loop) {
                const centered = centerStart + (((dataIndexRef.current % count) + count) % count);
                if (centered !== dataIndexRef.current) {
                    dataIndexRef.current = centered;
                    listRef.current?.scrollToOffset({offset: centered * width, animated: false});
                }
            }
            const next = dataIndexRef.current + dir;
            dataIndexRef.current = next;
            setIndex(((next % count) + count) % count);
            pagingRef.current = true;
            if (pagingTimerRef.current) clearTimeout(pagingTimerRef.current);
            pagingTimerRef.current = setTimeout(() => {
                pagingRef.current = false;
            }, 400);
            listRef.current?.scrollToOffset({offset: next * width, animated: true});
        },
        [loop, count, width, centerStart]
    );

    const onScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (width <= 0) return;
            const di = Math.round(e.nativeEvent.contentOffset.x / width);
            if (di === dataIndexRef.current) return;
            dataIndexRef.current = di;
            if (!pagingRef.current) setIndex(((di % count) + count) % count);
        },
        [width, count]
    );

    const setZoomedCb = useCallback((v: boolean) => setZoomed(v), []);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key === 'ArrowRight') goTo(1);
            else if (ev.key === 'ArrowLeft') goTo(-1);
            else if (ev.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goTo, onClose]);

    useEffect(() => {
        const id = setTimeout(
            () => listRef.current?.scrollToOffset({offset: dataIndexRef.current * width, animated: false}),
            0
        );
        return () => clearTimeout(id);
    }, [width]);

    useEffect(
        () => () => {
            if (pagingTimerRef.current) clearTimeout(pagingTimerRef.current);
        },
        []
    );

    const getItemLayout = useCallback(
        (_: unknown, i: number) => ({length: width, offset: width * i, index: i}),
        [width]
    );

    const renderItem = useCallback(
        ({item}: {item: string}) => (
            <ZoomableImage
                uri={item}
                width={width}
                height={height}
                onClose={onClose}
                onZoomChange={setZoomedCb}
            />
        ),
        [width, height, onClose, setZoomedCb]
    );

    return (
        <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
            <GestureHandlerRootView style={styles.flex}>
            <View style={[styles.root, {width, height}]}>
                <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none"/>
                <FlatList
                    ref={listRef}
                    style={StyleSheet.absoluteFill}
                    data={data}
                    keyExtractor={(_, i) => String(i)}
                    renderItem={renderItem}
                    horizontal
                    pagingEnabled
                    scrollEnabled={!zoomed}
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={startDataIndex}
                    getItemLayout={getItemLayout}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    onScrollToIndexFailed={({index: i}) => {
                        setTimeout(() => listRef.current?.scrollToIndex({index: i, animated: false}), 50);
                    }}
                    initialNumToRender={1}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    removeClippedSubviews={false}
                />

                <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={({pressed}) => [styles.close, {top: insets.top + 12, opacity: pressed ? 0.7 : 1}]}
                >
                    <View style={styles.circle}>
                        <Ionicons name="close" size={24} color="#fff"/>
                    </View>
                </Pressable>

                {count > 1 ? (
                    <View style={[styles.counter, {bottom: insets.bottom + 22}]} pointerEvents="none">
                        <ThemedText style={styles.counterText} lightColor="#fff" darkColor="#fff">
                            {index + 1} / {count}
                        </ThemedText>
                    </View>
                ) : null}

                {count > 1 && !zoomed ? (
                    <>
                        <Pressable
                            onPress={() => goTo(-1)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Previous screenshot"
                            style={({pressed}) => [styles.arrow, styles.arrowLeft, {opacity: pressed ? 0.7 : 1}]}
                        >
                            <View style={styles.circle}>
                                <Ionicons name="chevron-back" size={26} color="#fff"/>
                            </View>
                        </Pressable>
                        <Pressable
                            onPress={() => goTo(1)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Next screenshot"
                            style={({pressed}) => [styles.arrow, styles.arrowRight, {opacity: pressed ? 0.7 : 1}]}
                        >
                            <View style={styles.circle}>
                                <Ionicons name="chevron-forward" size={26} color="#fff"/>
                            </View>
                        </Pressable>
                    </>
                ) : null}
            </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function ZoomableImage({
    uri,
    width,
    height,
    onClose,
    onZoomChange,
}: {
    uri: string;
    width: number;
    height: number;
    onClose: () => void;
    onZoomChange: (zoomed: boolean) => void;
}) {
    const [aspect, setAspect] = useState(16 / 9);

    const fit = useMemo(() => {
        const vAr = width / height;
        return aspect > vAr
            ? {w: width, h: width / aspect}
            : {w: height * aspect, h: height};
    }, [aspect, width, height]);

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const savedTx = useSharedValue(0);
    const savedTy = useSharedValue(0);

    const notifyZoom = useCallback((z: boolean) => onZoomChange(z), [onZoomChange]);

    const fitW = fit.w;
    const fitH = fit.h;

    const gesture = useMemo(() => {
        const clamp = (v: number, min: number, max: number) => {
            'worklet';
            return Math.min(Math.max(v, min), max);
        };
        const boundX = () => {
            'worklet';
            return Math.max(0, (fitW * scale.value - width) / 2);
        };
        const boundY = () => {
            'worklet';
            return Math.max(0, (fitH * scale.value - height) / 2);
        };
        const settle = () => {
            'worklet';
            savedScale.value = scale.value;
            tx.value = clamp(tx.value, -boundX(), boundX());
            ty.value = clamp(ty.value, -boundY(), boundY());
            savedTx.value = tx.value;
            savedTy.value = ty.value;
        };
        const reset = () => {
            'worklet';
            scale.value = withTiming(1);
            savedScale.value = 1;
            tx.value = withTiming(0);
            ty.value = withTiming(0);
            savedTx.value = 0;
            savedTy.value = 0;
            runOnJS(notifyZoom)(false);
        };

        const pinch = Gesture.Pinch()
            .onUpdate((e) => {
                scale.value = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
            })
            .onEnd(() => {
                if (scale.value <= 1.01) {
                    reset();
                    return;
                }
                settle();
                runOnJS(notifyZoom)(true);
            });

        const pan = Gesture.Pan()
            .averageTouches(true)
            .onUpdate((e) => {
                if (scale.value <= 1) return;
                tx.value = clamp(savedTx.value + e.translationX, -boundX(), boundX());
                ty.value = clamp(savedTy.value + e.translationY, -boundY(), boundY());
            })
            .onEnd(() => {
                savedTx.value = tx.value;
                savedTy.value = ty.value;
            });

        const doubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDuration(260)
            .onEnd(() => {
                if (scale.value > 1) {
                    reset();
                    return;
                }
                scale.value = withTiming(DOUBLE_TAP_SCALE);
                savedScale.value = DOUBLE_TAP_SCALE;
                runOnJS(notifyZoom)(true);
            });

        const singleTap = Gesture.Tap()
            .numberOfTaps(1)
            .onEnd(() => {
                if (scale.value > 1) {
                    reset();
                    return;
                }
                runOnJS(onClose)();
            });

        return Gesture.Race(
            Gesture.Simultaneous(pinch, pan),
            Gesture.Exclusive(doubleTap, singleTap)
        );
    }, [fitW, fitH, width, height, notifyZoom, onClose, scale, savedScale, tx, ty, savedTx, savedTy]);

    const imageStyle = useAnimatedStyle(() => ({
        transform: [{translateX: tx.value}, {translateY: ty.value}, {scale: scale.value}],
    }));

    return (
        <GestureDetector gesture={gesture}>
            <View style={[styles.page, {width, height}]}>
                <Animated.View style={imageStyle}>
                    <Image
                        source={{uri}}
                        style={{width: fitW, height: fitH}}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        onLoad={(e) => {
                            if (e.source?.height) setAspect(e.source.width / e.source.height);
                        }}
                    />
                </Animated.View>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    root: {overflow: 'hidden'},
    page: {justifyContent: 'center', alignItems: 'center', overflow: 'hidden'},
    backdrop: {backgroundColor: '#000'},
    circle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(20,20,24,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    close: {position: 'absolute', right: 16, zIndex: 5},
    arrow: {position: 'absolute', top: '50%', marginTop: -23, zIndex: 5},
    arrowLeft: {left: 12},
    arrowRight: {right: 12},
    counter: {
        position: 'absolute',
        alignSelf: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(20,20,24,0.55)',
    },
    counterText: {fontSize: 14, fontWeight: '700'},
});
