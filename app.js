const $ = (s, root=document) => root.querySelector(s);
const nav = $("#mainNav");
$("#menuToggle").addEventListener("click", () => nav.classList.toggle("open"));
nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

const modal = $("#modalBackdrop");
const title = $("#modalTitle");
const headerAccount = $("#headerAccount");
let supabaseClient = null;
let authMode = "login";
let currentUser = null;

function openAccount() {
  modal.hidden = false;
  if (currentUser) showAccount(currentUser);
  else showAuth();
}
document.querySelectorAll("[data-modal]").forEach(btn => btn.addEventListener("click", () => {
  const key = btn.dataset.modal;
  if (key === "login") return openAccount();
  const messages = {
    nominacion: ["NOMINACIONES 2027", "Estamos preparando las reglas, categorías y el formulario oficial de nominaciones. ¡Muy pronto podrás participar!"],
    archivo: ["ARCHIVO 2026", "Aquí reuniremos los momentos, nominados y ganadores de la primera edición. El archivo se publicará en una siguiente actualización."]
  };
  const data = messages[key] || messages.nominacion;
  title.textContent = data[0];
  $("#authArea").hidden = true;
  $("#accountArea").hidden = true;
  $("#modalInfo").hidden = false;
  $("#modalInfo").textContent = data[1];
  $("#modalOkay").hidden = false;
  $("#modalOkay").textContent = "ENTENDIDO";
  modal.hidden = false;
}));
function closeModal(){ modal.hidden = true; }
$("#modalClose").addEventListener("click", closeModal);
$("#modalOkay").addEventListener("click", closeModal);
modal.addEventListener("click", e => { if(e.target === modal) closeModal(); });
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });

function setMessage(message, isError=false, target="#authMessage") {
  const el=$(target); el.textContent=message; el.classList.toggle("error",isError);
}
function showAuth() {
  title.textContent = "MI CUENTA";
  $("#modalInfo").hidden = true;
  $("#authArea").hidden = false; $("#accountArea").hidden = true;
  $("#modalOkay").hidden = true;
  setAuthMode("login");
}
function setAuthMode(mode) {
  authMode=mode;
  $("#showLogin").classList.toggle("active",mode==="login");
  $("#showSignup").classList.toggle("active",mode==="signup");
  $("#signupFields").hidden=mode!=="signup";
  $("#authUsername").required=mode==="signup";
  $("#authDisplayName").required=mode==="signup";
  $("#authPassword").autocomplete=mode==="signup"?"new-password":"current-password";
  $("#authSubmit").textContent=mode==="signup"?"CREAR CUENTA ↗":"INICIAR SESIÓN ↗";
  setMessage("");
}
$("#showLogin").addEventListener("click",()=>setAuthMode("login"));
$("#showSignup").addEventListener("click",()=>setAuthMode("signup"));

function showAccount(user, profile=null) {
  currentUser=user;
  title.textContent="MI PERFIL";
  $("#modalInfo").hidden=true;
  $("#authArea").hidden=true; $("#accountArea").hidden=false; $("#modalOkay").hidden=false;
  $("#modalOkay").textContent="CERRAR";
  $("#accountWelcome").textContent=`Sesión iniciada: ${user.email || "cuenta de creador"}`;
  $("#profileUsername").value=profile?.username || user.user_metadata?.username || "";
  $("#profileDisplayName").value=profile?.display_name || user.user_metadata?.display_name || "";
  $("#accountRole").textContent="CUENTA DE CREADOR · LOS PERMISOS DE ADMINISTRADOR SE CONFIGURAN DE FORMA SEGURA EN SUPABASE.";
  headerAccount.textContent="MI PERFIL ↗";
}
async function loadProfile(user) {
  const {data,error}=await supabaseClient.from("profiles").select("username,display_name").eq("id",user.id).maybeSingle();
  if(error) console.warn("No se pudo leer el perfil:",error.message);
  showAccount(user,data);
}
function showSignedOut() { currentUser=null; headerAccount.innerHTML='MI CUENTA <span>↗</span>'; }

if (window.MCA_SUPABASE_URL && window.MCA_SUPABASE_ANON_KEY && window.supabase?.createClient) {
  supabaseClient=window.supabase.createClient(window.MCA_SUPABASE_URL,window.MCA_SUPABASE_ANON_KEY);
  supabaseClient.auth.getSession().then(({data})=>{
    if(data.session) loadProfile(data.session.user); else showSignedOut();
  });
  supabaseClient.auth.onAuthStateChange((_event,session)=>{
    if(session?.user) loadProfile(session.user); else showSignedOut();
  });
} else {
  $("#authSubmit").disabled=true;
  setMessage("Falta configurar Supabase. Revisa supabase-config.js.",true);
}

$("#authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!supabaseClient) return;
  const email=$("#authEmail").value.trim();
  const password=$("#authPassword").value;
  const submit=$("#authSubmit");
  submit.disabled=true; setMessage("Conectando...");
  try {
    if(authMode==="signup") {
      const username=$("#authUsername").value.trim();
      const displayName=$("#authDisplayName").value.trim();
      const {data,error}=await supabaseClient.auth.signUp({
        email,password,
        options:{data:{username,display_name:displayName}}
      });
      if(error) throw error;
      if(data.session) {
        setMessage("¡Cuenta creada! Ya puedes completar tu perfil.");
        await loadProfile(data.user);
      } else {
        setMessage("¡Registro enviado! Revisa tu correo para confirmar la cuenta y después inicia sesión.");
        setAuthMode("login");
      }
    } else {
      const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
      if(error) throw error;
      await loadProfile(data.user);
      setMessage("¡Bienvenido de vuelta!",false,"#profileMessage");
    }
  } catch(err) {
    setMessage(err.message || "No se pudo completar la operación.",true);
  } finally { submit.disabled=false; }
});
$("#saveProfile").addEventListener("click",async()=>{
  if(!currentUser || !supabaseClient) return;
  const username=$("#profileUsername").value.trim();
  const displayName=$("#profileDisplayName").value.trim();
  if(!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setMessage("El username debe tener 3 a 20 caracteres: letras, números o guion bajo.",true,"#profileMessage");
  if(!displayName) return setMessage("Escribe un nombre para mostrar.",true,"#profileMessage");
  const {error}=await supabaseClient.from("profiles").upsert({id:currentUser.id,username,display_name:displayName},{onConflict:"id"});
  if(error) setMessage(error.message,true,"#profileMessage");
  else setMessage("¡Perfil guardado correctamente!",false,"#profileMessage");
});
$("#signOut").addEventListener("click",async()=>{
  if(!supabaseClient) return;
  const {error}=await supabaseClient.auth.signOut();
  if(error) setMessage(error.message,true,"#profileMessage");
  else { showSignedOut(); showAuth(); setMessage("Sesión cerrada."); }
});
