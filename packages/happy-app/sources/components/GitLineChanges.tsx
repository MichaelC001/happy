import * as React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { compactCount, type VisibleRigGitLineChanges } from '@/utils/rigGitLineChanges';

/** Inline counts shared by the chat subtitle and the Changes quick action. */
export const GitLineChanges = React.memo(({ changes }: { changes: VisibleRigGitLineChanges | null }) => {
    if (!changes) return null;
    return (
        <View style={styles.container}>
            {changes.approximate && <Text style={styles.approximate}>≈</Text>}
            {changes.insertions > 0 && <Text style={styles.added}>+{compactCount(changes.insertions)}</Text>}
            {changes.deletions > 0 && <Text style={styles.removed}>-{compactCount(changes.deletions)}</Text>}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        gap: 4,
    },
    approximate: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        lineHeight: 14,
        ...Typography.default(),
    },
    added: {
        color: theme.colors.gitAddedText,
        fontSize: 12,
        lineHeight: 14,
        ...Typography.default('semiBold'),
    },
    removed: {
        color: theme.colors.gitRemovedText,
        fontSize: 12,
        lineHeight: 14,
        ...Typography.default('semiBold'),
    },
}));