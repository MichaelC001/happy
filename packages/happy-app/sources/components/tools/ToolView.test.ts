import * as React from 'react';
// @ts-expect-error react-test-renderer has no declarations in this workspace.
import { act, create } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ToolCall } from '@/sync/typesMessage';

const settings = vi.hoisted(() => ({ compact: false, platform: 'ios' }));
vi.mock('react-native', async () => {
    const React = await import('react');
    const host = (name: string) => (props: any) => React.createElement(name, props, props.children);
    return {
        View: host('View'), Text: host('Text'), ScrollView: host('ScrollView'), Pressable: host('Pressable'),
        TouchableOpacity: host('TouchableOpacity'), ActivityIndicator: host('ActivityIndicator'),
        Platform: { get OS() { return settings.platform; }, select: (value: any) => value[settings.platform] ?? value.default },
        StyleSheet: { create: (styles: any) => styles }, useWindowDimensions: () => ({ width: 390 }),
    };
});
vi.mock('react-native-unistyles', () => ({
    StyleSheet: { create: () => ({}) },
    useUnistyles: () => ({ theme: { colors: { text: 'black', textSecondary: 'gray', warning: 'orange', header: { tint: 'black' } } } }),
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null, Octicons: () => null }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/sync/storage', () => ({ useSetting: () => settings.compact, useLocalSetting: () => false }));
vi.mock('@/hooks/useElapsedTime', () => ({ useElapsedTime: () => 0 }));
vi.mock('@/text', () => ({ t: (key: string) => key }));
vi.mock('../layout', () => ({ layout: { maxWidth: 800 } }));
vi.mock('../CodeView', async () => {
    const React = await import('react');
    return { CodeView: (props: any) => React.createElement('CodeView', props) };
});
vi.mock('../CommandView', async () => {
    const React = await import('react');
    return { CommandView: (props: any) => React.createElement('CommandView', props) };
});
vi.mock('./ToolSectionView', async () => {
    const React = await import('react');
    return { ToolSectionView: (props: any) => React.createElement('Section', props, props.children) };
});
vi.mock('./PermissionFooter', async () => {
    const React = await import('react');
    return { PermissionFooter: (props: any) => React.createElement('PermissionFooter', props) };
});
vi.mock('./ToolError', async () => {
    const React = await import('react');
    return { ToolError: (props: any) => React.createElement('ToolError', props) };
});
vi.mock('./ToolDiffView', async () => {
    const React = await import('react');
    return { ToolDiffView: (props: any) => React.createElement('DiffView', props) };
});
vi.mock('./views/_all', async () => {
    const React = await import('react');
    const { isTerminalToolName } = await import('@/utils/toolDisplay');
    const { BashViewFull } = await import('./views/BashViewFull');
    const { CodexPatchViewFull } = await import('./views/CodexPatchView');
    return {
        getToolViewComponent: (name: string) => ['apply_patch', 'CodexPatch', 'request_user_input', 'file'].includes(name)
            ? () => React.createElement('SpecializedView', { name }) : null,
        getToolFullViewComponent: (name: string) => isTerminalToolName(name) ? BashViewFull
            : name === 'apply_patch' ? CodexPatchViewFull : null,
    };
});

import { ToolView } from './ToolView';
import { ToolFullView } from './ToolFullView';
import { ToolHeader } from './ToolHeader';
import { CodexPatchView } from './views/CodexPatchView';
import { TaskView } from './views/TaskView';

const renderers: ReturnType<typeof create>[] = [];
function render(element: React.ReactElement) {
    let result: ReturnType<typeof create>;
    act(() => { result = create(element); });
    renderers.push(result!);
    return result!;
}
function tool(name: string, input: unknown = {}): ToolCall {
    return { name, input, description: null, state: 'completed', createdAt: 1, startedAt: 1, completedAt: 2 };
}
beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('__DEV__', false);
    const original = console.error;
    vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
        if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) return;
        original(message, ...args);
    });
});
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterEach(() => {
    act(() => renderers.splice(0).forEach(renderer => renderer.unmount()));
    settings.compact = false;
});

