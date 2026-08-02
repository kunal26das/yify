import type {
    AppTarget,
    Channel,
    Job,
    Platform,
} from '../entities/index.js';

export function buildJobs(platforms: Platform[], channels: Channel[]): Job[] {
    const jobs: Job[] = [];
    for (const channel of channels) {
        for (const platform of platforms) {
            jobs.push({platform, channel});
        }
    }
    return jobs;
}

export function jobLabel(
    apps: Record<Platform, AppTarget>,
    platform: Platform,
    channel: Channel,
): string {
    return `${apps[platform].name}→${channel}`;
}
