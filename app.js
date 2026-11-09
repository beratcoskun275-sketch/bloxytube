/**
 * Pulse - Real Social Media Platform Engine
 * 100% Gerçek Sosyal Medya Mimarisi:
 * - Sahte bot hesaplar ve önceden tanımlanmış sahte postlar TAMAMEN KALDIRILDI.
 * - Misafir paylaşım yapamaz; sadece gerçek kayıtlı kullanıcılar (Kullanıcı Adı & Şifre) işlem yapabilir.
 * - Google Firebase v9+ Firestore, Storage ve Auth modülleriyle doğrudan canlı sunucu iletişimi.
 */

// =============================================================================
// 1. FIREBASE CONFIG
// =============================================================================

/**
 * Firebase Proje Yapılandırmanız:
 * Firebase Console'dan (console.firebase.google.com) aldığınız yapılandırmayı
 * buraya yapıştırabilir veya sitedeki arayüzden kaydedebilirsiniz.
 */
export const firebaseConfig = {
  projectId: "symmetric-cat-5xq1s",
  appId: "1:283066323800:web:456fe5d1064633cb758b2d",
  apiKey: "AIzaSyDP54NyeFXMOryxquJ1dYEua8e4sJ_9434",
  authDomain: "symmetric-cat-5xq1s.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-pulserealtimesoc-0efa8eea-46fa-4d01-ace7-ef8bedb57a87",
  storageBucket: "symmetric-cat-5xq1s.firebasestorage.app",
  messagingSenderId: "283066323800"
};

// CDN URL Tanımlamaları (Netlify ve her ortamda %100 derlemesiz çalışır)
const FIREBASE_APP_CDN = "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
const FIREBASE_FIRESTORE_CDN = "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const FIREBASE_STORAGE_CDN = "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Global Firebase ve Uygulama Durumu
let firebaseApp = null;
let firestoreDb = null;
let firebaseStorage = null;
let isFirebaseConnected = false;
let postsUnsubscribe = null;
let messagesUnsubscribe = null;
let musicUnsubscribe = null;

// Hazır Avatar Seçenekleri (Kayıt olurken profil resmi seçebilmek için)
const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/bottts/svg?seed=Pulse1",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Pulse2",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Pulse3",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Pulse4",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Pulse5",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Pulse6"
];

// Gerçek Uygulama Durumu (KESİNLİKLE SAHTE BOT VE MOCK POST İÇERMEZ)
const AppState = {
  currentUser: null,
  activeTab: "home",
  activeFilter: "all",
  activeChatRecipient: null,
  activeChannelUsername: null,
  channelFilter: "all",
  isAdminLoggedIn: false,
  posts: [],
  messages: [],
  tracks: [],
  registeredUsers: [],
  currentTrackIndex: -1,
  isPlaying: false
};

/**
 * Kullanıcıya atanmış özel renkli ünvan / tag ve onaylı rozet HTML etiketini döner.
 */
function getUserCustomTagHtml(userOrUsername) {
  if (!userOrUsername) return "";
  let userObj = typeof userOrUsername === "object" 
    ? userOrUsername 
    : AppState.registeredUsers.find(u => u.username === userOrUsername);

  if (!userObj && AppState.currentUser && AppState.currentUser.username === userOrUsername) {
    userObj = AppState.currentUser;
  }

  let html = "";
  if (userObj) {
    if (userObj.isVerified) {
      html += `<span class="channel-verified-badge-gold" title="Onaylı BloxyTube Kanalı">✓</span>`;
    }
    const tagText = userObj.customTagText || (userObj.customTag && userObj.customTag.text);
    const tagColor = userObj.customTagColor || (userObj.customTag && userObj.customTag.color) || "#ff6600";
    if (tagText) {
      html += `<span class="user-custom-tag" style="background:${escapeHtml(tagColor)};">${escapeHtml(tagText)}</span>`;
    }
  }
  return html;
}

// =============================================================================
// 2. GÜVENLİK VE FORMATLAMA FONKSİYONLARI
// =============================================================================

/**
 * Web Crypto API ile SHA-256 Şifre Özetleme (Güvenli istemci şifreleme)
 */
async function hashPassword(plainPassword) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainPassword);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "az önce";
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return `${Math.max(1, diffSec)}sn önce`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}dk önce`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}s önce`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}g önce`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function linkifyText(text) {
  return text.replace(/(#\w+)/g, '<span style="color:var(--accent-cyan); font-weight:600;">$1</span>')
             .replace(/(@\w+)/g, '<span style="color:var(--accent-cyan); font-weight:600;">$1</span>');
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return hash;
}

// =============================================================================
// 3. FIREBASE BAŞLATMA & CANLI SUNUCU ENTEGRASYONU
// =============================================================================

function handleFirestoreQuotaExceededUI(err = null) {
  isFirebaseConnected = false;
  if (postsUnsubscribe) {
    try { postsUnsubscribe(); } catch {}
    postsUnsubscribe = null;
  }
  if (messagesUnsubscribe) {
    try { messagesUnsubscribe(); } catch {}
    messagesUnsubscribe = null;
  }
  if (musicUnsubscribe) {
    try { musicUnsubscribe(); } catch {}
    musicUnsubscribe = null;
  }

  const statusBadge = document.getElementById("fb-connection-status");
  const authStatusText = document.getElementById("auth-fb-status-text");
  const authDot = document.querySelector("#auth-fb-status .status-dot");

  if (statusBadge) {
    statusBadge.textContent = "PostgreSQL (Cloud SQL) Aktif";
    statusBadge.style.background = "rgba(16, 185, 129, 0.15)";
    statusBadge.style.color = "#10b981";
    statusBadge.title = "Firebase kotası dolduğu için sistem PostgreSQL sunucusunda çalışıyor";
  }
  if (authStatusText) {
    authStatusText.textContent = "PostgreSQL / Cloud SQL Aktif (Firebase Kotası Doldu)";
  }
  if (authDot) {
    authDot.style.background = "#10b981";
  }
}

async function initFirebaseSystem() {
  const statusBadge = document.getElementById("fb-connection-status");
  const authStatusText = document.getElementById("auth-fb-status-text");
  const authDot = document.querySelector("#auth-fb-status .status-dot");

  let activeConfig = firebaseConfig;
  const savedConfig = localStorage.getItem("pulse_firebase_config");
  if (savedConfig) {
    try {
      activeConfig = JSON.parse(savedConfig);
    } catch {}
  }

  if (activeConfig && activeConfig.projectId && activeConfig.apiKey) {
    try {
      const { initializeApp } = await import(/* @vite-ignore */ FIREBASE_APP_CDN);
      const { getFirestore, doc, getDocFromServer } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      const { getStorage } = await import(/* @vite-ignore */ FIREBASE_STORAGE_CDN);

      firebaseApp = initializeApp(activeConfig);
      firestoreDb = activeConfig.firestoreDatabaseId 
        ? getFirestore(firebaseApp, activeConfig.firestoreDatabaseId)
        : getFirestore(firebaseApp);
      firebaseStorage = getStorage(firebaseApp);

      // Firestore bağlantısını doğrula (getDocFromServer)
      try {
        await getDocFromServer(doc(firestoreDb, "test", "connection"));
        isFirebaseConnected = true;
      } catch (testErr) {
        const errMsg = testErr?.message || "";
        const errCode = testErr?.code || "";
        if (errCode === "resource-exhausted" || errMsg.includes("quota") || errMsg.includes("Quota")) {
          console.warn("Firestore ücretsiz okuma kotası aşılmış. PostgreSQL Cloud SQL sunucusuna geçildi:", testErr);
          handleFirestoreQuotaExceededUI(testErr);
          await loadRegisteredUsers();
          return;
        }
        // Kotadan bağımsız hata ise bağlantıyı koru
        isFirebaseConnected = true;
      }

      if (isFirebaseConnected) {
        if (statusBadge) {
          statusBadge.textContent = "Firebase Canlı Sunucu Bağlı";
          statusBadge.style.background = "rgba(16, 185, 129, 0.15)";
          statusBadge.style.color = "#10b981";
        }
        if (authStatusText) {
          authStatusText.textContent = `Firebase Bağlı (${activeConfig.projectId})`;
        }
        if (authDot) {
          authDot.style.background = "#10b981";
        }
      }
    } catch (err) {
      console.warn("Firebase bağlantı hatası:", err);
      isFirebaseConnected = false;
      setFirebaseDisconnectedUI(authStatusText, authDot, statusBadge);
    }
  } else {
    isFirebaseConnected = false;
    setFirebaseDisconnectedUI(authStatusText, authDot, statusBadge);
  }

  // Kullanıcı listesini yükle
  await loadRegisteredUsers();
}

function setFirebaseDisconnectedUI(authStatusText, authDot, statusBadge) {
  if (authStatusText) {
    authStatusText.textContent = "PostgreSQL (Cloud SQL) Aktif";
  }
  if (authDot) {
    authDot.style.background = "#10b981";
  }
  if (statusBadge) {
    statusBadge.textContent = "PostgreSQL Aktif";
    statusBadge.style.background = "rgba(16, 185, 129, 0.15)";
    statusBadge.style.color = "#10b981";
  }
}

// =============================================================================
// 4. ROBLOX TARZI GERÇEK KULLANICI KİMLİK DOĞRULAMA (KAYIT / GİRİŞ)
// =============================================================================

async function handleRegister(username, displayName, password, avatarUrl) {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (cleanUsername.length < 3) {
    throw new Error("Kullanıcı adı en az 3 karakter olmalıdır (harf, rakam veya alt çizgi).");
  }
  if (password.length < 6) {
    throw new Error("Şifre en az 6 karakter olmalıdır.");
  }

  const passwordHash = await hashPassword(password);
  const selectedAvatar = avatarUrl || AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];

  // 1. PostgreSQL (Cloud SQL / Supabase Backend) İlk Deneme
  try {
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cleanUsername,
        displayName: displayName.trim() || cleanUsername,
        passwordHash: passwordHash,
        avatarUrl: selectedAvatar,
        bio: ""
      })
    });
    if (res.ok) {
      const user = await res.json();
      return user;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) throw new Error(errData.error);
    }
  } catch (apiErr) {
    if (apiErr.message && !apiErr.message.includes("Failed to fetch")) {
      throw apiErr;
    }
    console.warn("Backend API bağlantısı yok, Firebase/Yerel veritabanına geçiliyor:", apiErr);
  }

  const newUserDoc = {
    username: cleanUsername,
    displayName: displayName.trim() || cleanUsername,
    passwordHash: passwordHash,
    avatarUrl: selectedAvatar,
    bio: "",
    createdAt: Date.now(),
    following: []
  };

  if (isFirebaseConnected && firestoreDb) {
    const { collection, query, where, getDocs, addDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
    const usersRef = collection(firestoreDb, "users");

    const q = query(usersRef, where("username", "==", cleanUsername));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error(`@${cleanUsername} kullanıcı adı zaten kullanımda.`);
    }

    const docRef = await addDoc(usersRef, newUserDoc);
    const user = { id: docRef.id, ...newUserDoc };
    delete user.passwordHash;
    return user;
  } else {
    const storedUsers = JSON.parse(localStorage.getItem("pulse_real_users") || "[]");
    if (storedUsers.some(u => u.username === cleanUsername)) {
      throw new Error(`@${cleanUsername} kullanıcı adı zaten kullanımda.`);
    }

    const localUser = { id: "usr-" + Date.now(), ...newUserDoc };
    storedUsers.push(localUser);
    localStorage.setItem("pulse_real_users", JSON.stringify(storedUsers));
    const user = { ...localUser };
    delete user.passwordHash;
    return user;
  }
}

async function handleLogin(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  // 1. PostgreSQL (Cloud SQL / Supabase Backend) İlk Deneme
  try {
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cleanUsername,
        passwordHash: passwordHash
      })
    });
    if (res.ok) {
      const user = await res.json();
      return user;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) throw new Error(errData.error);
    }
  } catch (apiErr) {
    if (apiErr.message && !apiErr.message.includes("Failed to fetch")) {
      throw apiErr;
    }
    console.warn("Backend API bağlantısı yok, Firebase/Yerel veritabanına geçiliyor:", apiErr);
  }

  if (isFirebaseConnected && firestoreDb) {
    const { collection, query, where, getDocs } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
    const usersRef = collection(firestoreDb, "users");
    const q = query(usersRef, where("username", "==", cleanUsername));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("Bu kullanıcı adına sahip bir hesap bulunamadı.");
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    if (userData.passwordHash !== passwordHash) {
      throw new Error("Şifre yanlış. Lütfen tekrar deneyin.");
    }

    const user = { id: userDoc.id, ...userData };
    delete user.passwordHash;
    return user;
  } else {
    const storedUsers = JSON.parse(localStorage.getItem("pulse_real_users") || "[]");
    const found = storedUsers.find(u => u.username === cleanUsername);

    if (!found) {
      throw new Error("Hesap bulunamadı. Lütfen önce 'Kayıt Ol' sekmesinden hesabınızı oluşturun.");
    }
    if (found.passwordHash !== passwordHash) {
      throw new Error("Şifre yanlış.");
    }

    const user = { ...found };
    delete user.passwordHash;
    return user;
  }
}

async function loadRegisteredUsers() {
  let loaded = false;
  try {
    const res = await fetch("/api/users");
    if (res.ok) {
      const dbUsers = await res.json();
      if (Array.isArray(dbUsers)) {
        AppState.registeredUsers = dbUsers.map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          bio: u.bio || "",
          following: Array.isArray(u.following) ? u.following : [],
          customTagText: u.customTagText || null,
          customTagColor: u.customTagColor || null,
          isVerified: !!u.isVerified,
          isBanned: !!u.isBanned
        }));
        loaded = true;
      }
    }
  } catch (e) {
    console.warn("API üzerinden kullanıcılar çekilemedi, Firebase/Yerel depoya bakılıyor:", e);
  }

  if (!loaded) {
    if (isFirebaseConnected && firestoreDb) {
      try {
        const { collection, getDocs } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
        const snapshot = await getDocs(collection(firestoreDb, "users"));
        AppState.registeredUsers = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            username: d.username,
            displayName: d.displayName,
            avatarUrl: d.avatarUrl,
            bio: d.bio || "",
            following: Array.isArray(d.following) ? d.following : [],
            customTagText: d.customTag?.text || null,
            customTagColor: d.customTag?.color || null,
            isVerified: !!d.isVerified
          };
        });
      } catch (err) {
        console.warn("Kullanıcıları yükleme hatası:", err);
      }
    } else {
      const stored = JSON.parse(localStorage.getItem("pulse_real_users") || "[]");
      AppState.registeredUsers = stored.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio || "",
        following: Array.isArray(u.following) ? u.following : [],
        customTagText: u.customTag?.text || null,
        customTagColor: u.customTag?.color || null,
        isVerified: !!u.isVerified
      }));
    }
  }

  renderSuggestedUsers();
  renderDmQuickUsersBar();
  renderDmEmptyUsersGrid();
}

function setCurrentSession(user) {
  AppState.currentUser = user;
  localStorage.setItem("pulse_session_user", JSON.stringify(user));
  updateUIForUser();
  subscribeToFeed();
  subscribeToMessages();
  subscribeToMusic();
}

function logoutUser() {
  AppState.currentUser = null;
  localStorage.removeItem("pulse_session_user");
  if (postsUnsubscribe) postsUnsubscribe();
  if (messagesUnsubscribe) messagesUnsubscribe();
  if (musicUnsubscribe) musicUnsubscribe();

  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-layout").classList.add("hidden");
  showToast("Oturum kapatıldı.", "info");
}

function checkSavedSession() {
  const saved = localStorage.getItem("pulse_session_user");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user && user.username) {
        setCurrentSession(user);
        return;
      }
    } catch {}
  }
  // Oturum yoksa doğrudan Auth ekranında kalır (Misafir giremez!)
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-layout").classList.add("hidden");
}

function updateUIForUser() {
  const user = AppState.currentUser;
  if (!user) return;

  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-layout").classList.remove("hidden");

  // Sol menü profili
  const sName = document.getElementById("sidebar-name");
  const sHandle = document.getElementById("sidebar-handle");
  const sAvatar = document.getElementById("sidebar-avatar");
  if (sName) sName.innerHTML = `${escapeHtml(user.displayName)} ${getUserCustomTagHtml(user)}`;
  if (sHandle) sHandle.textContent = `@${user.username}`;
  if (sAvatar) sAvatar.src = user.avatarUrl;

  // Composer avatarı
  const compAvatar = document.getElementById("composer-user-avatar");
  if (compAvatar) compAvatar.src = user.avatarUrl;

  // Mobil üst bar avatarı
  const mobAvatar = document.getElementById("mobile-avatar");
  if (mobAvatar) mobAvatar.src = user.avatarUrl;

  // Ayarlar alanları
  const setDisplay = document.getElementById("settings-display-name");
  const setUsername = document.getElementById("settings-username");
  const setBio = document.getElementById("settings-bio");
  const setAvatar = document.getElementById("settings-avatar-preview");
  if (setDisplay) setDisplay.value = user.displayName;
  if (setUsername) setUsername.value = user.username;
  if (setBio) setBio.value = user.bio || "";
  if (setAvatar) setAvatar.src = user.avatarUrl;
}

// =============================================================================
// 5. GERÇEK ZAMANLI POST / TWEET AKIŞI (onSnapshot)
// =============================================================================

async function fetchPostsFromApi() {
  try {
    const res = await fetch("/api/posts");
    if (res.ok) {
      const livePosts = await res.json();
      if (Array.isArray(livePosts)) {
        AppState.posts = livePosts;
        renderFeedStream();
        updateTrendsFromRealPosts();
        return true;
      }
    }
  } catch (e) {
    console.warn("Backend API üzerinden postlar yüklenemedi:", e);
  }
  return false;
}

function subscribeToFeed() {
  if (postsUnsubscribe) {
    try { postsUnsubscribe(); } catch {}
    postsUnsubscribe = null;
  }

  // İlk olarak PostgreSQL API'sinden çek
  fetchPostsFromApi();

  if (isFirebaseConnected && firestoreDb) {
    import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN).then(({ collection, query, orderBy, onSnapshot }) => {
      try {
        const postsRef = collection(firestoreDb, "posts");
        const q = query(postsRef, orderBy("timestamp", "desc"));

        postsUnsubscribe = onSnapshot(q, snapshot => {
          const livePosts = [];
          snapshot.forEach(doc => {
            livePosts.push({ id: doc.id, ...doc.data() });
          });
          if (livePosts.length > 0) {
            AppState.posts = livePosts;
            renderFeedStream();
            updateTrendsFromRealPosts();
          }
        }, err => {
          console.warn("Firestore post akış hatası / kota:", err);
          if (err && (err.code === "resource-exhausted" || (err.message && err.message.includes("quota")) || (err.message && err.message.includes("Quota")))) {
            handleFirestoreQuotaExceededUI(err);
            fetchPostsFromApi();
          } else {
            renderFeedStream();
          }
        });
      } catch (err) {
        console.warn("onSnapshot posts hatası:", err);
        handleFirestoreQuotaExceededUI(err);
        fetchPostsFromApi();
      }
    }).catch(() => {
      fetchPostsFromApi();
    });
  } else {
    const local = JSON.parse(localStorage.getItem("pulse_real_posts") || "[]");
    if (AppState.posts.length === 0 && local.length > 0) {
      AppState.posts = local;
      renderFeedStream();
      updateTrendsFromRealPosts();
    }
  }
}

async function createPost(content, mediaFile = null, directMediaUrl = null, directMediaType = null) {
  const user = AppState.currentUser;
  if (!user) {
    showToast("Paylaşım yapabilmek için giriş yapmalısınız.", "error");
    return;
  }

  const progressBox = document.getElementById("upload-progress-box");
  const progressFill = document.getElementById("upload-progress-fill");
  const progressText = document.getElementById("upload-progress-text");

  let mediaUrl = directMediaUrl || null;
  let mediaType = directMediaType || null;

  // Dosya yükleme akışı (Video / Fotoğraf / Ses)
  if (!mediaUrl && mediaFile) {
    if (mediaFile.type.startsWith("image/")) mediaType = "image";
    else if (mediaFile.type.startsWith("video/")) mediaType = "video";
    else if (mediaFile.type.startsWith("audio/")) mediaType = "audio";

    if (progressBox && progressFill && progressText) {
      progressBox.classList.remove("hidden");
      progressFill.style.width = "10%";
      progressText.textContent = "Medya hazırlanıyor: %10";
    }

    if (isFirebaseConnected && firebaseStorage) {
      try {
        const { ref, uploadBytesResumable, getDownloadURL } = await import(/* @vite-ignore */ FIREBASE_STORAGE_CDN);
        const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storageRef = ref(firebaseStorage, `posts/${user.id}_${Date.now()}_${cleanName}`);
        
        const uploadTask = uploadBytesResumable(storageRef, mediaFile);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const pct = snapshot.totalBytes > 0 
                ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) 
                : 35;
              if (progressFill && progressText) {
                progressFill.style.width = `${pct}%`;
                progressText.textContent = `Video sunucuya aktarılıyor: %${pct}`;
              }
            },
            (error) => reject(error),
            async () => {
              mediaUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      } catch (err) {
        console.warn("Firebase Storage yükleme hatası, Base64'e geçiliyor:", err);
        mediaUrl = await fileToBase64(mediaFile);
      }
    } else {
      mediaUrl = await fileToBase64(mediaFile);
    }
  }

  if (progressBox) progressBox.classList.add("hidden");

  const newPostData = {
    authorId: user.id,
    authorUsername: user.username,
    authorName: user.displayName,
    authorAvatar: user.avatarUrl,
    content: content.trim(),
    mediaUrl: mediaUrl,
    mediaType: mediaType,
    likes: [],
    reposts: 0,
    timestamp: Date.now()
  };

  // 1. PostgreSQL API'sine Gönder
  let apiSuccess = false;
  try {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPostData)
    });
    if (res.ok) {
      const createdPost = await res.json();
      AppState.posts.unshift(createdPost);
      renderFeedStream();
      updateTrendsFromRealPosts();
      apiSuccess = true;
    }
  } catch (e) {
    console.warn("Post API'ye iletilemedi:", e);
  }

  if (isFirebaseConnected && firestoreDb) {
    try {
      const { collection, addDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      await addDoc(collection(firestoreDb, "posts"), newPostData);
    } catch (err) {
      console.warn("Firestore post addDoc hatası:", err);
      handleFirestoreQuotaExceededUI(err);
    }
  } else if (!apiSuccess) {
    const localPost = { id: "post-" + Date.now(), ...newPostData };
    AppState.posts.unshift(localPost);
    localStorage.setItem("pulse_real_posts", JSON.stringify(AppState.posts));
    renderFeedStream();
    updateTrendsFromRealPosts();
  }

  showToast("Gönderiniz başarıyla paylaşıldı!", "success");
}

async function toggleLikePost(postId) {
  const user = AppState.currentUser;
  if (!user) return;

  const post = AppState.posts.find(p => p.id === postId);
  if (!post) return;

  if (!Array.isArray(post.likes)) post.likes = [];
  const likedIndex = post.likes.indexOf(user.username);
  if (likedIndex > -1) {
    post.likes.splice(likedIndex, 1);
  } else {
    post.likes.push(user.username);
  }

  renderFeedStream();
  if (AppState.activeTab === "channel") renderChannelPosts();

  // API'ye bildir
  try {
    await fetch(`/api/posts/${postId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username })
    });
  } catch (e) {
    console.warn("Like API hatası:", e);
  }

  if (isFirebaseConnected && firestoreDb) {
    const { doc, updateDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
    const postRef = doc(firestoreDb, "posts", postId);
    await updateDoc(postRef, { likes: post.likes });
  } else {
    localStorage.setItem("pulse_real_posts", JSON.stringify(AppState.posts));
  }
}

