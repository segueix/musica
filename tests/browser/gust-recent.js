// Dona a la portada un gust propi perquè «La teva ràdio» es faci amb els artistes de l'usuari (i no demani els estils
// de la primera vegada): 4 cançons d'artistes diferents a l'historial, de fa pocs minuts, i aquests 4 artistes seguits.
// Des del 2026-10-20 «La teva ràdio» només es fa amb els m'agrades i els artistes seguits: l'historial sol no hi compta.
async function ambGustRecent(page) {
    await page.evaluate(() => {
        // Si la prova ja ha preparat un historial, es respecta
        let history = JSON.parse(localStorage.getItem('catube_history') || '[]');
        if (history.length < 3) {
            const seen = new Set();
            const songs = [];
            for (const video of currentFeedVideos) {
                if (video.contentType === 'song' && !video.isShort && video.thumbnail && !seen.has(video.channelId)) {
                    seen.add(video.channelId);
                    songs.push({ ...video, viewedAt: new Date(Date.now() - songs.length * 60000).toISOString() });
                }
                if (songs.length >= 4) break;
            }
            localStorage.setItem('catube_history', JSON.stringify(songs));
            history = songs;
            if (typeof _historyItemsCache !== 'undefined') _historyItemsCache = null;
        }
        // I segueix els artistes d'aquest historial (si la prova no n'ha seguit cap)
        if (!JSON.parse(localStorage.getItem('catube_follows') || '[]').length) {
            const follows = [...new Set(history.map(video => String(video.channelId)).filter(Boolean))].slice(0, 4);
            localStorage.setItem('catube_follows', JSON.stringify(follows));
        }
        SegueixApp.features.portada.updateEntry();
    });
}

module.exports = { ambGustRecent };
