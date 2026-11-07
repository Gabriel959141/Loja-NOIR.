/* ================================================
   NOIR — Loja de Roupas | app.js
   Conexão com Supabase
   ================================================ */

/* ---------- CONFIGURAÇÃO (preencha com seus dados) ---------- */
const SUPABASE_URL = "https://osqgegksvsuokjgwuqoc.supabase.co";        // ex: https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcWdlZ2tzdnN1b2tqZ3d1cW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMDM1NjQsImV4cCI6MjEwOTU3OTU2NH0.rja94cBdYKwSL5uwVRBM-_wObpG0xyXmqr2Es0Z1YVk";       // chave pública "anon" (começa com eyJ)

/* ---------- ELEMENTOS DE STATUS (definidos antes de tudo) ---------- */
const statusEl = document.getElementById("status");
const statusMsg = statusEl.querySelector(".status__msg");

function showError(msg) {
  statusMsg.textContent = msg;
  statusMsg.classList.add("error");
  console.error(msg);
}

/* ---------- VALIDAÇÃO DAS CREDENCIAIS (anti carregamento infinito) ---------- */
if (!SUPABASE_URL || !SUPABASE_URL.startsWith("https://") || SUPABASE_URL.includes("COLE_AQUI")) {
  showError("⚠️ SUPABASE_URL não configurada em app.js — veja Project Settings → API no Supabase.");
  throw new Error("SUPABASE_URL inválida");
}

if (!SUPABASE_ANON_KEY || !SUPABASE_ANON_KEY.startsWith("eyJ") || SUPABASE_ANON_KEY.includes("COLE_AQUI")) {
  showError("⚠️ SUPABASE_ANON_KEY não configurada em app.js — copie a chave anon public no Supabase.");
  throw new Error("SUPABASE_ANON_KEY inválida");
}

/* ---------- CLIENTE SUPABASE ---------- */
let supabaseClient;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  showError("⚠️ Não foi possível conectar ao Supabase: " + err.message);
  throw err;
}

/* ---------- ESTADO ---------- */
let allProducts = [];
let activeCategory = "Todas";
let cart = JSON.parse(localStorage.getItem("noir_cart") || "[]");

/* ---------- ELEMENTOS ---------- */
const grid = document.getElementById("productGrid");
const filtersEl = document.getElementById("filters");

/* ---------- CARREGAR PRODUTOS ---------- */
async function loadProducts() {
  statusMsg.classList.remove("error");
  statusMsg.textContent = "Carregando produtos…";

  // Timeout de segurança: nunca fica carregando para sempre
  const timeout = setTimeout(() => {
    showError("⏱️ Tempo esgotado. Verifique a URL, a chave e se a tabela 'produtos' existe no Supabase.");
  }, 15000);

  try {
    const { data, error } = await supabaseClient
      .from("produtos")
      .select("*")
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    clearTimeout(timeout);

    if (error) throw error;

    if (!data || data.length === 0) {
      statusMsg.textContent = "Nenhum produto cadastrado ainda. Adicione produtos na tabela 'produtos' do Supabase.";
      statusMsg.classList.add("error");
      return;
    }

    allProducts = data;
    statusEl.classList.add("hidden");
    renderFilters();
    renderProducts();
  } catch (err) {
    clearTimeout(timeout);
    showError("❌ Erro ao carregar produtos: " + err.message);
    console.error("Supabase error:", err);
  }
}

