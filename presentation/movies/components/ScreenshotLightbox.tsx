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
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
        </Modal>
    );
}

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
    const [zoomed, setZoomed] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    const fit = useMemo(() => {
        const vAr = width / height;
        return aspect > vAr
            ? {w: Math.round(width), h: Math.round(width / aspect)}
            : {w: Math.round(height * aspect), h: Math.round(height)};
    }, [aspect, width, height]);

    const fillW = Math.max(width, Math.round(height * aspect));
    const imgW = zoomed ? fillW : fit.w;
    const imgH = zoomed ? height : fit.h;
    const contentW = zoomed ? fillW : width;

    const toggleZoom = useCallback(() => {
        setZoomed((z) => {
            onZoomChange(!z);
            return !z;
        });
    }, [onZoomChange]);

    useEffect(() => {
        if (!zoomed) return;
        const x = Math.max(0, (contentW - width) / 2);
        const id = setTimeout(() => scrollRef.current?.scrollTo({x, y: 0, animated: false}), 0);
        return () => clearTimeout(id);
    }, [zoomed, contentW, width]);

    return (
        <View style={{width, height}}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close"/>
            <ScrollView
                ref={scrollRef}
                horizontal
                scrollEnabled={zoomed}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                style={[StyleSheet.absoluteFill, {pointerEvents: zoomed ? 'auto' : 'box-none'}]}
                contentContainerStyle={{
                    width: contentW,
                    height,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Pressable onPress={toggleZoom} style={{width: imgW, height: imgH}}>
                    <Image
                        source={{uri}}
                        style={{width: imgW, height: imgH}}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        onLoad={(e) => {
                            if (e.source?.height) setAspect(e.source.width / e.source.height);
                        }}
                    />
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {overflow: 'hidden'},
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
