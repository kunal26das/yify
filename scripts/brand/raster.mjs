import {inflateSync} from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4};
const DEPTHS = {0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16]};
export const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

export function paeth(left, up, upLeft) {
    const estimate = left + up - upLeft;
    const toLeft = Math.abs(estimate - left);
    const toUp = Math.abs(estimate - up);
    const toUpLeft = Math.abs(estimate - upLeft);
    if (toLeft <= toUp && toLeft <= toUpLeft) return left;
    return toUp <= toUpLeft ? up : upLeft;
}

function unfilter(type, row, previous, step) {
    if (type > 4) throw new Error(`unknown PNG row filter ${type}`);
    for (let index = 0; index < row.length; index += 1) {
        const left = index >= step ? row[index - step] : 0;
        const upLeft = index >= step ? previous[index - step] : 0;
        const up = previous[index];
        if (type === 1) row[index] = (row[index] + left) & 255;
        else if (type === 2) row[index] = (row[index] + up) & 255;
        else if (type === 3) row[index] = (row[index] + ((left + up) >> 1)) & 255;
        else if (type === 4) row[index] = (row[index] + paeth(left, up, upLeft)) & 255;
    }
}

function readChunks(buffer) {
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG image');
    const chunks = {data: []};
    for (let offset = 8; offset < buffer.length;) {
        if (offset + 8 > buffer.length) throw new Error('truncated PNG chunk header');
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('latin1', offset + 4, offset + 8);
        const body = buffer.subarray(offset + 8, offset + 8 + length);
        if (body.length !== length) throw new Error(`truncated PNG ${type} chunk`);
        offset += length + 12;
        if (type === 'IHDR') chunks.header = body;
        else if (type === 'PLTE') chunks.palette = body;
        else if (type === 'tRNS') chunks.transparency = body;
        else if (type === 'IDAT') chunks.data.push(body);
        else if (type === 'IEND') break;
    }
    if (!chunks.header || chunks.header.length < 13) throw new Error('PNG has no IHDR chunk');
    return chunks;
}

export function decodePng(buffer) {
    const {header, palette, transparency, data} = readChunks(buffer);
    const width = header.readUInt32BE(0);
    const height = header.readUInt32BE(4);
    const [depth, color, , , interlace] = header.subarray(8, 13);
    if (!DEPTHS[color]?.includes(depth)) throw new Error(`unsupported PNG colour type ${color} at bit depth ${depth}`);
    if (color === 3 && !palette) throw new Error('palette PNG has no PLTE chunk');
    if (interlace > 1) throw new Error(`unknown PNG interlace method ${interlace}`);
    const channels = CHANNELS[color];
    const bits = channels * depth;
    const step = Math.max(1, bits >> 3);
    const sample = (row, index) => {
        if (depth === 16) return row.readUInt16BE(index * 2);
        if (depth === 8) return row[index];
        const bit = index * depth;
        return (row[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    };
    const eight = (value) => (depth === 16 ? value >> 8 : depth === 8 ? value : Math.round((value * 255) / ((1 << depth) - 1)));
    const key = (index) => (transparency && transparency.length >= index * 2 + 2 ? transparency.readUInt16BE(index * 2) : -1);
    const raw = inflateSync(Buffer.concat(data));
    const pixels = new Uint8Array(width * height * 4);
    let offset = 0;
    for (const [left, top, across, down] of interlace ? ADAM7 : [[0, 0, 1, 1]]) {
        const columns = Math.ceil((width - left) / across);
        const rows = Math.ceil((height - top) / down);
        if (columns <= 0 || rows <= 0) continue;
        const stride = Math.ceil((columns * bits) / 8);
        let previous = new Uint8Array(stride);
        for (let y = 0; y < rows; y += 1) {
            if (offset + stride + 1 > raw.length) throw new Error('truncated PNG image data');
            const row = raw.subarray(offset + 1, offset + stride + 1);
            unfilter(raw[offset], row, previous, step);
            offset += stride + 1;
            for (let x = 0; x < columns; x += 1) {
                const target = ((top + y * down) * width + left + x * across) * 4;
                const first = x * channels;
                if (color === 3) {
                    const index = sample(row, x);
                    if (index * 3 + 2 >= palette.length) throw new Error(`PNG palette index ${index} is out of range`);
                    pixels[target] = palette[index * 3];
                    pixels[target + 1] = palette[index * 3 + 1];
                    pixels[target + 2] = palette[index * 3 + 2];
                    pixels[target + 3] = transparency && index < transparency.length ? transparency[index] : 255;
                } else if (color === 0 || color === 4) {
                    const gray = sample(row, first);
                    pixels[target] = pixels[target + 1] = pixels[target + 2] = eight(gray);
                    pixels[target + 3] = color === 4 ? eight(sample(row, first + 1)) : gray === key(0) ? 0 : 255;
                } else {
                    const [red, green, blue] = [sample(row, first), sample(row, first + 1), sample(row, first + 2)];
                    pixels[target] = eight(red);
                    pixels[target + 1] = eight(green);
                    pixels[target + 2] = eight(blue);
                    const keyed = red === key(0) && green === key(1) && blue === key(2);
                    pixels[target + 3] = color === 6 ? eight(sample(row, first + 3)) : keyed ? 0 : 255;
                }
            }
            previous = row;
        }
    }
    return {width, height, pixels};
}

export function decodeIco(buffer) {
    if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) throw new Error('not an ICO image');
    const images = [];
    for (let index = 0; index < buffer.readUInt16LE(4); index += 1) {
        const entry = 6 + index * 16;
        if (entry + 16 > buffer.length) throw new Error('truncated ICO directory');
        const size = buffer.readUInt32LE(entry + 8);
        const start = buffer.readUInt32LE(entry + 12);
        const layer = buffer.subarray(start, start + size);
        if (layer.length !== size) throw new Error('truncated ICO layer');
        if (!layer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`ICO layer ${index + 1} is a bitmap; save the icon with PNG layers`);
        images.push(decodePng(layer));
    }
    if (!images.length) throw new Error('ICO has no layers');
    return images;
}