/* ---------- FILTROS ---------- */
function renderFilters() {
  const cats = ["Todas", ...new Set(allProducts.map(p => p.categoria))];
  filtersEl.innerHTML = cats.map(c =>
    `<button class="filter-btn ${c === activeCategory ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");

  filtersEl.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderFilters();
      renderProducts();
    });
  });
}

/* ---------- RENDER ---------- */
function renderProducts() {
  const list = activeCategory === "Todas"
    ? allProducts
    : allProducts.filter(p => p.categoria === activeCategory);

  if (!list.length) {
    grid.innerHTML = `<p class="cart-empty">Nenhum produto encontrado.</p>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <article class="card">
      <img class="card__img" src="${p.imagem_url || "https://placehold.co/400x533/111111/c9a227?text=NOIR"}" alt="${p.nome}" />
      <div class="card__body">
        <span class="card__cat">${p.categoria}</span>
        <h3 class="card__name">${p.nome}</h3>
        <span class="card__price">${formatPrice(p.preco)}</span>
        <button class="card__btn" onclick="addToCart(${p.id})">Adicionar ao carrinho</button>
      </div>
    </article>
  `).join("");
}

function formatPrice(v) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ---------- CARRINHO ---------- */
function saveCart() {
  localStorage.setItem("noir_cart", JSON.stringify(cart));
  renderCart();
}

function addToCart(id) {
  const item = cart.find(i => i.id === id);
  if (item) item.qty += 1;
  else cart.push({ id, qty: 1 });
  saveCart();
  openCart();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
}

function cartTotal() {
  return cart.reduce((sum, i) => {
    const p = allProducts.find(x => x.id === i.id);
    return p ? sum + p.preco * i.qty : sum;
  }, 0);
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = formatPrice(cartTotal());

  const box = document.getElementById("cartItems");
  if (!cart.length) {
    box.innerHTML = `<p class="cart-empty">Seu carrinho está vazio.</p>`;
    return;
  }

  box.innerHTML = cart.map(i => {
    const p = allProducts.find(x => x.id === i.id);
    if (!p) return "";
    return `
      <div class="cart-item">
        <img src="${p.imagem_url || "https://placehold.co/100x120/111111/c9a227?text=N"}" alt="${p.nome}" />
        <div class="cart-item__info">
          <strong>${p.nome}</strong>
          <p>${formatPrice(p.preco)}</p>
        </div>
        <div class="cart-item__qty">
          <button onclick="changeQty(${i.id}, -1)">−</button>
          <span>${i.qty}</span>
          <button onclick="changeQty(${i.id}, 1)">+</button>
        </div>
      </div>`;
  }).join("");
}

/* ---------- DRAWER ---------- */
const drawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("drawerOverlay");

function openCart() { drawer.classList.add("open"); overlay.classList.add("open"); }
function closeCart() { drawer.classList.remove("open"); overlay.classList.remove("open"); }

document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("closeCart").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

/* ---------- CHECKOUT ---------- */
const modal = document.getElementById("checkoutModal");
const orderMsg = document.getElementById("orderMsg");

document.getElementById("checkoutBtn").addEventListener("click", () => {
  if (!cart.length) { alert("Seu carrinho está vazio!"); return; }
  closeCart();
  orderMsg.textContent = "";
  modal.classList.add("open");
});

document.getElementById("closeModal").addEventListener("click", () => modal.classList.remove("open"));

document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = document.getElementById("customerName").value.trim();
  const email = document.getElementById("customerEmail").value.trim();
  const total = cartTotal();

  const itens = cart.map(i => {
    const p = allProducts.find(x => x.id === i.id);
    return { produto_id: i.id, quantidade: i.qty, preco_unitario: p.preco };
  });

  try {
    const { data: pedido, error: pedErr } = await supabaseClient
      .from("pedidos")
      .insert({ cliente_nome: nome, cliente_email: email, total })
      .select()
      .single();

    if (pedErr) throw pedErr;

    const { error: itemErr } = await supabaseClient
      .from("pedido_itens")
      .insert(itens.map(it => ({ ...it, pedido_id: pedido.id })));

    if (itemErr) throw itemErr;

    orderMsg.textContent = `Pedido #${pedido.id} confirmado! Obrigado, ${nome}.`;
    cart = [];
    saveCart();
    e.target.reset();
  } catch (err) {
    orderMsg.textContent = "Erro ao processar o pedido: " + err.message;
    console.error(err);
  }
});

/* ---------- INIT ---------- */
renderCart();
loadProducts();