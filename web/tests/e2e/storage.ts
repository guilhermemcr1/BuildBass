// Estado de partida dos cenários do modo Normal: preferências vazias, a não ser pelo assistente,
// que abriria sozinho na primeira visita e cobriria a bancada.
export function normalMode(origin: string) {
    return {
        cookies: [],
        origins: [
            {
                origin,
                localStorage: [
                    {
                        name: 'buildbass.preferences',
                        value: JSON.stringify({
                            state: { assistantSeen: true },
                            version: 3,
                        }),
                    },
                ],
            },
        ],
    };
}

export const PREVIEW_ORIGIN = 'http://127.0.0.1:4173';
export const DEV_ORIGIN = 'http://127.0.0.1:5173';
