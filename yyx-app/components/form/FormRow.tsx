import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

interface FormRowProps {
    children: ReactNode;
    className?: string; // Add className support
    style?: StyleProp<ViewStyle>;
    row?: boolean;
    column?: boolean;
}

/**
 * Row-layout container for form fields. Default behavior: column on mobile,
 * row on md+ screens. When rendering as a row, each child is wrapped in a
 * flex-1 cell so adjacent fields share horizontal space equally.
 *
 * Layout responsibility lives on the parent (this component). Children like
 * FormGroup stay layout-agnostic — they don't know or care whether they're
 * inside a row or a vertical stack.
 */
export function FormRow({ children, className = '', style, row, column = false }: FormRowProps) {
    // Default to being a column on mobile and row on larger screens, unless overridden
    let directionClass = 'flex-col md:flex-row';
    let cellClass = 'flex-none md:flex-1';
    if (row) {
        directionClass = 'flex-row';
        cellClass = 'flex-1';
    }
    if (column) {
        directionClass = 'flex-col';
        cellClass = 'flex-none';
    }

    // Wrap each child in a layout cell. flex-1 is only applied on axes where
    // children should share space (row layouts share horizontal width).
    // Column layouts use flex-none so children don't distribute parent height
    // unevenly when the ancestor ScrollView imposes a height constraint.
    const cells = React.Children.map(children, (child, idx) => {
        if (child == null || typeof child === 'boolean') return null;
        return (
            <View key={idx} className={cellClass}>
                {child}
            </View>
        );
    });

    return (
        <View
            className={`${directionClass} gap-md mb-lg ${className}`}
            style={style}
        >
            {cells}
        </View>
    );
}
