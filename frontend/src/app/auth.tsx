import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Navigate,useLocation} from 'react-router-dom';
import {refresh,session,type User} from '../services/auth';
type AuthContextValue={user:User|null;loading:boolean};
const AuthContext=createContext<AuthContextValue>({user:null,loading:true});
export function AuthProvider({children}:{children:ReactNode}){const [user,setUser]=useState<User|null>(session.user);const [loading,setLoading]=useState(true);useEffect(()=>{const listener=()=>setUser(session.user);window.addEventListener('sismo-auth-change',listener);void refresh().finally(()=>setLoading(false));return()=>window.removeEventListener('sismo-auth-change',listener)},[]);return <AuthContext.Provider value={{user,loading}}>{children}</AuthContext.Provider>}
export function useAuth(){return useContext(AuthContext)}
export function Protected({children}:{children:ReactNode}){const {user,loading}=useAuth();const location=useLocation();if(loading)return <main style={{padding:32}}>Verificando sesión…</main>;return user?<>{children}</>:<Navigate to="/login" state={{from:location.pathname}} replace/>}
