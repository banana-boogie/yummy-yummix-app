import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';

interface NavIconProps {
    iconName: keyof typeof Ionicons.glyphMap;
    size?: number;
    iconSize?: number;
    backgroundColor?: string;
    iconColor?: string;
    isActive?: boolean;
    activeColor?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * NavIcon Component
 * 
 * A unified navigation icon component that displays an Ionicon
 * inside a circular background with customizable styling.
 */
const NavIcon: React.FC<NavIconProps> = ({
    iconName,
    size = 60,
    iconSize = 28,
    backgroundColor = COLORS.background.default,
    iconColor,
    isActive = false,
    activeColor = COLORS.primary.MEDIUM,
    style,
}) => {

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    backgroundColor: backgroundColor,
                },
                style,
            ]}
        >
            <Ionicons
                name={iconName}
                size={iconSize}
                color={isActive
                    ? activeColor
                    : iconColor}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default NavIcon; 