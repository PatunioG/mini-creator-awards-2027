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
let isAdmin = false;

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
  $("#accountRole").textContent=isAdmin ? "♛ ADMINISTRADOR OFICIAL · MCA 2027" : "CUENTA DE CREADOR";
  $("#adminNavLink").hidden=!isAdmin;
  $("#adminPanel").hidden=true;
  headerAccount.textContent="MI PERFIL ↗";
}

async function checkAdmin(user) {
  isAdmin = false;
  const adminLink = $("#adminNavLink");
  const adminPanel = $("#adminPanel");
  if (adminLink) adminLink.hidden = true;
  if (adminPanel) adminPanel.hidden = true;

  if (!supabaseClient || !user) return false;

  // The row is visible only to its owner through the admin_users RLS policy.
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1);

  if (error) {
    console.error("Error verificando administrador:", error);
    const roleLabel = $("#accountRole");
    if (roleLabel) roleLabel.textContent = "No se pudo verificar el rol. Revisa la consola.";
    return false;
  }

  isAdmin = Array.isArray(data) && data.length > 0;
  if (adminLink) adminLink.hidden = !isAdmin;
  if (!isAdmin && adminPanel) adminPanel.hidden = true;
  return isAdmin;
}

$("#adminNavLink").addEventListener("click", e => {
  e.preventDefault();
  if (!isAdmin) {
    $("#adminPanel").hidden = true;
    return;
  }
  $("#adminPanel").hidden = false;
  $("#adminWelcome").textContent = `Acceso autorizado para ${currentUser?.email || "administrador"}.`;
  $("#adminPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  openAdminTab("dashboard");
});
async function loadProfile(user) {
  const {data,error}=await supabaseClient.from("profiles").select("username,display_name").eq("id",user.id).maybeSingle();
  if(error) console.warn("No se pudo leer el perfil:",error.message);
  await checkAdmin(user);
  showAccount(user,data);
}
function showSignedOut() {
  currentUser=null; isAdmin=false;
  $("#adminNavLink").hidden=true;
  $("#adminPanel").hidden=true;
  headerAccount.innerHTML='MI CUENTA <span>↗</span>';
}

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


// ===== MCA 2027 ADMIN DASHBOARD =====
const adminViews = ["dashboard","categories","nominations","votes","results","users","settings"];
function adminEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function adminMessage(id, message, error=false) {
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=message;
  el.classList.toggle("error",error);
}
async function adminQuery(promise, messageTarget) {
  const {data,error}=await promise;
  if(error) {
    console.error(error);
    if(messageTarget) adminMessage(messageTarget,error.message,true);
    throw error;
  }
  return data;
}
async function openAdminTab(name) {
  if(!isAdmin || !supabaseClient) return;
  document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.adminTab===name));
  adminViews.forEach(v=>document.getElementById(`admin-${v}`)?.classList.toggle("active",v===name));
  try {
    if(name==="dashboard") await loadAdminDashboard();
    if(name==="categories") await loadAdminCategories();
    if(name==="nominations") await loadAdminNominations();
    if(name==="votes") await loadAdminVoteSettings();
    if(name==="results") await loadAdminResults();
    if(name==="users") await loadAdminUsers();
    if(name==="settings") await loadAdminEventSettings();
  } catch(e) { console.warn("No se pudo cargar la sección admin:",e.message); }
}
document.querySelectorAll(".admin-tab").forEach(b=>b.addEventListener("click",()=>openAdminTab(b.dataset.adminTab)));