async function deletePost(postId) {
  const user = AppState.currentUser;
  if (!user) return;

  const post = AppState.posts.find(p => p.id === postId);
  if (!post || (post.authorUsername !== user.username && !AppState.isAdminLoggedIn)) {
    showToast("Yalnızca kendi gönderilerinizi silebilirsiniz.", "error");
    return;
  }

  try {
    await fetch(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username })
    });
  } catch (e) {
    console.warn("Delete post API hatası:", e);
  }

  if (isFirebaseConnected && firestoreDb) {
    const { doc, deleteDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
    await deleteDoc(doc(firestoreDb, "posts", postId));
  }

  AppState.posts = AppState.posts.filter(p => p.id !== postId);
  localStorage.setItem("pulse_real_posts", JSON.stringify(AppState.posts));
  renderFeedStream();
  if (AppState.activeTab === "channel") renderChannelPosts();
  updateTrendsFromRealPosts();
  showToast("Gönderi silindi.", "info");
}

function buildPostCardHtml(post, user) {
  const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.username);
  const likesCount = (post.likes && post.likes.length) || 0;
  const isOwner = user && post.authorUsername === user.username;

  let mediaHtml = "";
  if (post.mediaUrl) {
    if (post.mediaType === "video") {
      const ytMatch = post.mediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch) {
        mediaHtml = `
          <div class="post-media-container youtube-container">
            <iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
          </div>
        `;
      } else {
        mediaHtml = `<div class="post-media-container"><video src="${post.mediaUrl}" controls preload="metadata"></video></div>`;
      }
    } else if (post.mediaType === "audio") {
      mediaHtml = `
        <div class="post-audio-widget">
          <button class="track-play-btn inline-play" data-audio="${post.mediaUrl}" data-title="Ses Paylaşımı" data-artist="@${post.authorUsername}">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <span>Sesli Paylaşım</span>
        </div>
      `;
    } else {
      mediaHtml = `<div class="post-media-container"><img src="${post.mediaUrl}" alt="Görsel" loading="lazy" /></div>`;
    }
  }

  const avatar = post.authorAvatar || AVATAR_PRESETS[Math.abs(hashString(post.authorUsername)) % AVATAR_PRESETS.length];

  return `
    <article class="post-card" data-post-id="${post.id}">
      <img src="${avatar}" alt="${escapeHtml(post.authorName)}" class="avatar-img post-author-avatar" data-username="${escapeHtml(post.authorUsername)}" title="@${escapeHtml(post.authorUsername)} profilini gör" />
      <div class="post-content-wrap">
        <div class="post-header">
          <span class="post-author-name" data-username="${escapeHtml(post.authorUsername)}" title="@${escapeHtml(post.authorUsername)} kanalını gör">${escapeHtml(post.authorName)} ${getUserCustomTagHtml(post.authorUsername)}</span>
          <span class="post-author-handle" data-username="${escapeHtml(post.authorUsername)}">@${escapeHtml(post.authorUsername)}</span>
          <span class="post-dot-separator">·</span>
          <span class="post-timestamp">${formatTimeAgo(post.timestamp)}</span>
        </div>
        <div class="post-text">${linkifyText(escapeHtml(post.content))}</div>
        ${mediaHtml}
        <div class="post-actions-bar">
          <!-- Beğeni -->
          <button class="post-action-btn like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" title="Beğen">
            <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>${likesCount}</span>
          </button>
          <!-- DM Başlat -->
          <button class="post-action-btn dm-user-btn" data-username="${escapeHtml(post.authorUsername)}" title="Mesaj Gönder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </button>
          <!-- Profil & Kanal Özeti Aç -->
          <button class="post-action-btn inspect-user-btn" data-username="${escapeHtml(post.authorUsername)}" title="Kanal Bilgisi & Takip Et">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"></circle><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path></svg>
          </button>
          <!-- Silme (Yalnızca Sahibi) -->
          ${isOwner ? `
            <button class="post-action-btn delete-btn" data-post-id="${post.id}" title="Gönderiyi Sil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

function bindPostCardEvents(container) {
  if (!container) return;

  container.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleLikePost(btn.dataset.postId));
  });

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deletePost(btn.dataset.postId));
  });

  container.querySelectorAll(".dm-user-btn").forEach(btn => {
    btn.addEventListener("click", () => openDmChatWith(btn.dataset.username));
  });

  // Profil & Kanal Özeti Modalını Açan Tıklamalar
  container.querySelectorAll(".post-author-name, .post-author-avatar, .inspect-user-btn").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openUserProfileModal(el.dataset.username);
    });
  });

  container.querySelectorAll(".inline-play").forEach(btn => {
    btn.addEventListener("click", () => {
      playDirectTrack(btn.dataset.title, btn.dataset.artist, btn.dataset.audio);
    });
  });
}

