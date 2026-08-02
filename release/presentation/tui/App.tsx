import React, {useState} from 'react';
import {Box, Text, useApp} from 'ink';
import {REPO_ROOT} from '../container.js';
import {useAuth} from './useAuth.js';
import {LoginGate} from './LoginGate.js';
import {MainMenu} from './MainMenu.js';
import {StoreFlow} from './StoreFlow.js';
import {UpdateFlow} from './UpdateFlow.js';

type View = 'menu' | 'store' | 'update';

export default function App() {
    const {exit} = useApp();
    const auth = useAuth();
    const [view, setView] = useState<View>('menu');

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text>
                <Text bold color="magenta">
                    Yify Release Console
                </Text>
                {auth.version ? <Text dimColor> v{auth.version}</Text> : null}
                <Text dimColor> · repo: {REPO_ROOT}</Text>
            </Text>
            {auth.account ? (
                <Text dimColor>Logged in as {auth.account}</Text>
            ) : null}
            {auth.branch ? <Text dimColor>Branch: {auth.branch}</Text> : null}
            <Box marginTop={1}>
                {auth.screen === 'loading' && <Text>Checking Expo login…</Text>}
                {auth.screen === 'gate' && <LoginGate auth={auth} onQuit={exit}/>}
                {auth.screen === 'menu' && view === 'menu' && (
                    <MainMenu
                        auth={auth}
                        onPick={(s) => (s === 'quit' ? exit() : setView(s))}
                    />
                )}
                {auth.screen === 'menu' && view === 'store' && (
                    <StoreFlow onDone={() => setView('menu')}/>
                )}
                {auth.screen === 'menu' && view === 'update' && (
                    <UpdateFlow
                        onDone={() => setView('menu')}
                        onNeedStoreRelease={() => setView('store')}
                    />
                )}
            </Box>
        </Box>
    );
}
