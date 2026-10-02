'use strict';

// Aprima data/feed.json sense YouTube API (el generador ho fa sol a cada actualització). Idempotent.
// Ús: node scripts/aprimar_feed.js

const fs = require('fs');
const path = require('path');
const { slimFeed, serializeFeed } = require('./lib/aprimar_feed');

const FEED = path.join(process.cwd(), 'data', 'feed.json');
const before = fs.readFileSync(FEED, 'utf8');
const after = serializeFeed(slimFeed(JSON.parse(before)));
if (after !== before) fs.writeFileSync(FEED, after);
const mb = text => (Buffer.byteLength(text) / 1e6).toFixed(2);
console.log(`✅ data/feed.json: ${mb(before)} MB → ${mb(after)} MB.`);