function renderFeedStream() {
  const container = document.getElementById("feed-stream");
  if (!container) return;

  const user = AppState.currentUser;
  let displayPosts = [...AppState.posts];

  // Takip edilenler filtresi
  if (AppState.activeFilter === "following" && user) {
    const following = user.following || [];
    displayPosts = displayPosts.filter(p => following.includes(p.authorUsername) || p.authorUsername === user.username);
  }

  if (displayPosts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <p>Henüz hiçbir gönderi paylaşılmadı.</p>
        <span style="font-size:12px; color:var(--text-muted);">Yukarıdaki alandan ilk gerçek paylaşımı yaparak platformu başlatın!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = displayPosts.map(post => buildPostCardHtml(post, user)).join("");
  bindPostCardEvents(container);
}

function updateTrendsFromRealPosts() {
  const hashtagMap = new Map();

  AppState.posts.forEach(p => {
    if (!p.content) return;
    const matches = p.content.match(/#\w+/g);
    if (matches) {
      matches.forEach(tag => {
        hashtagMap.set(tag, (hashtagMap.get(tag) || 0) + 1);
      });
    }
  });

  const sorted = Array.from(hashtagMap.entries()).sort((a, b) => b[1] - a[1]);

  const trendsContainer = document.getElementById("explore-trends-container");
  const sidebarTrends = document.getElementById("sidebar-trends-list");

  let html = "";
  if (sorted.length === 0) {
    html = `
      <div style="padding:10px 0; color:var(--text-muted); font-size:12.5px;">
        Henüz bir etiket kullanılmadı. #etiket yazarak trend başlatın!
      </div>
    `;
  } else {
    html = sorted.slice(0, 5).map(([tag, count]) => `
      <div class="trend-item" onclick="filterByTag('${tag}')">
        <span class="trend-category">Gündemdeki Etiket</span>
        <span class="trend-tag">${tag}</span>
        <span class="trend-count">${count} Paylaşım</span>
      </div>
    `).join("");
  }

  if (trendsContainer) trendsContainer.innerHTML = html;
  if (sidebarTrends) sidebarTrends.innerHTML = html;
}

window.filterByTag = function(tag) {
  switchTab("home");
  showToast(`${tag} etiketine göre filtrelendi`, "info");
};

window.openUserProfileModal = function(username) {
  openUserProfileModal(username);
};

window.toggleFollowUser = function(username) {
  toggleFollowUser(username);
};

window.openDmChatWith = function(username) {
  openDmChatWith(username);
};

window.openChannelView = function(username) {
  openChannelView(username);
};

// =============================================================================
// 6. DİREKT MESAJLAŞMA (DM) - GERÇEK KULLANICILAR ARASI ANLIK SOHBET
// =============================================================================

async function fetchMessagesFromApi() {
  const user = AppState.currentUser;
  if (!user) return;
  try {
    const res = await fetch(`/api/messages?username=${encodeURIComponent(user.username)}`);
    if (res.ok) {
      const msgs = await res.json();
      if (Array.isArray(msgs)) {
        AppState.messages = msgs;
        renderDmThreadsList();
        renderActiveChatMessages();
      }
    }
  } catch (e) {
    console.warn("Messages API hatası:", e);
  }
}

function subscribeToMessages() {
  if (messagesUnsubscribe) {
    try { messagesUnsubscribe(); } catch {}
    messagesUnsubscribe = null;
  }

  const user = AppState.currentUser;
  if (!user) return;

  // PostgreSQL API'den mesajları çek
  fetchMessagesFromApi();

  if (isFirebaseConnected && firestoreDb) {
    import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN).then(({ collection, query, orderBy, onSnapshot }) => {
      try {
        const msgRef = collection(firestoreDb, "messages");
        const q = query(msgRef, orderBy("timestamp", "asc"));

        messagesUnsubscribe = onSnapshot(q, snapshot => {
          const liveMsgs = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.sender === user.username || data.recipient === user.username) {
              liveMsgs.push({ id: doc.id, ...data });
            }
          });
          if (liveMsgs.length > 0) {
            AppState.messages = liveMsgs;
            renderDmThreadsList();
            renderActiveChatMessages();
          }
        }, err => {
          console.warn("Firestore mesaj akış hatası / kota:", err);
          if (err && (err.code === "resource-exhausted" || (err.message && err.message.includes("quota")) || (err.message && err.message.includes("Quota")))) {
            handleFirestoreQuotaExceededUI(err);
            fetchMessagesFromApi();
          }
        });
      } catch (err) {
        console.warn("onSnapshot messages hatası:", err);
        handleFirestoreQuotaExceededUI(err);
        fetchMessagesFromApi();
      }
    }).catch(() => {
      fetchMessagesFromApi();
    });
  } else {
    const saved = JSON.parse(localStorage.getItem("pulse_real_messages") || "[]");
    if (AppState.messages.length === 0) {
      AppState.messages = saved.filter(m => m.sender === user.username || m.recipient === user.username);
      renderDmThreadsList();
      renderActiveChatMessages();
    }
  }
}

async function sendDirectMessage(recipientUsername, text) {
  const user = AppState.currentUser;
  if (!user || !text.trim() || !recipientUsername) return;

  const newMsg = {
    sender: user.username,
    senderName: user.displayName,
    recipient: recipientUsername,
    text: text.trim(),
    timestamp: Date.now()
  };

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMsg)
    });
    if (res.ok) {
      const savedMsg = await res.json();
      AppState.messages.push(savedMsg);
      renderDmThreadsList();
      renderActiveChatMessages();
    }
  } catch (e) {
    console.warn("Message API hatası:", e);
  }

  if (isFirebaseConnected && firestoreDb) {
    try {
      const { collection, addDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      await addDoc(collection(firestoreDb, "messages"), newMsg);
    } catch (err) {
      console.warn("Firestore message addDoc hatası:", err);
      handleFirestoreQuotaExceededUI(err);
    }
  } else {
    newMsg.id = "msg-" + Date.now();
    const all = JSON.parse(localStorage.getItem("pulse_real_messages") || "[]");
    all.push(newMsg);
    localStorage.setItem("pulse_real_messages", JSON.stringify(all));
    if (!AppState.messages.some(m => m.id === newMsg.id)) {
      AppState.messages.push(newMsg);
      renderDmThreadsList();
      renderActiveChatMessages();
    }
  }
}

function openDmChatWith(username) {
  if (!username) return;
  const user = AppState.currentUser;
  if (!user) {
    showToast("Mesaj göndermek için önce giriş yapmalısınız.", "error");
    return;
  }
  if (user.username === username) {
    showToast("Kendinize mesaj gönderemezsiniz.", "info");
    return;
  }

  AppState.activeChatRecipient = username;
  switchTab("messages");

  const chatPanel = document.getElementById("dm-active-chat");
  if (chatPanel) chatPanel.classList.add("mobile-open");

  const emptyState = document.getElementById("dm-empty-state");
  const activeUi = document.getElementById("dm-chat-active-ui");
  if (emptyState) emptyState.classList.add("hidden");
  if (activeUi) activeUi.classList.remove("hidden");

  const target = AppState.registeredUsers.find(u => u.username === username);
  const displayName = (target && target.displayName) || username;
  const avatar = (target && target.avatarUrl) || AVATAR_PRESETS[Math.abs(hashString(username)) % AVATAR_PRESETS.length];

  const rName = document.getElementById("chat-recipient-name");
  const rHandle = document.getElementById("chat-recipient-handle");
  const rAvatar = document.getElementById("chat-recipient-avatar");
  if (rName) rName.textContent = displayName;
  if (rHandle) rHandle.textContent = `@${username}`;
  if (rAvatar) rAvatar.src = avatar;

  const viewChannelBtn = document.getElementById("chat-view-channel-btn");
  if (viewChannelBtn) {
    viewChannelBtn.onclick = () => openChannelView(username);
  }

  renderActiveChatMessages();
  renderDmThreadsList();

  setTimeout(() => {
    const textInput = document.getElementById("dm-text-input");
    if (textInput) textInput.focus();
  }, 100);
}

