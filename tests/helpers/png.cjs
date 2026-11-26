const zlib = require('node:zlib');

const CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4};
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function chunk(type, body) {
    const name = Buffer.from(type, 'latin1');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([name, body])));
    return Buffer.concat([length, name, body, crc]);
}

function paeth(left, up, upLeft) {
    const estimate = left + up - upLeft;
    const toLeft = Math.abs(estimate - left);
    const toUp = Math.abs(estimate - up);
    const toUpLeft = Math.abs(estimate - upLeft);
    if (toLeft <= toUp && toLeft <= toUpLeft) return left;
    return toUp <= toUpLeft ? up : upLeft;
}

function encodePng({width, height, color = 6, depth = 8, interlace = false, palette, transparency, samples, filter = (row) => row % 5}) {
    const bits = CHANNELS[color] * depth;
    const step = Math.max(1, bits >> 3);
    const lines = [];
    for (const [left, top, across, down] of interlace ? ADAM7 : [[0, 0, 1, 1]]) {
        const columns = Math.ceil((width - left) / across);
        const rows = Math.ceil((height - top) / down);
        if (columns <= 0 || rows <= 0) continue;
        const stride = Math.ceil((columns * bits) / 8);
        let previous = Buffer.alloc(stride);
        for (let y = 0; y < rows; y += 1) {
            const row = Buffer.alloc(stride);
            let bit = 0;
            for (let x = 0; x < columns; x += 1) {
                for (const value of samples(left + x * across, top + y * down)) {
                    if (depth === 16) row.writeUInt16BE(value, bit >> 3);
                    else if (depth === 8) row[bit >> 3] = value;
                    else row[bit >> 3] |= value << (8 - depth - (bit & 7));
                    bit += depth;
                }
            }
            const type = filter(y);
            const filtered = Buffer.alloc(stride);
            for (let index = 0; index < stride; index += 1) {
                const before = index >= step ? row[index - step] : 0;
                const above = previous[index];
                const corner = index >= step ? previous[index - step] : 0;
                const prediction = [0, before, above, (before + above) >> 1, paeth(before, above, corner)][type];
                filtered[index] = (row[index] - prediction) & 255;
            }
            lines.push(Buffer.from([type]), filtered);
            previous = row;
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([depth, color, 0, 0, interlace ? 1 : 0], 8);
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        ...(palette ? [chunk('PLTE', Buffer.from(palette))] : []),
        ...(transparency ? [chunk('tRNS', Buffer.from(transparency))] : []),
        chunk('IDAT', zlib.deflateSync(Buffer.concat(lines))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function solidPng(width, height, rgba) {
    return encodePng({width, height, samples: () => rgba});
}

function encodeIco(layers) {
    const directory = Buffer.alloc(6 + layers.length * 16);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(layers.length, 4);
    let offset = directory.length;
    layers.forEach(({size, data}, index) => {
        const entry = 6 + index * 16;
        directory[entry] = size % 256;
        directory[entry + 1] = size % 256;
        directory.writeUInt16LE(1, entry + 4);
        directory.writeUInt16LE(32, entry + 6);
        directory.writeUInt32LE(data.length, entry + 8);
        directory.writeUInt32LE(offset, entry + 12);
        offset += data.length;
    });
    return Buffer.concat([directory, ...layers.map((layer) => layer.data)]);
}

module.exports = {encodeIco, encodePng, solidPng};
