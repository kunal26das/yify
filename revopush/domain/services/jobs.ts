import type {
    AppTarget,
    Deployment,
    Job,
    Platform,
} from '../entities/index.js';

export function buildJobs(
    platforms: Platform[],
    deployments: Deployment[],
): Job[] {
    const jobs: Job[] = [];
    for (const deployment of deployments) {
        for (const platform of platforms) {
            jobs.push({platform, deployment});
        }
    }
    return jobs;
}

export function jobLabel(
    apps: Record<Platform, AppTarget>,
    platform: Platform,
    deployment: Deployment,
): string {
    return `${apps[platform].name}→${deployment}`;
}