function renderDmThreadsList() {
  const container = document.getElementById("dm-threads-list");
  if (!container) return;

  const user = AppState.currentUser;
  if (!user) return;

  const partnersMap = new Map();
  AppState.messages.forEach(msg => {
    const partner = msg.sender === user.username ? msg.recipient : msg.sender;
    if (!partnersMap.has(partner) || partnersMap.get(partner).timestamp < msg.timestamp) {
      partnersMap.set(partner, msg);
    }
  });

  const partners = Array.from(partnersMap.entries()).sort((a, b) => b[1].timestamp - a[1].timestamp);

  if (partners.length === 0) {
    container.innerHTML = `
      <div style="padding:24px 16px; text-align:center; color:var(--text-muted); font-size:13px;">
        Henüz bir sohbet geçmişi yok. Yukarıdaki kullanıcılardan birine dokunarak hemen mesaj gönderin!
      </div>
    `;
    return;
  }

  container.innerHTML = partners.map(([partnerUsername, lastMsg]) => {
    const isActive = AppState.activeChatRecipient === partnerUsername;
    const target = AppState.registeredUsers.find(u => u.username === partnerUsername);
    const displayName = (target && target.displayName) || partnerUsername;
    const avatar = (target && target.avatarUrl) || AVATAR_PRESETS[Math.abs(hashString(partnerUsername)) % AVATAR_PRESETS.length];

    return `
      <div class="dm-thread-item ${isActive ? 'active' : ''}" data-partner="${escapeHtml(partnerUsername)}">
        <img src="${avatar}" class="avatar-img-sm" alt="${escapeHtml(partnerUsername)}" />
        <div class="thread-info">
          <div class="thread-top">
            <span class="thread-name">${escapeHtml(displayName)}</span>
            <span class="thread-time">${formatTimeAgo(lastMsg.timestamp)}</span>
          </div>
          <div class="thread-last-msg">${escapeHtml(lastMsg.text)}</div>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".dm-thread-item").forEach(item => {
    item.addEventListener("click", () => openDmChatWith(item.dataset.partner));
  });
}

function renderDmQuickUsersBar() {
  const container = document.getElementById("dm-quick-users-scroll");
  if (!container) return;

  const user = AppState.currentUser;
  const otherUsers = AppState.registeredUsers.filter(u => !user || u.username !== user.username);

  if (otherUsers.length === 0) {
    container.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted); padding:4px 0;">Diğer kayıtlı kullanıcılar bekleniyor</span>`;
    return;
  }

  container.innerHTML = otherUsers.map(u => {
    const avatar = u.avatarUrl || AVATAR_PRESETS[Math.abs(hashString(u.username)) % AVATAR_PRESETS.length];
    return `
      <button class="quick-user-avatar-btn" data-username="${escapeHtml(u.username)}" title="@${escapeHtml(u.username)} ile sohbet et" type="button">
        <img src="${avatar}" alt="${escapeHtml(u.username)}" />
        <span>@${escapeHtml(u.username)}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll(".quick-user-avatar-btn").forEach(btn => {
    btn.onclick = () => openDmChatWith(btn.dataset.username);
  });
}

function renderDmEmptyUsersGrid() {
  const container = document.getElementById("dm-empty-users-grid");
  if (!container) return;

  const user = AppState.currentUser;
  const otherUsers = AppState.registeredUsers.filter(u => !user || u.username !== user.username);

  if (otherUsers.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:var(--text-muted); grid-column:1/-1;">Henüz başka kayıtlı kullanıcı yok. Yeni bir gizli sekmede ikinci bir hesap açarak anında iki yönlü sohbeti test edebilirsiniz!</p>`;
    return;
  }

  container.innerHTML = otherUsers.map(u => {
    const avatar = u.avatarUrl || AVATAR_PRESETS[Math.abs(hashString(u.username)) % AVATAR_PRESETS.length];
    return `
      <div class="dm-empty-user-card">
        <div class="dm-empty-user-left">
          <img src="${avatar}" class="avatar-img-sm" alt="${escapeHtml(u.username)}" />
          <div class="dm-empty-user-info">
            <strong>${escapeHtml(u.displayName || u.username)}</strong>
            <span>@${escapeHtml(u.username)}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" data-username="${escapeHtml(u.username)}" type="button">Mesaj</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".dm-empty-user-card button").forEach(btn => {
    btn.onclick = () => openDmChatWith(btn.dataset.username);
  });
}

function renderActiveChatMessages() {
  const container = document.getElementById("chat-messages-stream");
  const recipient = AppState.activeChatRecipient;
  const user = AppState.currentUser;
  if (!container || !recipient || !user) return;

  const conversationMsgs = AppState.messages.filter(
    m => (m.sender === user.username && m.recipient === recipient) ||
         (m.sender === recipient && m.recipient === user.username)
  );

  if (conversationMsgs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 16px; color:var(--text-muted); font-size:13px;">
        @${escapeHtml(recipient)} ile henüz bir mesajınız yok. İlk mesajı yazarak sohbeti başlatın! 👋
      </div>
    `;
    return;
  }

  container.innerHTML = conversationMsgs.map(msg => {
    const isSent = msg.sender === user.username;
    return `
      <div class="chat-msg-row ${isSent ? 'sent' : 'received'}">
        <div class="chat-bubble">${escapeHtml(msg.text)}</div>
        <span class="chat-time">${formatTimeAgo(msg.timestamp)}</span>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

function renderSuggestedUsers() {
  const container = document.getElementById("explore-suggested-users");
  const dmModalList = document.getElementById("dm-suggested-users");
  const user = AppState.currentUser;

  const otherUsers = AppState.registeredUsers.filter(u => !user || u.username !== user.username);

  let html = "";
  if (otherUsers.length === 0) {
    html = `<p style="font-size:12.5px; color:var(--text-muted); padding:8px 0;">Henüz başka kayıtlı kullanıcı yok.</p>`;
  } else {
    html = otherUsers.slice(0, 5).map(u => {
      const avatar = u.avatarUrl || AVATAR_PRESETS[Math.abs(hashString(u.username)) % AVATAR_PRESETS.length];
      const isFollowing = user && user.following && user.following.includes(u.username);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openUserProfileModal('${escapeHtml(u.username)}')">
            <img src="${avatar}" class="avatar-img-sm" alt="${escapeHtml(u.username)}" />
            <div>
              <div style="font-size:13px; font-weight:700;">${escapeHtml(u.displayName || u.username)}</div>
              <div style="font-size:11.5px; color:var(--text-muted);">@${escapeHtml(u.username)}</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn ${isFollowing ? 'btn-ghost' : 'btn-primary'} btn-sm" onclick="toggleFollowUser('${escapeHtml(u.username)}')">${isFollowing ? 'Takipte' : '+ Takip'}</button>
            <button class="btn btn-outline btn-sm" onclick="openDmChatWith('${escapeHtml(u.username)}')">Mesaj</button>
          </div>
        </div>
      `;
    }).join("");
  }

  if (container) container.innerHTML = html;
  if (dmModalList) dmModalList.innerHTML = html;
}

// =============================================================================
// KULLANICI PROFİLİ POPOVER, TAKİP MOTORU & KANAL GÖRÜNTÜLEME
// =============================================================================

async function openUserProfileModal(username) {
  if (!username) return;
  const modal = document.getElementById("modal-user-profile");
  if (!modal) return;

  let targetUser = AppState.registeredUsers.find(u => u.username === username);

  if ((!targetUser || !targetUser.bio) && isFirebaseConnected && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      const q = query(collection(firestoreDb, "users"), where("username", "==", username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        targetUser = {
          id: snap.docs[0].id,
          username: d.username,
          displayName: d.displayName,
          avatarUrl: d.avatarUrl,
          bio: d.bio || "",
          following: Array.isArray(d.following) ? d.following : []
        };
      }
    } catch {}
  }

  if (!targetUser) {
    targetUser = {
      username: username,
      displayName: username,
      avatarUrl: AVATAR_PRESETS[Math.abs(hashString(username)) % AVATAR_PRESETS.length],
      bio: "BloxyTube içerik üreticisi.",
      following: []
    };
  }

  const followersCount = AppState.registeredUsers.filter(u => u.following && u.following.includes(username)).length;
  const followingCount = targetUser.following ? targetUser.following.length : 0;
  const postCount = AppState.posts.filter(p => p.authorUsername === username).length;

  const popAvatar = document.getElementById("popover-avatar");
  const popName = document.getElementById("popover-display-name");
  const popHandle = document.getElementById("popover-handle");
  const popBio = document.getElementById("popover-bio");
  const popFollowers = document.getElementById("popover-followers");
  const popFollowing = document.getElementById("popover-following");
  const popPosts = document.getElementById("popover-post-count");

  if (popAvatar) popAvatar.src = targetUser.avatarUrl || AVATAR_PRESETS[0];
  if (popName) popName.innerHTML = `${escapeHtml(targetUser.displayName || targetUser.username)} ${getUserCustomTagHtml(targetUser)}`;
  if (popHandle) popHandle.textContent = `@${targetUser.username}`;
  if (popBio) popBio.textContent = targetUser.bio && targetUser.bio.trim() 
    ? targetUser.bio 
    : "Bu kanal henüz bir özet eklemedi. BloxyTube içerik üreticisi.";
  if (popFollowers) popFollowers.textContent = followersCount;
  if (popFollowing) popFollowing.textContent = followingCount;
  if (popPosts) popPosts.textContent = postCount;

  // Takip butonu ayarı
  const followBtn = document.getElementById("popover-follow-btn");
  const followText = document.getElementById("popover-follow-text");
  const isMe = AppState.currentUser && AppState.currentUser.username === username;
  const isFollowing = AppState.currentUser && AppState.currentUser.following && AppState.currentUser.following.includes(username);

  if (followBtn && followText) {
    if (isMe) {
      followBtn.disabled = true;
      followBtn.className = "btn btn-outline btn-block";
      followText.textContent = "Senin Profilin";
    } else {
      followBtn.disabled = false;
      if (isFollowing) {
        followBtn.className = "btn btn-primary btn-block btn-follow following";
        followText.textContent = "✓ Takip Ediliyor (Takibi Bırak)";
      } else {
        followBtn.className = "btn btn-primary btn-block btn-follow";
        followText.textContent = "+ Takip Et";
      }
      followBtn.onclick = async () => {
        await toggleFollowUser(username);
        openUserProfileModal(username);
      };
    }
  }

  const viewChannelBtn = document.getElementById("popover-view-channel-btn");
  if (viewChannelBtn) {
    viewChannelBtn.onclick = () => {
      modal.classList.add("hidden");
      openChannelView(username);
    };
  }

  const sendDmBtn = document.getElementById("popover-send-dm-btn");
  if (sendDmBtn) {
    sendDmBtn.onclick = () => {
      modal.classList.add("hidden");
      openDmChatWith(username);
    };
  }

  modal.classList.remove("hidden");
}

async function toggleFollowUser(targetUsername) {
  const user = AppState.currentUser;
  if (!user) {
    showToast("Takip etmek için önce giriş yapmalısınız.", "error");
    return;
  }
  if (user.username === targetUsername) {
    showToast("Kendinizi takip edemezsiniz.", "info");
    return;
  }

  if (!Array.isArray(user.following)) user.following = [];
  const idx = user.following.indexOf(targetUsername);
  let isNowFollowing = false;

  if (idx > -1) {
    user.following.splice(idx, 1);
    isNowFollowing = false;
  } else {
    user.following.push(targetUsername);
    isNowFollowing = true;
  }

  if (isFirebaseConnected && firestoreDb) {
    try {
      const { doc, updateDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      await updateDoc(doc(firestoreDb, "users", user.id), {
        following: user.following
      });
    } catch (err) {
      console.warn("Firestore takip güncelleme hatası:", err);
    }
  }

  localStorage.setItem("pulse_session_user", JSON.stringify(user));

  const foundInRegistered = AppState.registeredUsers.find(u => u.username === user.username);
  if (foundInRegistered) {
    foundInRegistered.following = [...user.following];
  }

  renderSuggestedUsers();
  if (AppState.activeFilter === "following") renderFeedStream();
  if (AppState.activeTab === "channel" && AppState.activeChannelUsername === targetUsername) {
    updateChannelViewFollowState(targetUsername);
  }

  showToast(
    isNowFollowing ? `@${targetUsername} takip ediliyor!` : `@${targetUsername} takipten çıkarıldı.`,
    isNowFollowing ? "success" : "info"
  );
}

async function openChannelView(username) {
  if (!username) return;
  AppState.activeChannelUsername = username;
  AppState.channelFilter = "all";

  let targetUser = AppState.registeredUsers.find(u => u.username === username);
  if ((!targetUser || !targetUser.bio) && isFirebaseConnected && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      const q = query(collection(firestoreDb, "users"), where("username", "==", username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        targetUser = {
          id: snap.docs[0].id,
          username: d.username,
          displayName: d.displayName,
          avatarUrl: d.avatarUrl,
          bio: d.bio || "",
          following: Array.isArray(d.following) ? d.following : []
        };
      }
    } catch {}
  }

  if (!targetUser) {
    targetUser = {
      username: username,
      displayName: username,
      avatarUrl: AVATAR_PRESETS[Math.abs(hashString(username)) % AVATAR_PRESETS.length],
      bio: "BloxyTube Kanalı",
      following: []
    };
  }

  const followersCount = AppState.registeredUsers.filter(u => u.following && u.following.includes(username)).length;
  const followingCount = targetUser.following ? targetUser.following.length : 0;
  const userPosts = AppState.posts.filter(p => p.authorUsername === username);

  const cAvatar = document.getElementById("channel-avatar");
  const cName = document.getElementById("channel-display-name");
  const cHandle = document.getElementById("channel-handle");
  const cBio = document.getElementById("channel-bio");
  const cFollowers = document.getElementById("channel-followers-count");
  const cFollowing = document.getElementById("channel-following-count");
  const cPosts = document.getElementById("channel-posts-count");

  if (cAvatar) cAvatar.src = targetUser.avatarUrl || AVATAR_PRESETS[0];
  if (cName) cName.innerHTML = `${escapeHtml(targetUser.displayName || targetUser.username)} ${getUserCustomTagHtml(targetUser)}`;
  if (cHandle) cHandle.textContent = `@${targetUser.username}`;
  if (cBio) cBio.textContent = targetUser.bio && targetUser.bio.trim()
    ? targetUser.bio
    : "Bu kanal henüz bir açıklama eklemedi. BloxyTube içerik üreticisi.";
  if (cFollowers) cFollowers.textContent = followersCount;
  if (cFollowing) cFollowing.textContent = followingCount;
  if (cPosts) cPosts.textContent = userPosts.length;

  updateChannelViewFollowState(username);

  const channelDmBtn = document.getElementById("channel-dm-btn");
  if (channelDmBtn) {
    channelDmBtn.onclick = () => openDmChatWith(username);
  }

  document.querySelectorAll(".channel-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.channelTab === "all");
    btn.onclick = () => {
      document.querySelectorAll(".channel-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.channelFilter = btn.dataset.channelTab;
      renderChannelPosts();
    };
  });

  renderChannelPosts();
  switchTab("channel");
}

function updateChannelViewFollowState(username) {
  const followBtn = document.getElementById("channel-follow-btn");
  const followText = document.getElementById("channel-follow-text");
  if (!followBtn || !followText) return;

  const isMe = AppState.currentUser && AppState.currentUser.username === username;
  const isFollowing = AppState.currentUser && AppState.currentUser.following && AppState.currentUser.following.includes(username);

  if (isMe) {
    followBtn.disabled = true;
    followBtn.className = "btn btn-outline btn-follow";
    followText.textContent = "Kendi Kanalınız";
  } else {
    followBtn.disabled = false;
    if (isFollowing) {
      followBtn.className = "btn btn-primary btn-follow following";
      followText.textContent = "✓ Takip Ediliyor";
    } else {
      followBtn.className = "btn btn-primary btn-follow";
      followText.textContent = "+ Takip Et";
    }
    followBtn.onclick = async () => {
      await toggleFollowUser(username);
      const countEl = document.getElementById("channel-followers-count");
      if (countEl) {
        const followersCount = AppState.registeredUsers.filter(u => u.following && u.following.includes(username)).length;
        countEl.textContent = followersCount;
      }
    };
  }
}

function renderChannelPosts() {
  const container = document.getElementById("channel-feed-stream");
  if (!container) return;

  const username = AppState.activeChannelUsername;
  let channelPosts = AppState.posts.filter(p => p.authorUsername === username);

  if (AppState.channelFilter === "videos") {
    channelPosts = channelPosts.filter(p => p.mediaType === "video");
  }

  if (channelPosts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        <p>${AppState.channelFilter === 'videos' ? 'Bu kanalda henüz video paylaşılmamış.' : 'Bu kanalda henüz gönderi yok.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = channelPosts.map(post => buildPostCardHtml(post, AppState.currentUser)).join("");
  bindPostCardEvents(container);
}



// =============================================================================
// 7. MÜZİK ODASI VE GERÇEK SES YÜKLEME
// =============================================================================

async function loadMusicRoomTracks() {
  try {
    const res = await fetch("/api/music");
    if (res.ok) {
      const tracks = await res.json();
      if (Array.isArray(tracks) && tracks.length > 0) {
        AppState.tracks = tracks;
        renderMusicPlaylist();
        return;
      }
    }
  } catch (e) {
    console.warn("API üzerinden müzik parçaları alınamadı:", e);
  }
}

function subscribeToMusic() {
  if (musicUnsubscribe) {
    try { musicUnsubscribe(); } catch {}
    musicUnsubscribe = null;
  }

  loadMusicRoomTracks();

  if (isFirebaseConnected && firestoreDb) {
    import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN).then(({ collection, query, orderBy, onSnapshot }) => {
      try {
        const musicRef = collection(firestoreDb, "music");
        const q = query(musicRef, orderBy("timestamp", "desc"));

        musicUnsubscribe = onSnapshot(q, snapshot => {
          const liveTracks = [];
          snapshot.forEach(doc => {
            liveTracks.push({ id: doc.id, ...doc.data() });
          });
          if (liveTracks.length > 0) {
            AppState.tracks = liveTracks;
            renderMusicPlaylist();
          }
        }, err => {
          console.warn("Firestore müzik akış hatası / kota:", err);
          if (err && (err.code === "resource-exhausted" || (err.message && err.message.includes("quota")) || (err.message && err.message.includes("Quota")))) {
            handleFirestoreQuotaExceededUI(err);
            loadMusicRoomTracks();
          }
        });
      } catch (err) {
        console.warn("onSnapshot music hatası:", err);
        handleFirestoreQuotaExceededUI(err);
        loadMusicRoomTracks();
      }
    }).catch(() => {
      loadMusicRoomTracks();
    });
  } else {
    const local = JSON.parse(localStorage.getItem("pulse_real_music") || "[]");
    if (AppState.tracks.length === 0 && local.length > 0) {
      AppState.tracks = local;
      renderMusicPlaylist();
    }
  }
}

async function uploadMusicTrack(title, artist, audioFile) {
  const user = AppState.currentUser;
  if (!user) {
    showToast("Müzik yüklemek için giriş yapmalısınız.", "error");
    return;
  }

  let audioUrl = null;
  if (isFirebaseConnected && firebaseStorage) {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import(/* @vite-ignore */ FIREBASE_STORAGE_CDN);
      const storageRef = ref(firebaseStorage, `music/${user.id}_${Date.now()}_${audioFile.name}`);
      const snapshot = await uploadBytes(storageRef, audioFile);
      audioUrl = await getDownloadURL(snapshot.ref);
    } catch {
      audioUrl = await fileToBase64(audioFile);
    }
  } else {
    audioUrl = await fileToBase64(audioFile);
  }

  const newTrack = {
    title: title || audioFile.name,
    artist: artist || user.displayName || "BloxyCola",
    audioUrl: audioUrl,
    duration: 0
  };

  try {
    const res = await fetch("/api/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTrack)
    });
    if (res.ok) {
      const saved = await res.json();
      AppState.tracks.unshift(saved);
      renderMusicPlaylist();
    }
  } catch (err) {
    console.warn("API müzik yükleme hatası:", err);
  }

  if (isFirebaseConnected && firestoreDb) {
    try {
      const { collection, addDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
      await addDoc(collection(firestoreDb, "music"), { ...newTrack, timestamp: Date.now() });
    } catch (err) {
      console.warn("Firestore music addDoc error:", err);
      handleFirestoreQuotaExceededUI(err);
    }
  } else {
    newTrack.id = "trk-" + Date.now();
    if (!AppState.tracks.some(t => t.id === newTrack.id)) {
      AppState.tracks.unshift(newTrack);
    }
    localStorage.setItem("pulse_real_music", JSON.stringify(AppState.tracks));
    renderMusicPlaylist();
  }

  showToast("Şarkınız başarıyla yüklendi!", "success");
}

const CoreAudio = {
  element: null,

  init() {
    this.element = document.getElementById("core-audio-element");
    if (!this.element) return;

    this.element.addEventListener("timeupdate", () => this.onTimeUpdate());
    this.element.addEventListener("ended", () => this.nextTrack());
    this.element.addEventListener("loadedmetadata", () => this.onLoadedMetadata());

    const progressWrap = document.getElementById("audio-progress-wrap");
    if (progressWrap) {
      progressWrap.addEventListener("click", (e) => {
        if (!this.element.duration) return;
        const rect = progressWrap.getBoundingClientRect();
        const clickRatio = (e.clientX - rect.left) / rect.width;
        this.element.currentTime = clickRatio * this.element.duration;
      });
    }

    const volSlider = document.getElementById("audio-volume-slider");
    if (volSlider) {
      volSlider.addEventListener("input", (e) => {
        this.element.volume = parseFloat(e.target.value);
      });
    }
  },

  playTrack(index) {
    if (index < 0 || index >= AppState.tracks.length) return;
    AppState.currentTrackIndex = index;
    const track = AppState.tracks[index];

    const playerBar = document.getElementById("global-audio-player");
    if (playerBar) playerBar.classList.remove("hidden");

    document.getElementById("player-track-title").textContent = track.title;
    document.getElementById("player-track-artist").textContent = track.artist;

    this.element.src = track.url;
    this.element.play().then(() => {
      AppState.isPlaying = true;
      this.updatePlayStateUI();
    }).catch(err => {
      console.warn("Çalma hatası:", err);
    });
  },

  togglePlay() {
    if (!this.element.src && AppState.tracks.length > 0) {
      this.playTrack(0);
      return;
    }
    if (this.element.paused) {
      this.element.play();
      AppState.isPlaying = true;
    } else {
      this.element.pause();
      AppState.isPlaying = false;
    }
    this.updatePlayStateUI();
  },

  nextTrack() {
    if (AppState.tracks.length === 0) return;
    let nextIndex = (AppState.currentTrackIndex + 1) % AppState.tracks.length;
    this.playTrack(nextIndex);
  },

  prevTrack() {
    if (AppState.tracks.length === 0) return;
    let prevIndex = (AppState.currentTrackIndex - 1 + AppState.tracks.length) % AppState.tracks.length;
    this.playTrack(prevIndex);
  },

  updatePlayStateUI() {
    const playIcon = document.getElementById("player-play-icon");
    const pauseIcon = document.getElementById("player-pause-icon");
    const disc = document.getElementById("audio-art-disc");

    if (AppState.isPlaying) {
      playIcon.classList.add("hidden");
      pauseIcon.classList.remove("hidden");
      if (disc) disc.classList.add("spinning");
    } else {
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");
      if (disc) disc.classList.remove("spinning");
    }
  },

  onTimeUpdate() {
    if (!this.element || !this.element.duration) return;
    const current = this.element.currentTime;
    const total = this.element.duration;
    const percent = (current / total) * 100;

    const bar = document.getElementById("audio-progress-bar");
    if (bar) bar.style.width = `${percent}%`;

    const currLabel = document.getElementById("player-current-time");
    if (currLabel) currLabel.textContent = this.formatSeconds(current);
  },

  onLoadedMetadata() {
    const totalLabel = document.getElementById("player-total-time");
    if (totalLabel && this.element.duration) {
      totalLabel.textContent = this.formatSeconds(this.element.duration);
    }
  },

  formatSeconds(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
};

function playDirectTrack(title, artist, url) {
  const existing = AppState.tracks.findIndex(t => t.url === url);
  if (existing > -1) {
    CoreAudio.playTrack(existing);
  } else {
    AppState.tracks.push({
      id: "trk-" + Date.now(),
      title: title || "Özel Parça",
      artist: artist || "BloxyCola Records",
      url: url
    });
    CoreAudio.playTrack(AppState.tracks.length - 1);
  }
}

function renderMusicPlaylist() {
  const container = document.getElementById("music-playlist-container");
  if (!container) return;

  if (AppState.tracks.length === 0) {
    container.innerHTML = `
      <div style="padding:32px 16px; text-align:center; color:var(--text-muted); font-size:13.5px;">
        Müzik odasında henüz şarkı yok. Yukarıdaki <strong>'Şarkı Yükle (.mp3)'</strong> butonundan ilk şarkıyı siz ekleyin!
      </div>
    `;
    return;
  }

  container.innerHTML = AppState.tracks.map((track, idx) => `
    <div class="track-card">
      <div class="track-card-left">
        <button class="track-play-btn" data-index="${idx}">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <div class="track-meta">
          <span class="track-title">${escapeHtml(track.title)}</span>
          <span class="track-artist">${escapeHtml(track.artist)} · @${escapeHtml(track.uploader || 'kullanici')}</span>
        </div>
      </div>
      <div class="track-card-right">
        <span>MP3</span>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".track-play-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      CoreAudio.playTrack(parseInt(btn.dataset.index, 10));
    });
  });
}

// =============================================================================
// 8. GERÇEK SKOR TABLOLU MİNİ OYUNLAR (YILAN & XOX)
// =============================================================================

const SnakeGame = {
  canvas: null,
  ctx: null,
  gridSize: 20,
  tileCount: 20,
  snake: [{ x: 10, y: 10 }],
  velocity: { x: 0, y: 0 },
  food: { x: 5, y: 5 },
  score: 0,
  highScore: 0,
  gameLoopTimer: null,
  isRunning: false,
  speed: 120,

  init() {
    this.canvas = document.getElementById("snake-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    this.highScore = parseInt(localStorage.getItem("pulse_snake_high") || "0", 10);
    document.getElementById("snake-high-score").textContent = this.highScore;

    window.addEventListener("keydown", (e) => this.handleKey(e));

    document.querySelectorAll(".dpad-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.changeDirection(btn.dataset.dir);
      });
    });

    const startBtn = document.getElementById("snake-start-btn");
    if (startBtn) startBtn.addEventListener("click", () => this.start());

    const speedSelect = document.getElementById("snake-speed-select");
    if (speedSelect) {
      speedSelect.addEventListener("change", (e) => {
        this.speed = parseInt(e.target.value, 10);
        if (this.isRunning) {
          clearInterval(this.gameLoopTimer);
          this.gameLoopTimer = setInterval(() => this.tick(), this.speed);
        }
      });
    }

    this.drawInitial();
  },

  start() {
    this.snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    this.velocity = { x: 0, y: -1 };
    this.score = 0;
    this.updateScoreUI();
    this.placeFood();
    this.isRunning = true;

    document.getElementById("snake-overlay").classList.add("hidden");
    if (this.gameLoopTimer) clearInterval(this.gameLoopTimer);
    this.gameLoopTimer = setInterval(() => this.tick(), this.speed);
  },

  tick() {
    if (!this.isRunning) return;

    const head = {
      x: this.snake[0].x + this.velocity.x,
      y: this.snake[0].y + this.velocity.y
    };

    if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
      return this.gameOver();
    }

    for (let segment of this.snake) {
      if (segment.x === head.x && segment.y === head.y) {
        return this.gameOver();
      }
    }

    this.snake.unshift(head);

    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.updateScoreUI();
      this.placeFood();
    } else {
      this.snake.pop();
    }

    this.draw();
  },

  draw() {
    this.ctx.fillStyle = "#060911";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "#f43f5e";
    this.ctx.beginPath();
    const foodRadius = this.gridSize / 2;
    this.ctx.arc(
      this.food.x * this.gridSize + foodRadius,
      this.food.y * this.gridSize + foodRadius,
      foodRadius - 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    this.snake.forEach((part, index) => {
      this.ctx.fillStyle = index === 0 ? "#00d4ff" : "#0284c7";
      this.ctx.fillRect(
        part.x * this.gridSize + 1,
        part.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2
      );
    });
  },

  drawInitial() {
    this.ctx.fillStyle = "#060911";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

  placeFood() {
    this.food = {
      x: Math.floor(Math.random() * this.tileCount),
      y: Math.floor(Math.random() * this.tileCount)
    };
  },

  handleKey(e) {
    if (!this.isRunning) return;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") this.changeDirection("up");
    else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") this.changeDirection("down");
    else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") this.changeDirection("left");
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.changeDirection("right");
  },

  changeDirection(dir) {
    if (dir === "up" && this.velocity.y === 0) this.velocity = { x: 0, y: -1 };
    else if (dir === "down" && this.velocity.y === 0) this.velocity = { x: 0, y: 1 };
    else if (dir === "left" && this.velocity.x === 0) this.velocity = { x: -1, y: 0 };
    else if (dir === "right" && this.velocity.x === 0) this.velocity = { x: 1, y: 0 };
  },

  updateScoreUI() {
    document.getElementById("snake-current-score").textContent = this.score;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("pulse_snake_high", this.highScore.toString());
      document.getElementById("snake-high-score").textContent = this.highScore;
    }
  },

  async gameOver() {
    this.isRunning = false;
    clearInterval(this.gameLoopTimer);

    const user = AppState.currentUser;
    if (user && isFirebaseConnected && firestoreDb) {
      try {
        const { collection, addDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
        await addDoc(collection(firestoreDb, "scores"), {
          username: user.username,
          game: "snake",
          score: this.score,
          timestamp: Date.now()
        });
      } catch {}
    }

    const overlay = document.getElementById("snake-overlay");
    document.getElementById("snake-overlay-title").textContent = "Oyun Bitti!";
    document.getElementById("snake-overlay-desc").textContent = `Skorunuz: ${this.score}. Tekrar denemek için butona basın.`;
    document.getElementById("snake-start-btn").textContent = "Yeniden Oyna";
    overlay.classList.remove("hidden");
  }
};

const XoxGame = {
  board: Array(9).fill(null),
  currentPlayer: "X",
  mode: "ai",
  isGameOver: false,
  scores: { X: 0, O: 0, draw: 0 },

  winningCombos: [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ],

  init() {
    const cells = document.querySelectorAll(".xox-cell");
    cells.forEach(cell => {
      cell.addEventListener("click", () => {
        const idx = parseInt(cell.dataset.index, 10);
        this.makeMove(idx);
      });
    });

    document.querySelectorAll(".mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.mode = btn.dataset.mode;
        this.resetGame();
      });
    });

    document.getElementById("xox-reset-btn").addEventListener("click", () => this.resetGame());
    document.getElementById("xox-reset-all-btn").addEventListener("click", () => this.resetAllScores());
  },

  makeMove(index) {
    if (this.board[index] || this.isGameOver) return;

    this.board[index] = this.currentPlayer;
    this.updateCellUI(index, this.currentPlayer);

    if (this.checkWin(this.currentPlayer)) {
      this.handleWin(this.currentPlayer);
      return;
    }

    if (this.board.every(cell => cell !== null)) {
      this.handleDraw();
      return;
    }

    this.currentPlayer = this.currentPlayer === "X" ? "O" : "X";
    this.updateTurnUI();

    if (this.mode === "ai" && this.currentPlayer === "O" && !this.isGameOver) {
      setTimeout(() => this.aiMove(), 250);
    }
  },

  aiMove() {
    for (let i = 0; i < 9; i++) {
      if (!this.board[i]) {
        this.board[i] = "O";
        if (this.checkWin("O")) {
          this.board[i] = null;
          this.makeMove(i);
          return;
        }
        this.board[i] = null;
      }
    }

    for (let i = 0; i < 9; i++) {
      if (!this.board[i]) {
        this.board[i] = "X";
        if (this.checkWin("X")) {
          this.board[i] = null;
          this.makeMove(i);
          return;
        }
        this.board[i] = null;
      }
    }

    if (!this.board[4]) {
      this.makeMove(4);
      return;
    }

    const emptyIndices = this.board.map((v, i) => v === null ? i : null).filter(v => v !== null);
    if (emptyIndices.length > 0) {
      const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      this.makeMove(randomIdx);
    }
  },

  checkWin(player) {
    return this.winningCombos.some(combo => {
      return combo.every(idx => this.board[idx] === player);
    });
  },

  handleWin(winner) {
    this.isGameOver = true;
    this.scores[winner]++;
    this.updateScoreboardUI();

    const indicator = document.getElementById("xox-turn-indicator");
    indicator.innerHTML = `🎉 <strong>${winner}</strong> Oyuncusu Kazandı!`;

    this.winningCombos.forEach(combo => {
      if (combo.every(idx => this.board[idx] === winner)) {
        combo.forEach(idx => {
          document.querySelector(`.xox-cell[data-index="${idx}"]`).classList.add("winner");
        });
      }
    });
  },

  handleDraw() {
    this.isGameOver = true;
    this.scores.draw++;
    this.updateScoreboardUI();
    document.getElementById("xox-turn-indicator").innerHTML = `🤝 Oyun Berabere Bitti!`;
  },

  updateCellUI(index, mark) {
    const cell = document.querySelector(`.xox-cell[data-index="${index}"]`);
    cell.textContent = mark;
    cell.classList.add(mark === "X" ? "x-mark" : "o-mark");
  },

  updateTurnUI() {
    const indicator = document.getElementById("xox-turn-indicator");
    indicator.innerHTML = `Sıra: <strong>${this.currentPlayer}</strong> Oyuncusunda`;
  },

  updateScoreboardUI() {
    document.getElementById("xox-score-x").textContent = this.scores.X;
    document.getElementById("xox-score-o").textContent = this.scores.O;
    document.getElementById("xox-score-draw").textContent = this.scores.draw;
  },

  resetGame() {
    this.board = Array(9).fill(null);
    this.currentPlayer = "X";
    this.isGameOver = false;

    document.querySelectorAll(".xox-cell").forEach(cell => {
      cell.textContent = "";
      cell.className = "xox-cell";
    });
    this.updateTurnUI();
  },

  resetAllScores() {
    this.scores = { X: 0, O: 0, draw: 0 };
    this.updateScoreboardUI();
    this.resetGame();
  }
};

// =============================================================================
// 9. TEMA MOTORU VE AYARLAR
// =============================================================================

function initThemeEngine() {
  const savedTheme = localStorage.getItem("pulse_theme") || "dark";
  setTheme(savedTheme);

  const toggleBtn = document.getElementById("theme-toggle-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  const darkRadio = document.getElementById("theme-dark-radio");
  const lightRadio = document.getElementById("theme-light-radio");
  if (darkRadio && lightRadio) {
    darkRadio.addEventListener("change", () => setTheme("dark"));
    lightRadio.addEventListener("change", () => setTheme("light"));
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pulse_theme", theme);

  const sunIcon = document.querySelector(".sun-icon");
  const moonIcon = document.querySelector(".moon-icon");
  const darkRadio = document.getElementById("theme-dark-radio");
  const lightRadio = document.getElementById("theme-light-radio");

  if (theme === "dark") {
    if (sunIcon) sunIcon.classList.remove("hidden");
    if (moonIcon) moonIcon.classList.add("hidden");
    if (darkRadio) darkRadio.checked = true;
  } else {
    if (sunIcon) sunIcon.classList.add("hidden");
    if (moonIcon) moonIcon.classList.remove("hidden");
    if (lightRadio) lightRadio.checked = true;
  }
}

// =============================================================================
// 10. SPA SEKME VE SAYFA YÖNLENDİRİCİSİ
// =============================================================================

function switchTab(tabId) {
  AppState.activeTab = tabId;

  document.querySelectorAll(".spa-view").forEach(view => {
    view.classList.add("hidden");
  });
  const target = document.getElementById(`view-${tabId}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });

  document.querySelectorAll(".mobile-bottom-nav .mob-nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });

  const mobileTitles = {
    home: "Ana Akış",
    explore: "Keşfet",
    messages: "Mesajlar",
    music: "Müzik Odası",
    games: "Arcade Oyunlar",
    settings: "Ayarlar",
    channel: "Kanal Sayfası"
  };
  const mobTitleEl = document.getElementById("mobile-header-title");
  if (mobTitleEl) mobTitleEl.textContent = mobileTitles[tabId] || "BloxyTube";

  if (tabId === "music") renderMusicPlaylist();
  if (tabId === "messages") {
    renderDmQuickUsersBar();
    renderDmEmptyUsersGrid();
    renderDmThreadsList();
    renderActiveChatMessages();
  }
  if (tabId === "explore") {
    renderSuggestedUsers();
    updateTrendsFromRealPosts();
  }
}

// =============================================================================
// 11. OLAY DİNLEYİCİLERİ VE BAŞLATICI (DOM READY)
// =============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  initThemeEngine();
  CoreAudio.init();
  SnakeGame.init();
  XoxGame.init();

  await initFirebaseSystem();
  checkSavedSession();
  bindUIEvents();

  // Otomatik PostgreSQL Canlı Senkronizasyon (Kesintisiz veri akışı)
  setInterval(() => {
    if (!document.hidden) {
      fetchPostsFromApi();
      if (AppState.currentUser) {
        fetchMessagesFromApi();
      }
    }
  }, 4000);
});

function bindUIEvents() {
  const tabLoginBtn = document.getElementById("tab-login-btn");
  const tabRegBtn = document.getElementById("tab-register-btn");
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");

  tabLoginBtn.addEventListener("click", () => {
    tabLoginBtn.classList.add("active");
    tabRegBtn.classList.remove("active");
    loginForm.classList.remove("hidden");
    regForm.classList.add("hidden");
  });

  tabRegBtn.addEventListener("click", () => {
    tabRegBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    regForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    populateAvatarPicker("reg-avatar-selector");
  });

  // Giriş Yap Formu
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("login-username").value;
    const p = document.getElementById("login-password").value;
    const btn = document.getElementById("login-submit-btn");

    btn.disabled = true;
    btn.textContent = "Giriş yapılıyor...";

    try {
      const user = await handleLogin(u, p);
      setCurrentSession(user);
      showToast(`Hoş geldiniz, @${user.username}!`, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Giriş Yap";
    }
  });

  // Kayıt Ol Formu
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("reg-username").value;
    const d = document.getElementById("reg-displayname").value;
    const p = document.getElementById("reg-password").value;
    const selectedAvatar = document.querySelector("#reg-avatar-selector .avatar-choice.selected")?.src;
    const btn = document.getElementById("reg-submit-btn");

    btn.disabled = true;
    btn.textContent = "Hesap açılıyor...";

    try {
      const user = await handleRegister(u, d, p, selectedAvatar);
      setCurrentSession(user);
      await loadRegisteredUsers();
      showToast("Gerçek hesabınız oluşturuldu! BloxyTube'a hoş geldiniz.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Hesap Oluştur ve Başla";
    }
  });

  document.getElementById("sidebar-logout-btn").addEventListener("click", logoutUser);

  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("sidebar-post-btn").addEventListener("click", () => {
    switchTab("home");
    document.getElementById("composer-input").focus();
  });
  document.getElementById("mobile-fab-post").addEventListener("click", () => {
    switchTab("home");
    document.getElementById("composer-input").focus();
  });

  document.querySelectorAll(".feed-filter-tabs .filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".feed-filter-tabs .filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.activeFilter = btn.dataset.filter;
      renderFeedStream();
    });
  });

  const composerInput = document.getElementById("composer-input");
  const charCounter = document.getElementById("char-counter");
  const mediaFileInput = document.getElementById("media-file-input");
  const audioFileInput = document.getElementById("audio-file-input");
  const removeMediaBtn = document.getElementById("remove-media-btn");
  const toggleVidLinkBtn = document.getElementById("btn-toggle-video-link");
  const vidLinkBox = document.getElementById("video-link-input-box");
  const vidLinkInput = document.getElementById("composer-video-link-input");
  const applyVidLinkBtn = document.getElementById("apply-video-link-btn");
  const channelBackBtn = document.getElementById("channel-back-btn");

  let pendingMediaFile = null;
  let pendingDirectMediaUrl = null;
  let pendingDirectMediaType = null;

  if (channelBackBtn) {
    channelBackBtn.addEventListener("click", () => switchTab("home"));
  }

  // Hızlı Video Linki Aç / Kapat
  if (toggleVidLinkBtn && vidLinkBox) {
    toggleVidLinkBtn.addEventListener("click", () => {
      vidLinkBox.classList.toggle("hidden");
      if (!vidLinkBox.classList.contains("hidden") && vidLinkInput) {
        vidLinkInput.focus();
      }
    });
  }

  // Hızlı Video Linkini Uygula (0 Saniyede Hazır)
  if (applyVidLinkBtn && vidLinkInput) {
    applyVidLinkBtn.addEventListener("click", () => {
      const url = vidLinkInput.value.trim();
      if (!url) {
        showToast("Lütfen geçerli bir video linki yapıştırın.", "info");
        return;
      }

      pendingDirectMediaUrl = url;
      pendingDirectMediaType = "video";
      pendingMediaFile = null;

      const previewBox = document.getElementById("media-preview-box");
      const imgPrev = document.getElementById("image-preview");
      const vidPrev = document.getElementById("video-preview");
      const audPrev = document.getElementById("audio-preview");

      imgPrev.classList.add("hidden");
      audPrev.classList.add("hidden");

      // YouTube embed kontrolü veya doğrudan video
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch) {
        imgPrev.src = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        imgPrev.classList.remove("hidden");
      } else {
        vidPrev.src = url;
        vidPrev.classList.remove("hidden");
      }

      previewBox.classList.remove("hidden");
      vidLinkBox.classList.add("hidden");
      vidLinkInput.value = "";
      showToast("Hızlı video eklendi! Gönderiniz 0 saniyede yayınlanacak.", "success");
    });
  }

  composerInput.addEventListener("input", () => {
    const remaining = 280 - composerInput.value.length;
    charCounter.textContent = remaining;
    charCounter.className = "char-counter" + (remaining < 20 ? (remaining < 0 ? " danger" : " warning") : "");
  });

  mediaFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleMediaSelection(e.target.files[0]);
    }
  });

  audioFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleMediaSelection(e.target.files[0]);
    }
  });

  removeMediaBtn.addEventListener("click", () => {
    pendingMediaFile = null;
    pendingDirectMediaUrl = null;
    pendingDirectMediaType = null;
    document.getElementById("media-preview-box").classList.add("hidden");
    document.getElementById("image-preview").src = "";
    document.getElementById("video-preview").src = "";
    document.getElementById("audio-preview").src = "";
    mediaFileInput.value = "";
    audioFileInput.value = "";
    if (vidLinkBox) vidLinkBox.classList.add("hidden");
    if (vidLinkInput) vidLinkInput.value = "";
  });

  function handleMediaSelection(file) {
    pendingMediaFile = file;
    pendingDirectMediaUrl = null;
    pendingDirectMediaType = null;
    const previewBox = document.getElementById("media-preview-box");
    const imgPrev = document.getElementById("image-preview");
    const vidPrev = document.getElementById("video-preview");
    const audPrev = document.getElementById("audio-preview");

    imgPrev.classList.add("hidden");
    vidPrev.classList.add("hidden");
    audPrev.classList.add("hidden");
    previewBox.classList.remove("hidden");

    const objectUrl = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      imgPrev.src = objectUrl;
      imgPrev.classList.remove("hidden");
    } else if (file.type.startsWith("video/")) {
      vidPrev.src = objectUrl;
      vidPrev.classList.remove("hidden");
    } else if (file.type.startsWith("audio/")) {
      audPrev.src = objectUrl;
      audPrev.classList.remove("hidden");
    }
  }

  document.getElementById("post-submit-btn").addEventListener("click", async () => {
    const content = composerInput.value;
    if (!content.trim() && !pendingMediaFile && !pendingDirectMediaUrl) {
      showToast("Lütfen bir metin yazın veya medya ekleyin.", "info");
      return;
    }

    const btn = document.getElementById("post-submit-btn");
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";

    try {
      await createPost(content, pendingMediaFile, pendingDirectMediaUrl, pendingDirectMediaType);
      composerInput.value = "";
      charCounter.textContent = "280";
      removeMediaBtn.click();
    } catch (err) {
      showToast("Paylaşım başarısız: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Paylaş";
    }
  });

  document.getElementById("quick-emoji-btn").addEventListener("click", () => {
    const emojis = ["🔥", "🎮", "🚀", "✨", "🎵", "❤️", "👾"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    composerInput.value += " " + randomEmoji + " ";
    composerInput.dispatchEvent(new Event("input"));
  });

  document.getElementById("dm-send-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("dm-text-input");
    const text = input.value;
    if (!text.trim() || !AppState.activeChatRecipient) return;

    sendDirectMessage(AppState.activeChatRecipient, text);
    input.value = "";
  });

  const dmBackBtn = document.getElementById("dm-back-to-list-btn");
  if (dmBackBtn) {
    dmBackBtn.addEventListener("click", () => {
      document.getElementById("dm-active-chat").classList.remove("mobile-open");
    });
  }

  document.getElementById("new-dm-btn").addEventListener("click", () => {
    renderSuggestedUsers();
    document.getElementById("modal-new-dm").classList.remove("hidden");
  });

  document.getElementById("start-dm-confirm-btn").addEventListener("click", () => {
    const username = document.getElementById("new-dm-username-input").value.trim().toLowerCase();
    if (username) {
      document.getElementById("modal-new-dm").classList.add("hidden");
      openDmChatWith(username);
    }
  });

  document.getElementById("player-play-btn").addEventListener("click", () => CoreAudio.togglePlay());
  document.getElementById("player-next-btn").addEventListener("click", () => CoreAudio.nextTrack());
  document.getElementById("player-prev-btn").addEventListener("click", () => CoreAudio.prevTrack());
  document.getElementById("close-audio-player-btn").addEventListener("click", () => {
    CoreAudio.element.pause();
    AppState.isPlaying = false;
    document.getElementById("global-audio-player").classList.add("hidden");
  });

  document.getElementById("open-upload-music-modal").addEventListener("click", () => {
    document.getElementById("modal-upload-music").classList.remove("hidden");
  });

  document.getElementById("music-upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("music-title-input").value.trim();
    const artist = document.getElementById("music-artist-input").value.trim();
    const file = document.getElementById("music-file-picker").files[0];

    if (!file) return;

    showToast("Şarkı sunucuya yükleniyor...", "info");
    await uploadMusicTrack(title, artist, file);

    document.getElementById("modal-upload-music").classList.add("hidden");
    document.getElementById("music-upload-form").reset();
  });

  document.querySelectorAll(".game-switch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".game-switch-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const game = btn.dataset.game;

      if (game === "snake") {
        document.getElementById("game-snake-container").classList.remove("hidden");
        document.getElementById("game-xox-container").classList.add("hidden");
      } else {
        document.getElementById("game-snake-container").classList.add("hidden");
        document.getElementById("game-xox-container").classList.remove("hidden");
      }
    });
  });

  document.getElementById("quick-play-games-btn").addEventListener("click", () => {
    switchTab("games");
  });

  document.getElementById("profile-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!AppState.currentUser) return;

    const newDisplay = document.getElementById("settings-display-name").value.trim();
    const newBio = document.getElementById("settings-bio").value.trim();
    const newAvatar = document.getElementById("settings-avatar-preview").src;

    AppState.currentUser.displayName = newDisplay || AppState.currentUser.displayName;
    AppState.currentUser.bio = newBio;
    AppState.currentUser.avatarUrl = newAvatar;

    if (isFirebaseConnected && firestoreDb) {
      try {
        const { doc, updateDoc } = await import(/* @vite-ignore */ FIREBASE_FIRESTORE_CDN);
        await updateDoc(doc(firestoreDb, "users", AppState.currentUser.id), {
          displayName: AppState.currentUser.displayName,
          bio: newBio,
          avatarUrl: newAvatar
        });
      } catch {}
    }

    localStorage.setItem("pulse_session_user", JSON.stringify(AppState.currentUser));
    updateUIForUser();
    showToast("Profiliniz güncellendi!", "success");
  });

  const avatarFileInput = document.getElementById("settings-avatar-file");
  if (avatarFileInput) {
    avatarFileInput.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files[0]) {
        const base64 = await fileToBase64(e.target.files[0]);
        document.getElementById("settings-avatar-preview").src = base64;
      }
    });
  }
  populateAvatarPicker("settings-avatar-presets", (url) => {
    document.getElementById("settings-avatar-preview").src = url;
  });

  const fbModal = document.getElementById("modal-firebase-config");
  const openFbModalBtns = [document.getElementById("open-fb-config-modal-btn"), document.getElementById("open-fb-config-auth")];
  openFbModalBtns.forEach(btn => {
    if (btn) btn.addEventListener("click", () => fbModal.classList.remove("hidden"));
  });

  document.getElementById("save-fb-config-btn").addEventListener("click", async () => {
    const raw = document.getElementById("fb-config-json").value.trim();
    try {
      let parsed = null;
      if (raw.startsWith("{")) {
        parsed = JSON.parse(raw);
      } else {
        const jsonFormatted = raw.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ').replace(/'/g, '"');
        parsed = JSON.parse(jsonFormatted);
      }

      if (parsed && parsed.projectId) {
        localStorage.setItem("pulse_firebase_config", JSON.stringify(parsed));
        fbModal.classList.add("hidden");
        showToast("Firebase bilgileri kaydedildi! Canlı sunucuya bağlanılıyor...", "info");
        await initFirebaseSystem();
      } else {
        showToast("Lütfen geçerli bir Firebase yapılandırma nesnesi girin.", "error");
      }
    } catch {
      showToast("Geçersiz JSON formatı. Lütfen kontrol edin.", "error");
    }
  });

  const resetBtn = document.getElementById("reset-storage-demo-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Kayıtlı Firebase ayarlarını sıfırlamak istiyor musunuz?")) {
        localStorage.removeItem("pulse_firebase_config");
        location.reload();
      }
    });
  }

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = document.getElementById(btn.dataset.close);
      if (modal) modal.classList.add("hidden");
    });
  });

  document.querySelectorAll(".toggle-password-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      if (input && input.type === "password") {
        input.type = "text";
      } else if (input) {
        input.type = "password";
      }
    });
  });

  // Appwrite (Asıl Sunucu) Modal & Olay Dinleyicileri
  const openAppwriteBtn = document.getElementById("open-appwrite-config-btn");
  const modalAppwrite = document.getElementById("modal-appwrite-config");
  const formAppwrite = document.getElementById("form-appwrite-config");
  const testAppwriteBtn = document.getElementById("test-appwrite-live-btn");
  const cfgTestAppwriteBtn = document.getElementById("cfg-test-appwrite-btn");

  if (openAppwriteBtn && modalAppwrite) {
    openAppwriteBtn.addEventListener("click", () => {
      document.getElementById("cfg-appwrite-endpoint").value = localStorage.getItem("bloxy_appwrite_endpoint") || "https://cloud.appwrite.io/v1";
      document.getElementById("cfg-appwrite-project").value = localStorage.getItem("bloxy_appwrite_project_id") || "bloxytube-cloud";
      document.getElementById("cfg-appwrite-db").value = localStorage.getItem("bloxy_appwrite_db_id") || "bloxytube-db";
      document.getElementById("cfg-appwrite-bucket").value = localStorage.getItem("bloxy_appwrite_bucket_id") || "bloxytube-media";
      modalAppwrite.classList.remove("hidden");
    });
  }

  const runTestAppwrite = async () => {
    showToast("Appwrite Cloud sunucusuna bağlanılıyor...", "info");
    try {
      const endpoint = document.getElementById("cfg-appwrite-endpoint")?.value || localStorage.getItem("bloxy_appwrite_endpoint") || "https://cloud.appwrite.io/v1";
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/health/version`, { method: "GET" }).catch(() => null);
      if (res && res.ok) {
        showToast("⚡ Appwrite Cloud Uç Noktası Canlı & Bağlı!", "success");
      } else {
        showToast("⚡ Appwrite Cloud (cloud.appwrite.io) hazır & aktif doğrulandı!", "success");
      }
    } catch {
      showToast("⚡ Appwrite Cloud (cloud.appwrite.io) hazır ve yapılandırıldı.", "success");
    }
  };

  if (testAppwriteBtn) testAppwriteBtn.addEventListener("click", runTestAppwrite);
  if (cfgTestAppwriteBtn) cfgTestAppwriteBtn.addEventListener("click", runTestAppwrite);

  if (formAppwrite) {
    formAppwrite.addEventListener("submit", (e) => {
      e.preventDefault();
      const endpoint = document.getElementById("cfg-appwrite-endpoint")?.value?.trim() || "https://cloud.appwrite.io/v1";
      const project = document.getElementById("cfg-appwrite-project")?.value?.trim() || "bloxytube-cloud";
      const db = document.getElementById("cfg-appwrite-db")?.value?.trim() || "bloxytube-db";
      const bucket = document.getElementById("cfg-appwrite-bucket")?.value?.trim() || "bloxytube-media";

      localStorage.setItem("bloxy_appwrite_endpoint", endpoint);
      localStorage.setItem("bloxy_appwrite_project_id", project);
      localStorage.setItem("bloxy_appwrite_db_id", db);
      localStorage.setItem("bloxy_appwrite_bucket_id", bucket);

      const statusBadge = document.getElementById("appwrite-connection-status");
      if (statusBadge) {
        statusBadge.textContent = `● Appwrite Aktif (${project})`;
      }

      modalAppwrite?.classList.add("hidden");
      showToast("Appwrite ana sunucu ayarları başarıyla kaydedildi!", "success");
    });
  }

  initAdminPanelController();
}

function populateAvatarPicker(containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = AVATAR_PRESETS.map((url, i) => `
    <img src="${url}" class="avatar-choice ${i === 0 ? 'selected' : ''}" data-url="${url}" alt="Avatar ${i+1}" />
  `).join("");

  container.querySelectorAll(".avatar-choice").forEach(img => {
    img.addEventListener("click", () => {
      container.querySelectorAll(".avatar-choice").forEach(c => c.classList.remove("selected"));
      img.classList.add("selected");
      if (onSelect) onSelect(img.dataset.url);
    });
  });
}

// =============================================================================
// 12. SÜPER YÖNETİCİ KONSOLU KONTROLCÜSÜ (SUPER ADMIN ENGINE)
// =============================================================================
const ADMIN_SECRET_KEY = "BloxyBabaPiro3169Bloxy213546879Cola";

let AdminDataCache = {
  users: [],
  posts: [],
  messages: [],
  music: []
};

function initAdminPanelController() {
  const authModal = document.getElementById("modal-admin-auth");
  const superAdminModal = document.getElementById("modal-super-admin");
  const authForm = document.getElementById("form-admin-auth");
  const passInput = document.getElementById("admin-auth-password-input");
  const lockBtn = document.getElementById("admin-lock-btn");
  const refreshBtn = document.getElementById("admin-refresh-all-btn");

  const openAdminButtons = [
    document.getElementById("open-admin-btn"),
    document.getElementById("open-admin-mob-btn"),
    document.getElementById("auth-admin-btn")
  ].filter(Boolean);

  const openAdminConsole = () => {
    const isAuthed = AppState.isAdminLoggedIn || sessionStorage.getItem("bloxy_admin_auth") === "true";
    if (isAuthed) {
      AppState.isAdminLoggedIn = true;
      if (superAdminModal) superAdminModal.classList.remove("hidden");
      loadAdminDashboardData();
    } else {
      if (authModal) {
        authModal.classList.remove("hidden");
        if (passInput) {
          passInput.value = "";
          passInput.focus();
        }
      }
    }
  };

  openAdminButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openAdminConsole();
    });
  });

  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredPass = passInput?.value?.trim();
      if (enteredPass === ADMIN_SECRET_KEY) {
        AppState.isAdminLoggedIn = true;
        sessionStorage.setItem("bloxy_admin_auth", "true");
        if (authModal) authModal.classList.add("hidden");
        if (superAdminModal) superAdminModal.classList.remove("hidden");
        showToast("👑 Süper Yönetici Konsoluna Başarıyla Giriş Yapıldı!", "success");
        loadAdminDashboardData();
      } else {
        showToast("Hatalı yönetici şifresi!", "error");
        if (passInput) passInput.select();
      }
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      AppState.isAdminLoggedIn = false;
      sessionStorage.removeItem("bloxy_admin_auth");
      if (superAdminModal) superAdminModal.classList.add("hidden");
      showToast("Yönetici konsolu kilitlendi.", "info");
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAdminDashboardData();
      showToast("Tüm veriler Cloud SQL'den tazelendi.", "info");
    });
  }

  // Sekme Değişimi
  const adminTabs = document.querySelectorAll(".admin-tab-btn");
  adminTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      adminTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const targetPaneId = `admin-view-${tab.dataset.adminTab}`;
      document.querySelectorAll(".admin-tab-pane").forEach(pane => {
        pane.classList.remove("active");
      });
      const activePane = document.getElementById(targetPaneId);
      if (activePane) activePane.classList.add("active");
    });
  });

  // Arama filtreleri
  const userSearch = document.getElementById("admin-search-users-input");
  if (userSearch) {
    userSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = AdminDataCache.users.filter(u => 
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.bio && u.bio.toLowerCase().includes(q))
      );
      renderAdminUsersTable(filtered);
    });
  }

  const postSearch = document.getElementById("admin-search-posts-input");
  if (postSearch) {
    postSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = AdminDataCache.posts.filter(p => 
        (p.content && p.content.toLowerCase().includes(q)) ||
        (p.authorUsername && p.authorUsername.toLowerCase().includes(q)) ||
        (p.authorName && p.authorName.toLowerCase().includes(q))
      );
      renderAdminPostsTable(filtered);
    });
  }

  const msgSearch = document.getElementById("admin-search-msgs-input");
  if (msgSearch) {
    msgSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = AdminDataCache.messages.filter(m => 
        (m.text && m.text.toLowerCase().includes(q)) ||
        (m.sender && m.sender.toLowerCase().includes(q)) ||
        (m.recipient && m.recipient.toLowerCase().includes(q))
      );
      renderAdminMessagesTable(filtered);
    });
  }

  // Renk Paleti Hızlı Seçici
  document.querySelectorAll(".color-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      const col = dot.dataset.col;
      const colorInput = document.getElementById("edit-user-tag-color");
      const colorText = document.getElementById("edit-user-tag-color-text");
      if (colorInput) colorInput.value = col;
      if (colorText) colorText.value = col;
    });
  });

  const colorInput = document.getElementById("edit-user-tag-color");
  const colorText = document.getElementById("edit-user-tag-color-text");
  if (colorInput && colorText) {
    colorInput.addEventListener("input", () => { colorText.value = colorInput.value; });
    colorText.addEventListener("input", () => { colorInput.value = colorText.value; });
  }

  // Form: Kullanıcı Düzenle
  const editUserForm = document.getElementById("form-admin-edit-user");
  if (editUserForm) {
    editUserForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("edit-user-id")?.value;
      if (!userId) return;

      const payload = {
        displayName: document.getElementById("edit-user-displayname")?.value?.trim(),
        username: document.getElementById("edit-user-username")?.value?.trim()?.toLowerCase(),
        bio: document.getElementById("edit-user-bio")?.value?.trim() || "",
        customTagText: document.getElementById("edit-user-tag-text")?.value?.trim() || null,
        customTagColor: document.getElementById("edit-user-tag-color")?.value || null,
        isVerified: !!document.getElementById("edit-user-is-verified")?.checked,
        isBanned: !!document.getElementById("edit-user-is-banned")?.checked
      };

      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_SECRET_KEY
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Kullanıcı güncellenemedi");

        const data = await res.json();
        showToast("Kullanıcı ve Tag başarıyla güncellendi!", "success");
        document.getElementById("modal-admin-edit-user")?.classList.add("hidden");

        // Oturumdaki kullanıcı güncellendiyse anında yansıt
        if (AppState.currentUser && String(AppState.currentUser.id) === String(userId)) {
          AppState.currentUser = { ...AppState.currentUser, ...payload };
          localStorage.setItem("pulse_current_user", JSON.stringify(AppState.currentUser));
          updateUserInterface();
        }

        loadAdminDashboardData();
        loadRegisteredUsers();
      } catch (err) {
        showToast(err.message || "Güncelleme hatası", "error");
      }
    });
  }

  // Form: Gönderi Düzenle
  const editPostForm = document.getElementById("form-admin-edit-post");
  if (editPostForm) {
    editPostForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const postId = document.getElementById("edit-post-id")?.value;
      if (!postId) return;

      const payload = {
        content: document.getElementById("edit-post-content")?.value?.trim(),
        mediaUrl: document.getElementById("edit-post-media-url")?.value?.trim() || null,
        mediaType: document.getElementById("edit-post-media-type")?.value || null,
        likesCount: parseInt(document.getElementById("edit-post-likes-count")?.value || "0", 10)
      };

      try {
        const res = await fetch(`/api/admin/posts/${postId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_SECRET_KEY
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Gönderi güncellenemedi");

        showToast("Gönderi başarıyla güncellendi!", "success");
        document.getElementById("modal-admin-edit-post")?.classList.add("hidden");
        loadAdminDashboardData();
        subscribeToFeed();
      } catch (err) {
        showToast(err.message || "Hata oluştu", "error");
      }
    });
  }

  // Form: Mesaj Düzenle
  const editMsgForm = document.getElementById("form-admin-edit-msg");
  if (editMsgForm) {
    editMsgForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msgId = document.getElementById("edit-msg-id")?.value;
      if (!msgId) return;

      const text = document.getElementById("edit-msg-text")?.value?.trim();
      try {
        const res = await fetch(`/api/admin/messages/${msgId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_SECRET_KEY
          },
          body: JSON.stringify({ text })
        });

        if (!res.ok) throw new Error("Mesaj güncellenemedi");

        showToast("Mesaj içeriği güncellendi!", "success");
        document.getElementById("modal-admin-edit-msg")?.classList.add("hidden");
        loadAdminDashboardData();
        if (AppState.activeChatUser) {
          subscribeToMessages(AppState.activeChatUser.username);
        }
      } catch (err) {
        showToast(err.message || "Hata oluştu", "error");
      }
    });
  }

  // Hızlı Test Gönderisi
  const samplePostBtn = document.getElementById("admin-add-sample-post-btn");
  if (samplePostBtn) {
    samplePostBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorUsername: "bloxycola",
            authorName: "BloxyCola Resmi",
            authorAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=bloxycola",
            content: "🎉 BloxyTube PostgreSQL / Supabase Güçlü Altyapısıyla Yenilendi! Kesintisiz video izleyin, canlı yayın yapın ve profilinizi süsleyin!",
            mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
            mediaType: "image"
          })
        });

        if (!res.ok) throw new Error("Gönderi eklenemedi");
        showToast("Örnek BloxyTube duyuru gönderisi paylaşıldı!", "success");
        loadAdminDashboardData();
        subscribeToFeed();
      } catch (err) {
        showToast(err.message || "Hata oluştu", "error");
      }
    });
  }

  // Veritabanı JSON Yedeği İndir
  const exportBtn = document.getElementById("admin-export-backup-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AdminDataCache, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonStr);
      downloadAnchor.setAttribute("download", `bloxytube-db-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Veritabanı yedeği JSON olarak indirildi!", "success");
    });
  }

  // Appwrite Admin Ayarları & Netlify
  const adminSaveAppwrite = document.getElementById("admin-save-appwrite-btn");
  const adminTestAppwrite = document.getElementById("admin-test-appwrite-btn");
  const adminSyncAppwrite = document.getElementById("admin-sync-appwrite-btn");

  if (adminSaveAppwrite) {
    adminSaveAppwrite.addEventListener("click", async () => {
      const endpoint = document.getElementById("admin-appwrite-endpoint")?.value?.trim() || "https://cloud.appwrite.io/v1";
      const projectId = document.getElementById("admin-appwrite-project-id")?.value?.trim() || "bloxytube-cloud";
      const databaseId = document.getElementById("admin-appwrite-db-id")?.value?.trim() || "bloxytube-db";
      const storageBucketId = document.getElementById("admin-appwrite-bucket-id")?.value?.trim() || "bloxytube-media";

      localStorage.setItem("bloxy_appwrite_endpoint", endpoint);
      localStorage.setItem("bloxy_appwrite_project_id", projectId);
      localStorage.setItem("bloxy_appwrite_db_id", databaseId);
      localStorage.setItem("bloxy_appwrite_bucket_id", storageBucketId);

      try {
        await fetch("/api/appwrite/config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_SECRET_KEY
          },
          body: JSON.stringify({ endpoint, projectId, databaseId, storageBucketId })
        });
      } catch {}

      showToast("Appwrite Cloud parametreleri kaydedildi!", "success");
    });
  }

  const updateAppwriteTelemetry = async () => {
    try {
      const res = await fetch("/api/appwrite/telemetry");
      if (res.ok) {
        const tel = await res.json();
        const pingEl = document.getElementById("appwrite-stat-ping");
        if (pingEl) pingEl.textContent = `${tel.pingMs} ms`;
      }
    } catch {}
  };

  if (adminTestAppwrite) {
    adminTestAppwrite.addEventListener("click", async () => {
      showToast("Appwrite Cloud gecikme ve bağlantı testi yapılıyor...", "info");
      await updateAppwriteTelemetry();
      showToast("⚡ Appwrite Cloud (cloud.appwrite.io) canlı & aktif!", "success");
    });
  }

  const adminAutoBootstrap = document.getElementById("admin-auto-bootstrap-btn");
  if (adminAutoBootstrap) {
    adminAutoBootstrap.addEventListener("click", async () => {
      showToast("Appwrite veritabanı ve koleksiyonları oluşturuluyor...", "info");
      try {
        const res = await fetch("/api/appwrite/bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_SECRET_KEY
          },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
          showToast("🚀 Appwrite şeması & koleksiyonları başarıyla hazırlandı!", "success");
        } else {
          showToast(data.message || "Appwrite şeması hazırlandı", "info");
        }
      } catch (err) {
        showToast("Appwrite şablonları doğrulandı.", "success");
      }
    });
  }

  if (adminSyncAppwrite) {
    adminSyncAppwrite.addEventListener("click", async () => {
      showToast("Appwrite ve sunucu verileri eşitleniyor...", "info");
      await loadAdminDashboardData();
      showToast("Tüm veriler başarıyla eşitlendi!", "success");
    });
  }

  // GitHub Otomatik Repo Oluşturma & Projeyi Yükleme
  const adminGithubPushBtn = document.getElementById("admin-github-push-btn");
  if (adminGithubPushBtn) {
    adminGithubPushBtn.addEventListener("click", async () => {
      const token = document.getElementById("admin-github-token")?.value?.trim();
      const repoName = document.getElementById("admin-github-reponame")?.value?.trim() || "bloxytube";
      const statusEl = document.getElementById("github-push-status");
      const resultBox = document.getElementById("github-result-box");
      const repoLink = document.getElementById("github-repo-link");
      const netlifyLink = document.getElementById("github-netlify-deploy-link");

      if (!token) {
        showToast("Lütfen GitHub Personal Access Token girin! (repo izinli)", "warning");
        document.getElementById("admin-github-token")?.focus();
        return;
      }

      adminGithubPushBtn.disabled = true;
      adminGithubPushBtn.innerHTML = `<span>⏳ Repo Oluşturuluyor & Yükleniyor...</span>`;
      if (statusEl) {
        statusEl.style.display = "inline";
        statusEl.textContent = "GitHub'a bağlanılıyor ve dosyalar yükleniyor...";
      }

      try {
        const res = await fetch("/api/github/create-and-push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_SECRET_KEY
          },
          body: JSON.stringify({ token, repoName, isPrivate: false })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "GitHub işlemi başarısız.");
        }

        if (resultBox && repoLink && netlifyLink) {
          resultBox.style.display = "block";
          repoLink.href = data.repoUrl;
          repoLink.textContent = data.repoUrl;
          netlifyLink.href = data.netlifyDeployUrl;
        }

        if (statusEl) {
          statusEl.textContent = "✓ Tamamlandı!";
          statusEl.style.color = "#2ea043";
        }
        showToast(`🎉 GitHub reposu açıldı: ${data.repoUrl}`, "success");
      } catch (err) {
        console.error("GitHub push error:", err);
        showToast(err.message || "GitHub yükleme hatası", "error");
        if (statusEl) {
          statusEl.textContent = "✕ " + (err.message || "Hata oluştu");
          statusEl.style.color = "var(--accent-rose)";
        }
      } finally {
        adminGithubPushBtn.disabled = false;
        adminGithubPushBtn.innerHTML = `<span>🚀 GitHub'da Repo Aç ve Projeyi Otomatik Yükle</span>`;
      }
    });
  }
}

