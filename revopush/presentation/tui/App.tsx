import React, {useState} from 'react';
import {Box, Text, useApp} from 'ink';
import {REPO_ROOT} from '../container.js';
import {useAuth} from './useAuth.js';
import {LoginGate} from './LoginGate.js';
import {MainMenu} from './MainMenu.js';
import {BaseFlow} from './BaseFlow.js';
import {CodePushFlow} from './CodePushFlow.js';

type View = 'menu' | 'base' | 'codepush';

export default function App() {
    const {exit} = useApp();
    const auth = useAuth();
    const [view, setView] = useState<View>('menu');

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text>
                <Text bold color="magenta">
                    RevoPush Release Console
                </Text>
                {auth.version ? <Text dimColor> v{auth.version}</Text> : null}
                <Text dimColor> · repo: {REPO_ROOT}</Text>
            </Text>
            {auth.email ? <Text dimColor>Logged in as {auth.email}</Text> : null}
            {auth.branch ? <Text dimColor>Branch: {auth.branch}</Text> : null}
            <Box marginTop={1}>
                {auth.screen === 'loading' && <Text>Checking RevoPush login…</Text>}
                {auth.screen === 'gate' && <LoginGate auth={auth} onQuit={exit}/>}
                {auth.screen === 'menu' && view === 'menu' && (
                    <MainMenu
                        auth={auth}
                        onPick={(s) => (s === 'quit' ? exit() : setView(s))}
                    />
                )}
                {auth.screen === 'menu' && view === 'base' && (
                    <BaseFlow onDone={() => setView('menu')}/>
                )}
                {auth.screen === 'menu' && view === 'codepush' && (
                    <CodePushFlow
                        onDone={() => setView('menu')}
                        onNeedBase={() => setView('base')}
                    />
                )}
            </Box>
        </Box>
    );
}
