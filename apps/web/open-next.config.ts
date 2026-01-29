import type { OpenNextConfig } from '@opennextjs/cloudflare';

const config: OpenNextConfig = {
    default: {
        override: {
            wrapper: 'cloudflare-pages',
            converter: 'edge',
            incrementalCache: 'dummy',
            tagCache: 'dummy',
            queue: 'dummy',
        },
    },
};

export default config;