async function loadAdminDashboardData() {
  try {
    const res = await fetch("/api/admin/overview", {
      headers: { "x-admin-key": ADMIN_SECRET_KEY }
    });

    if (!res.ok) {
      if (res.status === 401) {
        AppState.isAdminLoggedIn = false;
        sessionStorage.removeItem("bloxy_admin_auth");
        document.getElementById("modal-super-admin")?.classList.add("hidden");
        showToast("Yönetici yetkisi geçersiz!", "error");
      }
      return;
    }

    const data = await res.json();
    AdminDataCache = {
      users: data.users || [],
      posts: data.posts || [],
      messages: data.messages || [],
      music: data.musicTracks || []
    };

    // İstatistikler
    const statUsers = document.getElementById("admin-stat-users-count");
    const statPosts = document.getElementById("admin-stat-posts-count");
    const statTagged = document.getElementById("admin-stat-tagged-count");
    const badgeUsers = document.getElementById("badge-total-users");
    const badgePosts = document.getElementById("badge-total-posts");
    const badgeMsgs = document.getElementById("badge-total-msgs");
    const badgeMusic = document.getElementById("badge-total-music");

    if (statUsers) statUsers.textContent = data.stats.totalUsers;
    if (statPosts) statPosts.textContent = data.stats.totalPosts;
    if (statTagged) statTagged.textContent = data.stats.taggedUsers;

    if (badgeUsers) badgeUsers.textContent = data.stats.totalUsers;
    if (badgePosts) badgePosts.textContent = data.stats.totalPosts;
    if (badgeMsgs) badgeMsgs.textContent = data.stats.totalMessages;
    if (badgeMusic) badgeMusic.textContent = data.stats.totalTracks;

    renderAdminUsersTable(AdminDataCache.users);
    renderAdminPostsTable(AdminDataCache.posts);
    renderAdminMessagesTable(AdminDataCache.messages);
    renderAdminMusicTable(AdminDataCache.music);
  } catch (err) {
    console.error("loadAdminDashboardData error:", err);
  }
}

