const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function layout(ratio) {
    return loadTypeScript('presentation/movies/components/moviePosterLayout.ts', {
        'react-native': {PixelRatio: {get: () => ratio}},
    });
}

test('poster tiles choose the catalog cover that covers their drawn width', () => {
    const ladder = ['https://yts.pw/assets/images/movies/a/medium-cover.jpg', 'https://yts.pw/assets/images/movies/a/large-cover.jpg'];
    assert.equal(layout(1).posterRung(ladder, 152), 0);
    assert.equal(layout(3).posterRung(ladder, 76), 0);
    assert.equal(layout(2).posterRung(ladder, 152), 1);
    assert.equal(layout(3).posterRung(ladder, 152), 1);
    assert.equal(layout(3).posterRung(ladder, 400), 1);
    assert.equal(layout(3).posterRung(ladder.slice(1), 152), 0);
    assert.equal(layout(3).posterRung([], 152), 0);
});
