import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import type {BinaryInspector, Workspace} from '../../domain/index.js';

const require = createRequire(import.meta.url);

export function createBinaryInspector(deps: {
    workspace: Workspace;
}): BinaryInspector {
    const repoRoot = deps.workspace.repoRoot;

    async function versionFromBinary(filePath: string): Promise<string> {
        const AppInfoParser = require('app-info-parser');
        const result = await new AppInfoParser(filePath).parse();
        const version: string | undefined =
            result?.versionName ||
            result?.CFBundleShortVersionString ||
            result?.version;
        if (!version) {
            throw new Error(
                `Could not read a version from ${path.basename(filePath)}.`,
            );
        }
        return String(version).trim();
    }

    function repoPackageVersion(): string {
        const pkgPath = path.join(repoRoot, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return String(pkg.version ?? '').trim();
    }

    function repoTargetVersion(): string {
        return repoPackageVersion().replace(/-.*$/, '').trim();
    }

    function exists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    return {versionFromBinary, repoPackageVersion, repoTargetVersion, exists};
}