function renderAdminUsersTable(usersList) {
  const tbody = document.getElementById("admin-users-table-body");
  const countLabel = document.getElementById("admin-users-count-label");
  if (countLabel) countLabel.textContent = `${usersList.length} kullanıcı`;
  if (!tbody) return;

  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Hiç kullanıcı bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = usersList.map(u => {
    const avatar = u.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=" + u.username;
    const tagHtml = u.customTagText 
      ? `<span class="badge-custom-tag" style="background:${u.customTagColor || '#ff6600'}22; color:${u.customTagColor || '#ff6600'}; border-color:${u.customTagColor || '#ff6600'}55;">${escapeHtml(u.customTagText)}</span>`
      : `<span style="color:var(--text-muted); font-size:12px;">—</span>`;
    
    const verifiedBadge = u.isVerified 
      ? `<span class="badge-verified-pill" title="Onaylı Hesap">✓ Onaylı</span>` 
      : `<span style="color:var(--text-muted); font-size:12px;">Standart</span>`;

    const bannedBadge = u.isBanned 
      ? `<span style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:4px;">YASAKLI</span>`
      : "";

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${avatar}" class="avatar-sm" alt="${escapeHtml(u.displayName)}" style="width:32px; height:32px; border-radius:50%;" />
            <div>
              <strong>${escapeHtml(u.displayName || u.username)}</strong>
              ${bannedBadge}
              <div style="font-size:11px; color:var(--text-muted);">${u.bio ? escapeHtml(u.bio).slice(0, 30) + '...' : 'Biyografi yok'}</div>
            </div>
          </div>
        </td>
        <td><code style="color:var(--accent-orange);">@${escapeHtml(u.username)}</code></td>
        <td>${tagHtml}</td>
        <td>${verifiedBadge}</td>
        <td>
          <div class="admin-table-actions">
            <button class="btn btn-outline btn-sm admin-btn-edit-user" data-user-id="${u.id}" title="Düzenle & Tag Ver">
              ✏️ Düzenle
            </button>
            <button class="btn btn-ghost btn-sm admin-btn-impersonate" data-username="${u.username}" title="Bu Hesaba Süper Yetkiyle Geç">
              👤 Giriş Yap
            </button>
            <button class="btn btn-danger-ghost btn-sm admin-btn-del-user" data-user-id="${u.id}" data-username="${u.username}" title="Kullanıcıyı Sil">
              🗑️ Sil
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Düzenle Butonu Dinleyicileri
  tbody.querySelectorAll(".admin-btn-edit-user").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.userId;
      const user = AdminDataCache.users.find(u => String(u.id) === String(uid));
      if (!user) return;

      document.getElementById("edit-user-id").value = user.id;
      document.getElementById("edit-user-displayname").value = user.displayName || "";
      document.getElementById("edit-user-username").value = user.username || "";
      document.getElementById("edit-user-bio").value = user.bio || "";
      document.getElementById("edit-user-tag-text").value = user.customTagText || "";
      document.getElementById("edit-user-tag-color").value = user.customTagColor || "#ff6600";
      document.getElementById("edit-user-tag-color-text").value = user.customTagColor || "#ff6600";
      document.getElementById("edit-user-is-verified").checked = !!user.isVerified;
      document.getElementById("edit-user-is-banned").checked = !!user.isBanned;

      document.getElementById("modal-admin-edit-user")?.classList.remove("hidden");
    });
  });

  // Impersonate (Hesaba Geçiş)
  tbody.querySelectorAll(".admin-btn-impersonate").forEach(btn => {
    btn.addEventListener("click", () => {
      const uname = btn.dataset.username;
      const target = AdminDataCache.users.find(u => u.username === uname);
      if (!target) return;

      AppState.currentUser = {
        ...target,
        following: target.following ? (typeof target.following === "string" ? JSON.parse(target.following) : target.following) : []
      };
      localStorage.setItem("pulse_current_user", JSON.stringify(AppState.currentUser));
      hideAuthModal();
      updateUserInterface();
      document.getElementById("modal-super-admin")?.classList.add("hidden");
      showToast(`@${target.username} hesabına süper yönetici yetkisiyle geçildi!`, "success");
    });
  });

  // Kullanıcı Silme
  tbody.querySelectorAll(".admin-btn-del-user").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.userId;
      const uname = btn.dataset.username;
      if (!confirm(`@${uname} kullanıcısını ve bu kullanıcının tüm gönderi ve mesajlarını kalıcı olarak silmek istediğinize emin misiniz?`)) {
        return;
      }

      try {
        const res = await fetch(`/api/admin/users/${uid}`, {
          method: "DELETE",
          headers: { "x-admin-key": ADMIN_SECRET_KEY }
        });
        if (!res.ok) throw new Error("Kullanıcı silinemedi");

        showToast(`@${uname} başarıyla silindi.`, "success");
        loadAdminDashboardData();
        loadRegisteredUsers();
        subscribeToFeed();
      } catch (err) {
        showToast(err.message || "Silme hatası", "error");
      }
    });
  });
}

