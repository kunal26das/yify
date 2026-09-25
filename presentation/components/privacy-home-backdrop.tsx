import {Image, StyleSheet, View, useWindowDimensions} from 'react-native';
import {usePalette} from '../hooks/use-palette';

const previews = {
    phone: {
        light: require('../../assets/images/welcome/phone-light.jpg'),
        dark: require('../../assets/images/welcome/phone-dark.jpg'),
    },
    desktop: {
        light: require('../../assets/images/welcome/desktop-light.jpg'),
        dark: require('../../assets/images/welcome/desktop-dark.jpg'),
    },
};

export function PrivacyHomeBackdrop() {
    const {width} = useWindowDimensions();
    const {scheme} = usePalette();
    return <View style={styles.fill}>
        <Image source={previews[width < 600 ? 'phone' : 'desktop'][scheme]} blurRadius={12}
            resizeMode="cover" accessible={false} style={styles.image}/>
        <View style={[StyleSheet.absoluteFill, {backgroundColor: scheme === 'dark'
            ? 'rgba(0, 0, 0, 0.30)' : 'rgba(243, 240, 233, 0.24)'}]}/>
    </View>;
}

const styles = StyleSheet.create({
    fill: {flex: 1, overflow: 'hidden'},
    image: {...StyleSheet.absoluteFill, width: '100%', height: '100%'},
});
