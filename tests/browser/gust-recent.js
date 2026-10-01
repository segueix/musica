// Dona a la portada un gust recent perquè «La teva ràdio» es faci amb el que s'ha escoltat (i no demani els estils
// de la primera vegada): 4 cançons d'artistes diferents a l'historial, de fa pocs minuts.
async function ambGustRecent(page) {
    await page.evaluate(() => {
        // Si la prova ja ha preparat un historial, es respecta
        if (JSON.parse(localStorage.getItem('catube_history') || '[]').length >= 3) return;
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
        if (typeof _historyItemsCache !== 'undefined') _historyItemsCache = null;
        SegueixApp.features.portada.updateEntry();
    });
}

module.exports = { ambGustRecent };