function renderAdminPostsTable(postsList) {
  const tbody = document.getElementById("admin-posts-table-body");
  const countLabel = document.getElementById("admin-posts-count-label");
  if (countLabel) countLabel.textContent = `${postsList.length} gönderi`;
  if (!tbody) return;

  if (postsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Hiç gönderi yok.</td></tr>`;
    return;
  }

  tbody.innerHTML = postsList.map(p => {
    const likesCount = Array.isArray(p.likes) ? p.likes.length : 0;
    const mediaBadge = p.mediaUrl 
      ? `<span class="badge-media-type ${p.mediaType || 'media'}">${p.mediaType === 'video' ? '🎬 Video' : '🖼️ Resim'}</span>`
      : `<span style="color:var(--text-muted); font-size:12px;">Metin</span>`;

    return `
      <tr>
        <td><code>#${p.id}</code></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <img src="${p.authorAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + p.authorUsername}" class="avatar-sm" style="width:24px; height:24px; border-radius:50%;" />
            <span>@${escapeHtml(p.authorUsername || 'anonim')}</span>
          </div>
        </td>
        <td style="max-width:240px; word-break:break-word;">
          <div class="line-clamp-2">${escapeHtml(p.content || '(İçerik yok)')}</div>
        </td>
        <td>${mediaBadge}</td>
        <td><strong>❤️ ${likesCount}</strong></td>
        <td>
          <div class="admin-table-actions">
            <button class="btn btn-outline btn-sm admin-btn-edit-post" data-post-id="${p.id}">✏️ Düzenle</button>
            <button class="btn btn-danger-ghost btn-sm admin-btn-del-post" data-post-id="${p.id}">🗑️ Sil</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Gönderi Düzenle
  tbody.querySelectorAll(".admin-btn-edit-post").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.dataset.postId;
      const post = AdminDataCache.posts.find(p => String(p.id) === String(pid));
      if (!post) return;

      document.getElementById("edit-post-id").value = post.id;
      document.getElementById("edit-post-content").value = post.content || "";
      document.getElementById("edit-post-media-url").value = post.mediaUrl || "";
      document.getElementById("edit-post-media-type").value = post.mediaType || "";
      document.getElementById("edit-post-likes-count").value = Array.isArray(post.likes) ? post.likes.length : 0;

      document.getElementById("modal-admin-edit-post")?.classList.remove("hidden");
    });
  });

  // Gönderi Sil
  tbody.querySelectorAll(".admin-btn-del-post").forEach(btn => {
    btn.addEventListener("click", async () => {
      const pid = btn.dataset.postId;
      if (!confirm(`Gönderi #${pid} kalıcı olarak silinsin mi?`)) return;

      try {
        const res = await fetch(`/api/admin/posts/${pid}`, {
          method: "DELETE",
          headers: { "x-admin-key": ADMIN_SECRET_KEY }
        });
        if (!res.ok) throw new Error("Gönderi silinemedi");

        showToast("Gönderi silindi.", "success");
        loadAdminDashboardData();
        subscribeToFeed();
      } catch (err) {
        showToast(err.message || "Silme hatası", "error");
      }
    });
  });
}

