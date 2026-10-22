export type User = {id:string;email:string;full_name:string;is_active:boolean;roles:string[];permissions:string[]};
type AuthResponse={access_token:string;token_type:string;user:User};
const base=(import.meta.env.VITE_API_BASE_URL||'http://localhost:8000').replace(/\/$/,'');
let token:string|null=null;
let user:User|null=null;
export const session={get user(){return user},get token(){return token},set(v:AuthResponse|null){token=v?.access_token||null;user=v?.user||null;window.dispatchEvent(new Event('sismo-auth-change'))}};
async function checked<T>(url:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${base}${url}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.headers||{})}});if(!response.ok){let message='No se pudo completar la solicitud';try{const json=await response.json();if(typeof json.detail==='string')message=json.detail}catch{}throw new Error(message)}return response.json() as Promise<T>}
export async function login(email:string,password:string){const v=await checked<AuthResponse>('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email,password})});session.set(v);return v}
export async function refresh(){try{const v=await checked<AuthResponse>('/api/v1/auth/refresh',{method:'POST'});session.set(v);return v}catch{session.set(null);return null}}
export async function logout(){try{await checked<{ok:boolean}>('/api/v1/auth/logout',{method:'POST'})}finally{session.set(null)}}
export async function authorized<T>(path:string,init:RequestInit={}):Promise<T>{if(!session.token)throw new Error('No autenticado');return checked<T>(path,{...init,headers:{Authorization:`Bearer ${session.token}`,...init.headers}})}
