import {createCatalogHandler} from '../server/catalog/handler';
import {createCatalogRepositories} from '../server/catalog/repositories';
import {createSubscriberAuthorizer} from '../server/subscribers';

export const handleNativeSubscriberCatalogRequest = createCatalogHandler(
    signal => createCatalogRepositories(undefined, {signal}),
    {subscriber: {authorize: createSubscriberAuthorizer()}, nativeMetadataOnly: true},
);