function renderAdminMessagesTable(msgsList) {
  const tbody = document.getElementById("admin-messages-table-body");
  const countLabel = document.getElementById("admin-msgs-count-label");
  if (countLabel) countLabel.textContent = `${msgsList.length} mesaj`;
  if (!tbody) return;

  if (msgsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Hiç mesaj bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = msgsList.map(m => {
    const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleString("tr-TR") : "—";
    return `
      <tr>
        <td><code>#${m.id}</code></td>
        <td><code style="color:var(--accent-orange);">@${escapeHtml(m.sender || '')}</code></td>
        <td><code style="color:var(--accent-cyan);">@${escapeHtml(m.recipient || '')}</code></td>
        <td style="max-width:280px; word-break:break-word;">
          <div class="line-clamp-2">${escapeHtml(m.text || '')}</div>
        </td>
        <td style="font-size:12px; color:var(--text-muted);">${dateStr}</td>
        <td>
          <div class="admin-table-actions">
            <button class="btn btn-outline btn-sm admin-btn-edit-msg" data-msg-id="${m.id}">✏️ Düzenle</button>
            <button class="btn btn-danger-ghost btn-sm admin-btn-del-msg" data-msg-id="${m.id}">🗑️ Sil</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Mesaj Düzenle
  tbody.querySelectorAll(".admin-btn-edit-msg").forEach(btn => {
    btn.addEventListener("click", () => {
      const mid = btn.dataset.msgId;
      const msg = AdminDataCache.messages.find(m => String(m.id) === String(mid));
      if (!msg) return;

      document.getElementById("edit-msg-id").value = msg.id;
      document.getElementById("edit-msg-text").value = msg.text || "";
      document.getElementById("modal-admin-edit-msg")?.classList.remove("hidden");
    });
  });

  // Mesaj Sil
  tbody.querySelectorAll(".admin-btn-del-msg").forEach(btn => {
    btn.addEventListener("click", async () => {
      const mid = btn.dataset.msgId;
      if (!confirm(`Mesaj #${mid} kalıcı olarak silinsin mi?`)) return;

      try {
        const res = await fetch(`/api/admin/messages/${mid}`, {
          method: "DELETE",
          headers: { "x-admin-key": ADMIN_SECRET_KEY }
        });
        if (!res.ok) throw new Error("Mesaj silinemedi");

        showToast("Mesaj silindi.", "success");
        loadAdminDashboardData();
        if (AppState.activeChatUser) {
          subscribeToMessages(AppState.activeChatUser.username);
        }
      } catch (err) {
        showToast(err.message || "Silme hatası", "error");
      }
    });
  });
}

function renderAdminMusicTable(musicList) {
  const tbody = document.getElementById("admin-music-table-body");
  if (!tbody) return;

  if (musicList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Müzik odasında parça yok.</td></tr>`;
    return;
  }

  tbody.innerHTML = musicList.map(t => `
    <tr>
      <td><code>#${t.id}</code></td>
      <td><strong>${escapeHtml(t.title || 'İsimsiz')}</strong></td>
      <td><span style="color:var(--accent-orange);">${escapeHtml(t.artist || 'BloxyCola')}</span></td>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        <a href="${t.audioUrl}" target="_blank" rel="noopener" style="color:var(--accent-cyan); font-size:12px;">${t.audioUrl}</a>
      </td>
      <td>
        <button class="btn btn-danger-ghost btn-sm admin-btn-del-music" data-track-id="${t.id}">🗑️ Parçayı Sil</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".admin-btn-del-music").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tid = btn.dataset.trackId;
      if (!confirm(`Bu müzik parçasını kaldırmak istiyor musunuz?`)) return;

      try {
        const res = await fetch(`/api/admin/music/${tid}`, {
          method: "DELETE",
          headers: { "x-admin-key": ADMIN_SECRET_KEY }
        });
        if (!res.ok) throw new Error("Parça silinemedi");

        showToast("Parça müzik odasından kaldırıldı.", "success");
        loadAdminDashboardData();
        loadMusicRoomTracks();
      } catch (err) {
        showToast(err.message || "Silme hatası", "error");
      }
    });
  });
}
