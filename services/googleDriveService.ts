
import { gapi } from 'gapi-script';

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

// CONFIGURAÇÃO
// Acesso direto com fallback para o ID fornecido pelo utilizador
const CLIENT_ID = metaEnv.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '553528521350-brfoh127vbtbumfuesdp1qanir8q7734.apps.googleusercontent.com';
const API_KEY = metaEnv.API_KEY || process.env.API_KEY || ''; 

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file"; 

const FOLDER_NAME = "GestOs_Data_v2";
const DB_FILE_NAME = "database.json";

let isClientConfigured = false;

// Helper to get gapi with any type to bypass TS errors
const getGapi = (): any => {
    return (window as any).gapi || gapi;
};

export const driveService = {
    initClient: () => {
        return new Promise<void>((resolve, reject) => {
            // Verificação de Configuração sem crashar a app
            if (!CLIENT_ID) {
                console.warn("VITE_GOOGLE_CLIENT_ID não encontrado. O login Google será desativado.");
                isClientConfigured = false;
                resolve(); 
                return;
            }

            const startGapiLoad = () => {
                const g = getGapi();
                
                if (!g) {
                    // console.warn("gapi global not found, retrying...");
                    setTimeout(startGapiLoad, 500); 
                    return;
                }

                g.load('client:auth2', async () => {
                    const gPostLoad = getGapi();
                    
                    // Double check if client loaded
                    if (!gPostLoad.client) {
                        console.warn("gapi.client undefined after load. Retrying init...");
                        // Edge case fallback
                        setTimeout(() => resolve(), 1000);
                        return;
                    }

                    try {
                        await gPostLoad.client.init({
                            apiKey: API_KEY,
                            clientId: CLIENT_ID,
                            discoveryDocs: DISCOVERY_DOCS,
                            scope: SCOPES,
                        });
                        isClientConfigured = true;
                        resolve();
                    } catch (err: any) {
                        console.error("Erro GAPI Init:", err);
                        if (err.error === 'idpiframe_initialization_failed') {
                            console.error("Verifique 'Authorized Origins' no Google Cloud Console.");
                        }
                        resolve();
                    }
                });
            };

            // Initial delay to ensure script injection
            setTimeout(startGapiLoad, 100);
        });
    },

    signIn: async () => {
        if (!isClientConfigured) {
            const msg = "CONFIGURAÇÃO EM FALTA:\n\nO 'Client ID' do Google não foi detetado ou a inicialização falhou.\nVerifique a consola para mais detalhes.";
            alert(msg);
            throw new Error("Client ID not configured");
        }

        const g = getGapi();
        const auth = g.auth2.getAuthInstance();
        if (!auth) throw new Error("Auth instance not ready (GAPI failed to load)");
        
        // Forçar seleção de conta para evitar logins "fantasmas" automáticos que não devolvem user
        const googleUser = await auth.signIn({
            prompt: 'select_account'
        });
        
        return googleUser.getBasicProfile();
    },

    signOut: async () => {
        const g = getGapi();
        const auth = g.auth2?.getAuthInstance();
        if (auth) await auth.signOut();
    },

    isSignedIn: () => {
        const g = getGapi();
        return isClientConfigured && g.auth2?.getAuthInstance()?.isSignedIn.get();
    },

    getUserProfile: () => {
        if (!driveService.isSignedIn()) return null;
        const g = getGapi();
        return g.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    },

    // --- FILE OPERATIONS ---

    findFolder: async () => {
        if (!isClientConfigured) return null;
        const g = getGapi();
        const response = await g.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
        });
        return response.result.files?.[0] || null;
    },

    createFolder: async () => {
        const g = getGapi();
        const fileMetadata = {
            'name': FOLDER_NAME,
            'mimeType': 'application/vnd.google-apps.folder'
        };
        const response = await g.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        return response.result;
    },

    findFile: async (folderId: string) => {
        const g = getGapi();
        const response = await g.client.drive.files.list({
            q: `name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
        });
        return response.result.files?.[0] || null;
    },

    createFile: async (folderId: string, content: any) => {
        const g = getGapi();
        const fileContent = JSON.stringify(content);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: DB_FILE_NAME,
            mimeType: 'application/json',
            parents: [folderId]
        };

        const accessToken = g.auth.getToken().access_token;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });
        return await res.json();
    },

    updateFile: async (fileId: string, content: any) => {
        const g = getGapi();
        const fileContent = JSON.stringify(content);
        const file = new Blob([fileContent], { type: 'application/json' });
        
        const accessToken = g.auth.getToken().access_token;
        
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: new Headers({ 
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            }),
            body: file
        });
        return res;
    },

    readFile: async (fileId: string) => {
        const g = getGapi();
        const accessToken = g.auth.getToken().access_token;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        return await res.json();
    }
};