describe('tool rendering on mobile and web', () => {
    it.each(['ios', 'android', 'web'])('shows commands and generic activities without raw chat JSON on %s', platform => {
        settings.platform = platform;
        const command = render(React.createElement(ToolView, {
            tool: { ...tool('CodexBash', { command: 'git status' }), description: 'Running CodexBash' }, metadata: null,
        }));
        expect(JSON.stringify(command.toJSON())).toContain('git status');
        expect(JSON.stringify(command.toJSON())).not.toContain('Running CodexBash');
        for (const name of ['write_stdin', 'kill_session', 'BashOutput', 'BashInput', 'BashStop', 'send_command_input', 'get_command_or_subagent_output', 'kill_command_or_subagent', 'create_agent', 'read_user_input', 'cancel_ask', 'future_tool']) {
            const row = render(React.createElement(ToolView, { tool: tool(name), metadata: null, sessionId: 's1', messageId: 'm1' }));
            expect(row.root.findAllByType('CodeView')).toHaveLength(0);
            expect(row.root.findAllByType('TouchableOpacity')).toHaveLength(1);
        }
    });

    it('preserves pending approval inputs and permission controls', () => {
        settings.compact = true;
        const pending = { ...tool('unknown', { path: '/sensitive' }), permission: { id: 'p1', status: 'pending' as const } };
        const row = render(React.createElement(ToolView, { tool: pending, metadata: null, sessionId: 's1' }));
        expect(row.root.findAllByType('CodeView')).toHaveLength(1);
        expect(row.root.findAllByType('PermissionFooter')).toHaveLength(1);
    });

    it('keeps patch diffs expanded and questions/attachments inline even in compact mode', () => {
        const patch = render(React.createElement(ToolView, { tool: tool('apply_patch'), metadata: null }));
        expect(patch.root.findAllByType('SpecializedView')).toHaveLength(1);
        settings.compact = true;
        for (const name of ['request_user_input', 'file']) {
            const row = render(React.createElement(ToolView, { tool: tool(name), metadata: null }));
            expect(row.root.findAllByType('SpecializedView')).toHaveLength(1);
        }
    });

    it('uses the wire title in the detail header', () => {
        const header = render(React.createElement(ToolHeader, { tool: { ...tool('future_tool'), title: 'Check release' } }));
        expect(JSON.stringify(header.toJSON())).toContain('Check release');
        expect(JSON.stringify(header.toJSON())).not.toContain('future_tool');
    });

    it('uses the same readable labels for tools inside a task', () => {
        const children = [
            { ...tool('CodexBash', { command: 'git status' }), description: 'Running CodexBash' },
            tool('write_stdin', { session_id: 1 }),
            tool('tool_search'),
        ];
        const task = render(React.createElement(TaskView, {
            tool: tool('Task'), metadata: null,
            messages: children.map((tool, i) => ({ kind: 'tool-call' as const, id: `m${i}`, createdAt: 1, localId: null, tool, children: [] })),
        }));
        const output = JSON.stringify(task.toJSON());
        expect(output).toContain('git status');
        expect(output).toContain('Waiting for shell output (1)');
        expect(output).not.toContain('Running CodexBash');
        expect(output).not.toContain('write_stdin');
        expect(output).not.toContain('tool_search');
    });

    it.each(['Bash', 'CodexBash', 'exec_command', 'run_terminal_command', 'write_stdin', 'BashOutput'])('keeps %s output visible on the detail screen', name => {
        const full = render(React.createElement(ToolFullView, { tool: { ...tool(name, { command: 'echo hello' }), result: 'hello' } }));
        expect(full.root.findByType('CommandView').props.stdout).toBe('hello');
    });

    it('renders shell input distinctly from its output and keeps failures visible', () => {
        const full = render(React.createElement(ToolFullView, {
            tool: { ...tool('write_stdin', { session_id: 1, chars: 'yes\n' }), state: 'error', result: 'process exited' },
        }));
        expect(full.root.findByType('CommandView').props).toMatchObject({
            command: 'Sending input to shell (1)', prompt: '', error: 'process exited',
        });
        expect(full.root.findByType('CodeView').props.code).toBe('yes\n');
    });

    it('renders raw apply_patch as a diff and retains execution failures', () => {
        const patch = '*** Begin Patch\n*** Update File: a.ts\n@@\n-old\n+new\n*** End Patch';
        const call = { ...tool('apply_patch', { patch }), state: 'error' as const, result: 'Context did not match' };
        const inline = render(React.createElement(CodexPatchView, { tool: call, metadata: null }));
        expect(inline.root.findByType('DiffView').props).toMatchObject({ oldText: 'old', newText: 'new' });
        expect(inline.root.findByType('ToolError').props.message).toBe('Context did not match');
        const full = render(React.createElement(ToolFullView, { tool: call }));
        expect(full.root.findByType('ToolError').props.message).toBe('Context did not match');
    });

    it('falls back to unescaped patch text without losing permission controls on a malformed patch', () => {
        const patch = '*** Begin Patch\n*** Update File: a.ts\n@@\n-old\n+new';
        const row = render(React.createElement(CodexPatchView, {
            tool: tool('apply_patch', { patch }), metadata: null,
            permissionFooter: React.createElement('PermissionFooter'),
        }));
        expect(row.root.findByType('CodeView').props.code).toBe(patch);
        expect(row.root.findAllByType('PermissionFooter')).toHaveLength(1);
    });
});