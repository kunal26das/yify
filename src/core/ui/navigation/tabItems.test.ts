import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESTINATIONS, destinationForRoute, destinationForSegments} from './destinations';
import {tabLabel} from './tabItems';

test('the four destinations map routes, links and icons', () => {
  assert.deepEqual(DESTINATIONS.map((destination) => [destination.route, destination.href, destination.label, destination.icon]), [
    ['(home)', '/', 'Home', 'home'],
    ['(search)', '/search', 'Search', 'search'],
    ['(library)', '/library', 'Library', 'video_library'],
    ['(you)', '/you', 'You', 'account_circle'],
  ]);
  assert.equal(destinationForRoute('(library)')?.href, '/library');
  assert.equal(destinationForRoute('settings'), null);
  assert.equal(destinationForSegments(['(tabs)', '(you)', 'settings']).href, '/you');
  assert.equal(destinationForSegments(['movie', '[id]']).href, '/');
});

test('tab labels follow the Android pattern and add the billing issue', () => {
  const item = {key: 'k', destination: DESTINATIONS[3], focused: false, index: 3, count: 4, billing: true, onPress: () => undefined, onLongPress: () => undefined};
  assert.equal(tabLabel(item, 'native'), 'You, tab, 4 of 4, payment issue');
  assert.equal(tabLabel({...item, billing: false}, 'web'), 'You');
});
