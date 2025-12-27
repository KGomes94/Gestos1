
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

            const loadGapi = () => {
                const gapiInstance = gapi || (window as any).gapi;
                
                if (!gapiInstance) {
                    console.warn("gapi not found, retrying...");
                    setTimeout(() => resolve(), 1000); 
                    return;
                }

                gapiInstance.load('client:auth2', async () => {
                    const globalGapi = (window as any).gapi;
                    
                    if (!globalGapi.client) {
                        console.error("gapi.client undefined.");
                        resolve(); 
                        return;
                    }

                    try {
                        await globalGapi.client.init({
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

            setTimeout(loadGapi, 100);
        });
    },

    signIn: async () => {
        if (!isClientConfigured) {
            const msg = "CONFIGURAÇÃO EM FALTA:\n\nO 'Client ID' do Google não foi detetado ou a inicialização falhou.\nVerifique a consola para mais detalhes.";
            alert(msg);
            throw new Error("Client ID not configured");
        }

        const auth = gapi.auth2.getAuthInstance();
        if (!auth) throw new Error("Auth instance not ready (GAPI failed to load)");
        
        await auth.signIn();
        return auth.currentUser.get().getBasicProfile();
    },

    signOut: async () => {
        const auth = gapi.auth2?.getAuthInstance();
        if (auth) await auth.signOut();
    },

    isSignedIn: () => {
        return isClientConfigured && gapi.auth2?.getAuthInstance()?.isSignedIn.get();
    },

    getUserProfile: () => {
        if (!driveService.isSignedIn()) return null;
        return gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    },

    // --- FILE OPERATIONS ---

    findFolder: async () => {
        if (!isClientConfigured) return null;
        // Cast to any to avoid TS error: Property 'drive' does not exist on type 'typeof client'
        const response = await (gapi.client as any).drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
        });
        return response.result.files?.[0] || null;
    },

    createFolder: async () => {
        const fileMetadata = {
            'name': FOLDER_NAME,
            'mimeType': 'application/vnd.google-apps.folder'
        };
        const response = await (gapi.client as any).drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        } as any);
        return response.result;
    },

    findFile: async (folderId: string) => {
        const response = await (gapi.client as any).drive.files.list({
            q: `name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
        });
        return response.result.files?.[0] || null;
    },

    createFile: async (folderId: string, content: any) => {
        const fileContent = JSON.stringify(content);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: DB_FILE_NAME,
            mimeType: 'application/json',
            parents: [folderId]
        };

        const accessToken = gapi.auth.getToken().access_token;
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
        const fileContent = JSON.stringify(content);
        const file = new Blob([fileContent], { type: 'application/json' });
        
        const accessToken = gapi.auth.getToken().access_token;
        
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
        const accessToken = gapi.auth.getToken().access_token;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        return await res.json();
    }
};
