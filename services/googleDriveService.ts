
import { gapi } from 'gapi-script';

// Definição global para o novo Google Identity Services
declare const google: any;

// Safe accessor for import.meta.env
const getMetaEnv = () => {
    try {
        // @ts-ignore
        return (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {} as any;
    } catch {
        return {} as any;
    }
};

const metaEnv = getMetaEnv();

const CLIENT_ID = metaEnv.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '553528521350-brfoh127vbtbumfuesdp1qanir8q7734.apps.googleusercontent.com';
const API_KEY = metaEnv.API_KEY || process.env.API_KEY || ''; 

// Escopos necessários para acessar o Drive e Perfil
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"; 

const FOLDER_NAME = "GestOs_Data_v2";
const DB_FILE_NAME = "database.json";

// Variáveis de Estado Interno
let tokenClient: any = null;
let currentAccessToken: string | null = null;
let currentUserProfile: any = null;
let tokenExpirationTime: number = 0;

// Helper para obter gapi de forma segura
const getGapi = (): any => {
    return (window as any).gapi || gapi;
};

export const driveService = {
    /**
     * Inicializa apenas o script básico.
     * NÃO carrega mais a biblioteca 'drive' via gapi para evitar o erro de Discovery.
     */
    initClient: () => {
        return new Promise<void>((resolve, reject) => {
            const startLoad = () => {
                const g = getGapi();
                if (!g) { 
                    setTimeout(startLoad, 500); 
                    return; 
                }

                g.load('client', async () => {
                    try {
                        // Apenas inicializamos com a API Key. 
                        // REMOVIDO: discoveryDocs e gapi.client.load('drive')
                        // Isso elimina o erro "discovery response missing required fields"
                        await g.client.init({
                            apiKey: API_KEY,
                        });
                        resolve();
                    } catch (err) {
                        console.warn("Aviso na inicialização GAPI (não crítico se Auth funcionar):", err);
                        // Resolvemos mesmo com erro, pois usaremos REST calls diretas
                        resolve();
                    }
                });
            };
            setTimeout(startLoad, 100);
        });
    },

    /**
     * Autenticação usando Google Identity Services (GIS)
     */
    signIn: async (): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined') {
                alert("O serviço de autenticação Google (GIS) não foi carregado. Verifique a sua conexão.");
                return reject("GIS script not found");
            }

            // Inicializa o cliente de Token (se ainda não existir)
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: async (resp: any) => {
                    if (resp.error) {
                        console.error("Erro Auth:", resp);
                        reject(resp);
                        return;
                    }

                    // Armazenar Token
                    currentAccessToken = resp.access_token;
                    // Define validade (token dura ~1h, definimos expiração segura)
                    tokenExpirationTime = Date.now() + (Number(resp.expires_in) * 1000) - 60000;

                    // Obter perfil do utilizador manualmente
                    try {
                        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${resp.access_token}` }
                        }).then(res => res.json());

                        // Normalizar para o formato que a app espera
                        const profile = {
                            getId: () => userInfo.sub,
                            getName: () => userInfo.name,
                            getEmail: () => userInfo.email,
                            getImageUrl: () => userInfo.picture
                        };
                        
                        currentUserProfile = profile;
                        resolve(profile);
                    } catch (error) {
                        console.error("Erro ao obter perfil:", error);
                        reject(error);
                    }
                },
            });

            // Forçar prompt se token não existir ou expirado
            if (!currentAccessToken || Date.now() > tokenExpirationTime) {
                tokenClient.requestAccessToken({ prompt: '' }); // Tenta login silencioso ou popup se necessário
            } else {
                // Se já temos token válido, retornamos o perfil imediatamente
                resolve(currentUserProfile);
            }
        });
    },

    signOut: async () => {
        const g = getGapi();
        if (g.client) g.client.setToken(null);
        
        if (currentAccessToken && typeof google !== 'undefined' && google.accounts) {
            google.accounts.oauth2.revoke(currentAccessToken, () => {console.log('Token Revogado')});
        }
        
        currentAccessToken = null;
        currentUserProfile = null;
    },

    isSignedIn: () => {
        return !!currentAccessToken && Date.now() < tokenExpirationTime;
    },

    getUserProfile: () => {
        return currentUserProfile;
    },

    // --- FILE OPERATIONS: REST API DIRECT CALLS (NO GAPI DEPENDENCY) ---

    findFolder: async () => {
        if (!currentAccessToken) return null;
        
        const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${currentAccessToken}` }
        });
        
        const data = await res.json();
        return data.files?.[0] || null;
    },

    createFolder: async () => {
        const metadata = {
            'name': FOLDER_NAME,
            'mimeType': 'application/vnd.google-apps.folder'
        };
        
        const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
        
        return await res.json(); // Retorna { id: "..." }
    },

    findFile: async (folderId: string) => {
        const q = `name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${currentAccessToken}` }
        });
        
        const data = await res.json();
        return data.files?.[0] || null;
    },

    createFile: async (folderId: string, content: any) => {
        const fileContent = JSON.stringify(content);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: DB_FILE_NAME,
            mimeType: 'application/json',
            parents: [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + currentAccessToken }),
            body: form
        });
        return await res.json();
    },

    updateFile: async (fileId: string, content: any) => {
        const fileContent = JSON.stringify(content);
        const file = new Blob([fileContent], { type: 'application/json' });
        
        // Upload simples (media) é mais robusto para atualizações de JSON
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: new Headers({ 
                'Authorization': 'Bearer ' + currentAccessToken,
                'Content-Type': 'application/json'
            }),
            body: file
        });
        return res;
    },

    readFile: async (fileId: string) => {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': 'Bearer ' + currentAccessToken }
        });
        return await res.json();
    }
};
