import * as React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ToolCall } from '@/sync/typesMessage';
import { Metadata } from '@/sync/storageTypes';
import { CommandView } from '@/components/CommandView';
import { getTerminalToolCommand, getToolActivityLabel } from '@/utils/toolDisplay';
import { getShellControl } from '@/utils/happyToolDisplay';
import { getTerminalToolResult } from '@/utils/toolResult';
import { CodeView } from '@/components/CodeView';
import { ToolSectionView } from '../ToolSectionView';
import { t } from '@/text';

interface BashViewFullProps {
    tool: ToolCall;
    metadata: Metadata | null;
}

export const BashViewFull = React.memo<BashViewFullProps>(({ tool, metadata }) => {
    const command = getTerminalToolCommand(tool);
    const control = getShellControl(tool);
    const result = getTerminalToolResult(tool);

    return (
        <View style={styles.container}>
            <View style={styles.terminalContainer}>
                <ScrollView 
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.commandWrapper}>
                        <CommandView
                            command={command ?? getToolActivityLabel(tool)}
                            prompt={command ? '$' : ''}
                            {...result}
                            error={tool.state === 'error' ? result.error || t('tools.fullView.error') : null}
                            hideEmptyOutput={tool.state === 'running'}
                            fullWidth
                        />
                        {control?.chars !== undefined && (
                            <ToolSectionView title={t('toolView.input')}>
                                <CodeView code={control.chars} />
                            </ToolSectionView>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 0,
        paddingTop: 32,
        paddingBottom: 64,
        marginBottom: 0,
        flex: 1,
    },
    terminalContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    commandWrapper: {
        flex: 1,
        minWidth: '100%',
    },
});