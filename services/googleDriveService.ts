
import { gapi } from 'gapi-script';

// Helper para ler variáveis de ambiente de forma segura em diferentes ambientes (Vite/Process)
const getEnvVar = (key: string): string => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        // @ts-ignore
        return import.meta.env[key];
    }
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        // @ts-ignore
        return process.env[key];
    }
    return "";
};

// CONFIGURAÇÃO
// Tenta ler do ambiente, se falhar, verifica se existe alguma hardcoded (segurança para demo)
const CLIENT_ID = getEnvVar('VITE_GOOGLE_CLIENT_ID');
const API_KEY = getEnvVar('API_KEY'); 

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file"; 

const FOLDER_NAME = "GestOs_Data_v2";
const DB_FILE_NAME = "database.json";

export const driveService = {
    initClient: () => {
        return new Promise<void>((resolve, reject) => {
            // Verificação Crítica de Configuração
            if (!CLIENT_ID) {
                const msg = "ERRO FATAL: VITE_GOOGLE_CLIENT_ID não encontrado. Crie um ficheiro .env com VITE_GOOGLE_CLIENT_ID=seu_client_id...";
                console.error(msg);
                reject(new Error(msg));
                return;
            }

            const loadGapi = () => {
                const gapiInstance = gapi || (window as any).gapi;
                
                if (!gapiInstance) {
                    // Se gapi não existir, tenta carregar via script tag manualmente se o pacote falhou
                    console.warn("gapi not found, retrying...");
                    setTimeout(() => reject(new Error("Google API Script not loaded")), 1000);
                    return;
                }

                gapiInstance.load('client:auth2', async () => {
                    const globalGapi = (window as any).gapi;
                    
                    // Verificação dupla de carregamento
                    if (!globalGapi.client) {
                        console.error("gapi.client undefined. Network issue or blocked?");
                        reject(new Error("gapi.client failed to load"));
                        return;
                    }

                    try {
                        await globalGapi.client.init({
                            apiKey: API_KEY,
                            clientId: CLIENT_ID,
                            discoveryDocs: DISCOVERY_DOCS,
                            scope: SCOPES,
                        });
                        resolve();
                    } catch (err: any) {
                        console.error("Erro GAPI Init:", err);
                        // Erros comuns de origem
                        if (err.error === 'idpiframe_initialization_failed') {
                            console.error("Verifique 'Authorized Origins' no Google Cloud Console.");
                        }
                        reject(err);
                    }
                });
            };

            // Pequeno delay para garantir que o script do gapi-script foi injetado
            setTimeout(loadGapi, 100);
        });
    },

    signIn: async () => {
        const auth = gapi.auth2.getAuthInstance();
        if (!auth) throw new Error("Auth instance not ready");
        await auth.signIn();
        return auth.currentUser.get().getBasicProfile();
    },

    signOut: async () => {
        const auth = gapi.auth2.getAuthInstance();
        if (auth) await auth.signOut();
    },

    isSignedIn: () => {
        return gapi.auth2?.getAuthInstance()?.isSignedIn.get();
    },

    getUserProfile: () => {
        if (!driveService.isSignedIn()) return null;
        return gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    },

    // --- FILE OPERATIONS ---

    findFolder: async () => {
        const response = await gapi.client.drive.files.list({
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
        const response = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        } as any);
        return response.result;
    },

    findFile: async (folderId: string) => {
        const response = await gapi.client.drive.files.list({
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
