import {useWindowDimensions} from 'react-native';

export type Breakpoint = 'phone' | 'tablet' | 'desktop' | 'wide';

const TABLET_MIN = 600;
const DESKTOP_MIN = 1024;
const WIDE_MIN = 1440;

export interface Responsive {
    width: number;
    height: number;
    breakpoint: Breakpoint;
    isPhone: boolean;
    isTablet: boolean;
    isLarge: boolean;
    isDesktop: boolean;
    contentMaxWidth: number;
    gutter: number;
}

export function useResponsive(): Responsive {
    const {width, height} = useWindowDimensions();

    let breakpoint: Breakpoint = 'phone';
    if (width >= WIDE_MIN) breakpoint = 'wide';
    else if (width >= DESKTOP_MIN) breakpoint = 'desktop';
    else if (width >= TABLET_MIN) breakpoint = 'tablet';

    const isPhone = breakpoint === 'phone';
    const isTablet = breakpoint === 'tablet';
    const isDesktop = breakpoint === 'desktop' || breakpoint === 'wide';
    const isLarge = !isPhone;

    const contentMaxWidth = breakpoint === 'wide' ? 1320 : breakpoint === 'desktop' ? 1120 : width;
    const gutter = isPhone ? 16 : isTablet ? 24 : 32;

    return {
        width,
        height,
        breakpoint,
        isPhone,
        isTablet,
        isLarge,
        isDesktop,
        contentMaxWidth,
        gutter,
    };
}
