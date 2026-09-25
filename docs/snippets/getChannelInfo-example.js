const cachedChannels = [
    { id: 'UC123', title: 'Canal de Prova', subscriberCount: 1000 },
    { id: 'UC456', title: 'Tutorials JS', subscriberCount: 5000 }
];

const YouTubeAPI = {
    getChannelDetails: async (id) => {
        // Crida a xarxa simulada
    }
};

async function getChannelInfo(channelId) {
    try {
        const channel = await YouTubeAPI.getChannelDetails(channelId);

        if (channel != null) {
            return channel;
        }

        throw new Error('Empty channel response from API');
    } catch (error) {
        const fallbackChannel = cachedChannels.find(channel => channel.id === channelId);

        if (fallbackChannel) {
            return fallbackChannel;
        }

        return {
            id: channelId,
            title: 'Canal Desconegut',
            isFallback: true
        };
    }
}
