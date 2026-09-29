'use strict';

const assert = require('node:assert/strict');
const { classifyMusicContent } = require('./lib/classificar_contingut_musical');

function item(title, description, categoryId, seconds, tags=[]){
  return { snippet:{title,description,categoryId,tags}, durationSeconds:seconds };
}

const official={types:['official'],artistNames:['Antònia Font'],channelTitle:'Antònia Font'};
const topic={types:['topic'],artistNames:['Antònia Font'],channelTitle:'Antònia Font - Topic'};

assert.equal(classifyMusicContent({item:item('Alegria','','10',230),channelMeta:topic}).contentType,'song');
assert.equal(classifyMusicContent({item:item('Alegria (Official Video)','','10',240),channelMeta:official}).accepted,true);
assert.equal(classifyMusicContent({item:item('Concert complet - Primavera','','10',5400),channelMeta:official}).accepted,false);
assert.equal(classifyMusicContent({item:item('Entrevista a Antònia Font','','10',420),channelMeta:official}).accepted,false);
assert.equal(classifyMusicContent({item:item('Lamparetes - Full Album','','10',2700),channelMeta:official}).contentType,'album');
assert.equal(classifyMusicContent({item:item('Alegria - Live Session','','10',260),channelMeta:official}).contentType,'live_song');
assert.equal(classifyMusicContent({item:item('Teaser nou disc','','10',20),channelMeta:official}).accepted,false);

assert.equal(classifyMusicContent({item:item('Els Amics de les Arts - Festes de la Mercè 2026','','10',55),channelMeta:official}).accepted,false);
assert.equal(classifyMusicContent({item:item('Un concert com els d\'abans','','10',316),channelMeta:official}).accepted,false);

console.log('✅ Classificador de contingut musical correcte.');
