import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {Channel, Coverage, Platform, StoreReleaseResult, ValidateResult,} from './types.js';

export class StoreReleaseViewModel extends Emitter {
    validatedVersion = '';

    invalidate(): void {
        this.validatedVersion = '';
    }

    async validate(
        apkPath: string,
        ipaPath: string,
        platforms: Platform[],
    ): Promise<ValidateResult> {
        this.validatedVersion = '';
        const res = await bridge.validateBinaries(apkPath, ipaPath, platforms);
        if (res.ok) this.validatedVersion = res.version;
        return res;
    }

    async releaseCoverage(
        platforms: Platform[],
        channels: Channel[],
    ): Promise<Coverage> {
        return bridge.releaseCoverage(platforms, channels);
    }

    async allSlotsCovered(
        platforms: Platform[],
        channels: Channel[],
    ): Promise<boolean> {
        const {covered} = await this.releaseCoverage(platforms, channels);
        return covered;
    }

    run(
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: Platform[],
        channels: Channel[],
    ): Promise<StoreReleaseResult> {
        return bridge.runStoreRelease(
            apkPath,
            ipaPath,
            version,
            platforms,
            channels,
        );
    }
}
