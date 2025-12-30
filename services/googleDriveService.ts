
// Definição global para o novo Google Identity Services e GAPI
declare const google: any;
declare const gapi: any;

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

// Escopos necessários
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"; 

const FOLDER_NAME = "GestOs_Data_v2";
const BACKUP_FOLDER_NAME = "Backups";
const LOCK_FILE_NAME = "gestos.lock"; 

// Variáveis de Estado Interno
let tokenClient: any = null;
let currentAccessToken: string | null = null;
let currentUserProfile: any = null;
let tokenExpirationTime: number = 0;

// Helper para obter gapi de forma segura do window
const getGapi = (): any => {
    return (window as any).gapi || (typeof gapi !== 'undefined' ? gapi : null);
};

export const driveService = {
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
                        await g.client.init({ apiKey: API_KEY });
                        resolve();
                    } catch (err) {
                        console.warn("Aviso GAPI:", err);
                        resolve();
                    }
                });
            };
            setTimeout(startLoad, 100);
        });
    },

    signIn: async (): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined') {
                alert("Erro: Google Identity Services não carregado. Verifique a sua conexão.");
                return reject("GIS not found");
            }

            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: async (resp: any) => {
                    if (resp.error) {
                        console.error("Erro Auth:", resp);
                        reject(resp);
                        return;
                    }
                    currentAccessToken = resp.access_token;
                    tokenExpirationTime = Date.now() + (Number(resp.expires_in) * 1000) - 60000;

                    try {
                        // Fetch profile manually via REST
                        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${resp.access_token}` }
                        }).then(res => res.json());

                        const profile = {
                            getId: () => userInfo.sub,
                            getName: () => userInfo.name,
                            getEmail: () => userInfo.email,
                            getImageUrl: () => userInfo.picture
                        };
                        currentUserProfile = profile;
                        resolve(profile);
                    } catch (error) {
                        reject(error);
                    }
                },
            });

            if (!currentAccessToken || Date.now() > tokenExpirationTime) {
                tokenClient.requestAccessToken({ prompt: '' });
            } else {
                resolve(currentUserProfile);
            }
        });
    },

    signOut: async () => {
        const g = getGapi();
        if (g && g.client) g.client.setToken(null);
        if (currentAccessToken && typeof google !== 'undefined') {
            google.accounts.oauth2.revoke(currentAccessToken, () => {});
        }
        currentAccessToken = null;
        currentUserProfile = null;
    },

    isSignedIn: () => {
        return !!currentAccessToken && Date.now() < tokenExpirationTime;
    },

    getUserProfile: () => currentUserProfile,

    // --- REST API CALLS ---

    findFolder: async (folderName: string = FOLDER_NAME, parentId?: string) => {
        if (!currentAccessToken) return null;
        let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
        if (parentId) {
            q += ` and '${parentId}' in parents`;
        }
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&t=${Date.now()}`;
        
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${currentAccessToken}` }
            });
            const data = await res.json();
            return data.files?.[0] || null;
        } catch (e) {
            console.error("Find Folder Error:", e);
            return null;
        }
    },

    createFolder: async (folderName: string = FOLDER_NAME, parentId?: string) => {
        const metadata: any = {
            'name': folderName,
            'mimeType': 'application/vnd.google-apps.folder'
        };
        if (parentId) {
            metadata['parents'] = [parentId];
        }

        const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
        return await res.json();
    },

    // List all files in a folder (Useful for loading split DB)
    listFilesInFolder: async (folderId: string) => {
        const q = `'${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&t=${Date.now()}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${currentAccessToken}` }
        });
        const data = await res.json();
        return data.files || [];
    },

    findFile: async (folderId: string, filename: string) => {
        // Cache Busting added here too
        const q = `name='${filename}' and '${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&t=${Date.now()}`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${currentAccessToken}` }
        });
        const data = await res.json();
        // Return latest created if duplicates exist (edge case)
        return data.files?.[0] || null;
    },

    createFile: async (folderId: string, content: any, filename: string) => {
        const fileContent = JSON.stringify(content, null, 2);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: filename,
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
        const fileContent = JSON.stringify(content, null, 2); // Pretty print for safety
        const file = new Blob([fileContent], { type: 'application/json' });
        
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

    renameFile: async (fileId: string, newName: string) => {
        const metadata = { name: newName };
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
    },

    copyFile: async (fileId: string, parentId: string, newName: string) => {
        const metadata = {
            name: newName,
            parents: [parentId]
        };
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
    },

    deleteFile: async (fileId: string) => {
        if (!fileId) return;
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentAccessToken}` }
        });
    },

    readFile: async (fileId: string) => {
        // Timestamp query param is sufficient for cache busting
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&t=${Date.now()}`;
        const res = await fetch(url, {
            headers: { 
                'Authorization': 'Bearer ' + currentAccessToken
            }
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error("Drive Read Error:", errText);
            throw new Error(`Failed to read file: ${res.statusText}`);
        }
        return await res.json();
    },

    // --- LOCKING MECHANISM HELPERS ---
    
    getLockFile: async (folderId: string) => {
        return await driveService.findFile(folderId, LOCK_FILE_NAME);
    },

    createLock: async (folderId: string, userDetails: { user: string, action: string }) => {
        const content = {
            ...userDetails,
            timestamp: Date.now()
        };
        return await driveService.createFile(folderId, content, LOCK_FILE_NAME);
    }
};
