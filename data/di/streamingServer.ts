import {createStreamingHandler} from '../server/streaming/handler';
import {createStreamingProvider} from '../server/streaming/provider';

const configuredBudget = Number(process.env.YIFY_STREAMING_UPSTREAM_REQUESTS_PER_DAY);

export const handleStreamingRequest = createStreamingHandler(createStreamingProvider({
    apiKey: () => process.env.YIFY_STREAMING_API_KEY,
    maximumRequestsPerDay: Number.isSafeInteger(configuredBudget) && configuredBudget > 0 ? Math.min(configuredBudget, 100_000) : 25,
}));
