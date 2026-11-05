// Script inline del <head> (layout raíz). Android lanza beforeinstallprompt
// una sola vez al cargar, a menudo en el login y antes de que React monte:
// se guarda en window.__neaBIP para que Inicio o Perfil lo usen después.
// Sin hooks a propósito: lo importa un componente de servidor.

export const INSTALLED_KEY = "nea:installed";
export const BIP_EVENT = "nea:bip";

export const INSTALL_SCRIPT = `(function(){try{window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__neaBIP=e;window.dispatchEvent(new Event(${JSON.stringify(BIP_EVENT)}))});window.addEventListener("appinstalled",function(){window.__neaBIP=null;try{localStorage.setItem(${JSON.stringify(INSTALLED_KEY)},"1")}catch(e){}window.dispatchEvent(new Event(${JSON.stringify(BIP_EVENT)}))})}catch(e){}})()`;
