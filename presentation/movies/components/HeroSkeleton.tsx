import {View} from 'react-native';
import {Radius, Spacing} from '../../constants/theme';
import {SkeletonBlock} from './PosterSkeleton';

export function HeroSkeleton({width, height, gutter}: {width: number; height: number; gutter: number}) {
    const split = width >= 760;
    const innerWidth = Math.max(1, width - gutter * 2);
    const gap = split ? (innerWidth >= 1000 ? 48 : 32) : 24;
    const artWidth = split ? Math.round((innerWidth - gap) * 0.56) : innerWidth;
    const copyWidth = split ? innerWidth - gap - artWidth : innerWidth;
    const titleSize = split ? (copyWidth >= 430 ? 54 : 42) : 36;
    const controlSize = 46;
    const selectorHeight = controlSize + Spacing.sm;
    const artwork = <SkeletonBlock style={{width: artWidth, height: Math.round(artWidth * 9 / 16), borderRadius: Radius.sm}}/>;
    const copy = (
        <View style={{width: copyWidth}}>
            <SkeletonBlock style={{width: '90%', height: Math.ceil(titleSize * 1.3) * 2, borderRadius: Radius.sm}}/>
            <SkeletonBlock style={{width: '60%', height: 20, marginTop: 16, borderRadius: Radius.sm}}/>
            <SkeletonBlock style={{width: '40%', height: 18, marginTop: 8, borderRadius: Radius.sm}}/>
            <SkeletonBlock style={{width: '95%', maxWidth: 520, height: 69, marginTop: 18, borderRadius: Radius.sm}}/>
            <View style={{flexDirection: 'row', gap: 8, marginTop: 24}}>
                <SkeletonBlock style={{width: 140, height: controlSize, borderRadius: Radius.md}}/>
                <SkeletonBlock style={{width: controlSize, height: controlSize, borderRadius: Radius.md}}/>
            </View>
        </View>
    );
    return (
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            pointerEvents="none" style={{marginBottom: Spacing.xxl}}>
            <View style={{minHeight: height - selectorHeight, paddingHorizontal: gutter,
                paddingTop: split ? 40 : 20, paddingBottom: split ? Spacing.sm : 20, gap,
                flexDirection: split ? 'row' : 'column', alignItems: split ? 'center' : 'flex-start'}}>
                {split ? copy : artwork}
                {split ? artwork : copy}
            </View>
            <View style={{height: selectorHeight, marginHorizontal: gutter, flexDirection: 'row',
                alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md}}>
                <SkeletonBlock style={{width: controlSize, height: controlSize, borderRadius: Radius.md}}/>
                <SkeletonBlock style={{flex: 1, maxWidth: 270, height: controlSize, borderRadius: Radius.sm}}/>
                <SkeletonBlock style={{width: controlSize, height: controlSize, borderRadius: Radius.md}}/>
            </View>
        </View>
    );
}