async function loadAdminDashboard() {
  const tables=["categories","nominations","votes","profiles"];
  const ids=["statCategories","statNominations","statVotes","statUsers"];
  for(let i=0;i<tables.length;i++){
    const {count,error}=await supabaseClient.from(tables[i]).select("*",{count:"exact",head:true});
    if(error) { console.warn(error); document.getElementById(ids[i]).textContent="—"; }
    else document.getElementById(ids[i]).textContent=count ?? 0;
  }
}
async function loadAdminCategories() {
  const rows=await adminQuery(supabaseClient.from("categories").select("*").order("created_at",{ascending:true}));
  document.getElementById("categoriesRows").innerHTML=rows.map(c=>`<tr>
    <td><b>${adminEscape(c.icon)} ${adminEscape(c.name)}</b></td><td>${adminEscape(c.description)}</td>
    <td><span class="admin-status-pill">${c.is_active?"ACTIVA":"INACTIVA"}</span></td>
    <td><button class="admin-mini-btn" data-edit-category="${c.id}">EDITAR</button> <button class="admin-mini-btn danger" data-delete-category="${c.id}">ELIMINAR</button></td></tr>`).join("") || '<tr><td colspan="4">Todavía no hay categorías. Crea la primera.</td></tr>';
  document.querySelectorAll("[data-edit-category]").forEach(b=>b.addEventListener("click",()=>editCategory(rows.find(x=>String(x.id)===b.dataset.editCategory))));
  document.querySelectorAll("[data-delete-category]").forEach(b=>b.addEventListener("click",()=>deleteCategory(b.dataset.deleteCategory)));
}
function editCategory(c=null) {
  document.getElementById("categoryForm").hidden=false;
  document.getElementById("categoryId").value=c?.id || "";
  document.getElementById("categoryName").value=c?.name || "";
  document.getElementById("categoryDescription").value=c?.description || "";
  document.getElementById("categoryIcon").value=c?.icon || "🏆";
  document.getElementById("categoryActive").checked=c?.is_active ?? true;
  adminMessage("categoryMessage","");
}
document.getElementById("newCategoryBtn").addEventListener("click",()=>editCategory());
document.getElementById("cancelCategory").addEventListener("click",()=>document.getElementById("categoryForm").hidden=true);
document.getElementById("categoryForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!isAdmin) return;
  const id=document.getElementById("categoryId").value;
  const payload={name:document.getElementById("categoryName").value.trim(),description:document.getElementById("categoryDescription").value.trim(),icon:document.getElementById("categoryIcon").value.trim()||"🏆",is_active:document.getElementById("categoryActive").checked};
  try {
    const q=id?supabaseClient.from("categories").update(payload).eq("id",id):supabaseClient.from("categories").insert(payload);
    await adminQuery(q,"categoryMessage");
    adminMessage("categoryMessage","Categoría guardada correctamente.");
    document.getElementById("categoryForm").hidden=true; await loadAdminCategories(); await loadAdminDashboard();
  } catch(e){}
});
async function deleteCategory(id) {
  if(!confirm("¿Eliminar esta categoría? Las nominaciones relacionadas también podrían eliminarse.")) return;
  try { await adminQuery(supabaseClient.from("categories").delete().eq("id",id)); await loadAdminCategories(); await loadAdminDashboard(); }
  catch(e){alert("No se pudo eliminar: "+e.message);}
}
async function loadAdminNominations() {
  const [noms,cats]=await Promise.all([
    adminQuery(supabaseClient.from("nominations").select("*").order("created_at",{ascending:false})),
    adminQuery(supabaseClient.from("categories").select("id,name"))
  ]);
  const catMap=Object.fromEntries(cats.map(c=>[c.id,c.name]));
  document.getElementById("nominationsRows").innerHTML=noms.map(n=>`<tr>
    <td><b>${adminEscape(n.creator_name)}</b><br><small>${adminEscape(n.creator_url)}</small></td>
    <td>${adminEscape(catMap[n.category_id]||"Categoría eliminada")}</td><td>${adminEscape(n.submitted_by)}</td>
    <td><span class="admin-status-pill">${adminEscape(n.status.toUpperCase())}</span></td>
    <td><button class="admin-mini-btn" data-nom-status="${n.id}" data-status="approved">APROBAR</button> <button class="admin-mini-btn danger" data-nom-status="${n.id}" data-status="rejected">RECHAZAR</button></td></tr>`).join("") || '<tr><td colspan="5">No hay nominaciones todavía.</td></tr>';
  document.querySelectorAll("[data-nom-status]").forEach(b=>b.addEventListener("click",()=>updateNomination(b.dataset.nomStatus,b.dataset.status)));
}
async function updateNomination(id,status) {
  try { await adminQuery(supabaseClient.from("nominations").update({status}).eq("id",id)); await loadAdminNominations(); }
  catch(e){alert("No se pudo actualizar: "+e.message);}
}
document.getElementById("refreshNominations").addEventListener("click",loadAdminNominations);
async function loadAdminVoteSettings() {
  const row=await adminQuery(supabaseClient.from("event_settings").select("*").eq("id",1).single());
  document.getElementById("votingOpen").value=String(row.voting_open);
  document.getElementById("votingStart").value=row.voting_start?new Date(row.voting_start).toISOString().slice(0,16):"";
  document.getElementById("votingEnd").value=row.voting_end?new Date(row.voting_end).toISOString().slice(0,16):"";
  const open=row.voting_open;
  const state=document.getElementById("voteState"); state.textContent=open?"VOTACIONES ABIERTAS":"VOTACIONES CERRADAS"; state.classList.toggle("is-open",open);
}
document.getElementById("voteSettingsForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const toIso=v=>v?new Date(v).toISOString():null;
  const payload={voting_open:document.getElementById("votingOpen").value==="true",voting_start:toIso(document.getElementById("votingStart").value),voting_end:toIso(document.getElementById("votingEnd").value),updated_at:new Date().toISOString()};
  try { await adminQuery(supabaseClient.from("event_settings").update(payload).eq("id",1),"voteMessage"); adminMessage("voteMessage","Configuración de votaciones guardada."); await loadAdminVoteSettings(); }
  catch(e){}
});
async function loadAdminResults() {
  const [votes,noms,cats]=await Promise.all([
    adminQuery(supabaseClient.from("votes").select("nomination_id,category_id")),
    adminQuery(supabaseClient.from("nominations").select("id,creator_name,category_id").eq("status","approved")),
    adminQuery(supabaseClient.from("categories").select("id,name"))
  ]);
  const nmap=Object.fromEntries(noms.map(n=>[n.id,n]));
  const cmap=Object.fromEntries(cats.map(c=>[c.id,c.name]));
  const counts={}; votes.forEach(v=>{counts[v.nomination_id]=(counts[v.nomination_id]||0)+1;});
  const sorted=noms.map(n=>({n,count:counts[n.id]||0})).sort((a,b)=>b.count-a.count);
  document.getElementById("resultsRows").innerHTML=sorted.map(x=>`<tr><td>${adminEscape(cmap[x.n.category_id]||"")}</td><td>${adminEscape(x.n.creator_name)}</td><td><b>${x.count}</b></td></tr>`).join("") || '<tr><td colspan="3">Todavía no hay nominados aprobados.</td></tr>';
}
document.getElementById("refreshResults").addEventListener("click",loadAdminResults);
async function loadAdminUsers() {
  const rows=await adminQuery(supabaseClient.from("profiles").select("username,display_name,created_at").order("created_at",{ascending:false}));
  document.getElementById("usersRows").innerHTML=rows.map(u=>`<tr><td>${adminEscape(u.username)}</td><td>${adminEscape(u.display_name)}</td><td>${u.created_at?new Date(u.created_at).toLocaleDateString("es-MX"):"—"}</td></tr>`).join("") || '<tr><td colspan="3">No hay perfiles registrados.</td></tr>';
}
document.getElementById("refreshUsers").addEventListener("click",loadAdminUsers);
async function loadAdminEventSettings() {
  const row=await adminQuery(supabaseClient.from("event_settings").select("*").eq("id",1).single());
  document.getElementById("eventTitle").value=row.event_title;
  document.getElementById("eventDescription").value=row.event_description;
  document.getElementById("eventStatus").value=row.event_status;
}
document.getElementById("eventSettingsForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={event_title:document.getElementById("eventTitle").value.trim(),event_description:document.getElementById("eventDescription").value.trim(),event_status:document.getElementById("eventStatus").value,updated_at:new Date().toISOString()};
  try { await adminQuery(supabaseClient.from("event_settings").update(payload).eq("id",1),"eventMessage"); adminMessage("eventMessage","Datos del evento guardados correctamente."); }
  catch(e){}
});

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
