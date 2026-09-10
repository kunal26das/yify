import {createCatalogHandler} from '../server/catalog/handler';
import {createCatalogRepositories} from '../server/catalog/repositories';
import {createSubscriberAuthorizer} from '../server/subscribers';

export const handleSubscriberCatalogRequest = createCatalogHandler(
    (signal, onResponse) => createCatalogRepositories(undefined, {signal, onResponse}),
    {subscriber: {authorize: createSubscriberAuthorizer()}},
);
