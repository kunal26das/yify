import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {BaseReleaseResult, Coverage, Deployment, Platform, ValidateResult,} from './types.js';

export class BaseReleaseViewModel extends Emitter {
    validatedVersion = '';

    invalidate(): void {
        this.validatedVersion = '';
    }

    async validate(
        apkPath: string,
        ipaPath: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<ValidateResult> {
        this.validatedVersion = '';
        const res = await bridge.validateBinaries(
            apkPath,
            ipaPath,
            platforms,
            deployments,
        );
        if (res.ok) this.validatedVersion = res.version;
        return res;
    }

    async baseCoverage(
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<Coverage> {
        return bridge.baseCoverage(version, platforms, deployments);
    }

    async allSlotsCovered(
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<boolean> {
        const {covered} = await this.baseCoverage(
            version,
            platforms,
            deployments,
        );
        return covered;
    }

    run(
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<BaseReleaseResult> {
        return bridge.runBaseRelease(
            apkPath,
            ipaPath,
            version,
            platforms,
            deployments,
        );
    }
}
