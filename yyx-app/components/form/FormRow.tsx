import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

interface FormRowProps {
    children: ReactNode;
    className?: string; // Add className support
    style?: StyleProp<ViewStyle>;
    row?: boolean;
    column?: boolean;
}

export function FormRow({ children, className = '', style, row, column = false }: FormRowProps) {
    // Default to being a column on mobile and row on larger screens, unless overridden
    let directionClass = 'flex-col md:flex-row';
    if (row) directionClass = 'flex-row';
    if (column) directionClass = 'flex-col';

    return (
        <View
            className={`${directionClass} gap-md mb-md ${className}`}
            style={style}
        >
            {children}
        </View>
    );
}
