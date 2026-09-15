/* =====================================================
   pedidos.js  —  Mestre Maro  |  Página de Pedidos
   =====================================================
   INTEGRAÇÃO FIREBASE:
   - Coleção: "produtos"
   - Campos lidos: nome, valorVenda, precoAtacado,
     qtdAtacado, grupo, fotoUrl, idLoja, estoque
   ===================================================== */

// ─────────────────────────────────────────────────────
//  CONFIGURAÇÃO — ajuste conforme sua loja
// ─────────────────────────────────────────────────────
const CONFIG = {
  usarFirebase: true,          // true  → busca do Firestore em tempo real
                                // false → usa PRODUTOS_LOCAL abaixo (para testes)
  mostrarSemEstoque: true,     // false → oculta produtos com estoque 0
};

// ─────────────────────────────────────────────────────
//  DADOS LOCAIS — usados quando CONFIG.usarFirebase = false
//  Formato igual ao Firestore: nome, valorVenda, grupo, fotoUrl, etc.
// ─────────────────────────────────────────────────────
const PRODUTOS_LOCAL = [
  { id:"1",  nome:"WHISKY BLACK&WHITE 1L",              grupo:"Destilados",     valorVenda:75.00,  precoAtacado:72.00, qtdAtacado:6,  fotoUrl:"" },
  { id:"2",  nome:"ABSOLUT VODKA 1L",                   grupo:"Destilados",     valorVenda:89.90,  precoAtacado:85.00, qtdAtacado:6,  fotoUrl:"" },
  { id:"3",  nome:"SMIRNOFF VODKA 1L",                  grupo:"Destilados",     valorVenda:55.00,  precoAtacado:50.00, qtdAtacado:6,  fotoUrl:"" },
  { id:"4",  nome:"REDBULL MELANCIA 250ML",             grupo:"Energéticos",    valorVenda:11.00,  precoAtacado: 9.99, qtdAtacado:4,  fotoUrl:"" },
  { id:"5",  nome:"REDBULL TROPICAL 250ML",             grupo:"Energéticos",    valorVenda:11.00,  precoAtacado: 9.99, qtdAtacado:4,  fotoUrl:"" },
  { id:"6",  nome:"MONSTER ENERGY 473ML",               grupo:"Energéticos",    valorVenda:12.00,  precoAtacado:10.50, qtdAtacado:4,  fotoUrl:"" },
  { id:"7",  nome:"HEINEKEN LATA 350ML",                grupo:"Cervejas",       valorVenda: 7.50,  precoAtacado: 6.50, qtdAtacado:12, fotoUrl:"" },
  { id:"8",  nome:"HEINEKEN LONG NECK 330ML",           grupo:"Cervejas",       valorVenda: 9.00,  precoAtacado: 8.00, qtdAtacado:12, fotoUrl:"" },
  { id:"9",  nome:"SKOL LATA 350ML",                    grupo:"Cervejas",       valorVenda: 5.00,  precoAtacado: 4.50, qtdAtacado:12, fotoUrl:"" },
  { id:"10", nome:"BRAHMA LATA 350ML",                  grupo:"Cervejas",       valorVenda: 5.00,  precoAtacado: 4.50, qtdAtacado:12, fotoUrl:"" },
  { id:"11", nome:"COCA-COLA LATA 350ML",               grupo:"Não Alcoólicos", valorVenda: 6.00,  precoAtacado: 5.50, qtdAtacado:12, fotoUrl:"" },
  { id:"12", nome:"ÁGUA MINERAL 500ML",                 grupo:"Não Alcoólicos", valorVenda: 3.00,  precoAtacado: 2.50, qtdAtacado:12, fotoUrl:"" },
  { id:"13", nome:"PRECIOSA DO VALE FAVO DE MEL 270ML", grupo:"Drinks Prontos", valorVenda: 8.00,  precoAtacado: 6.99, qtdAtacado:6,  fotoUrl:"" },
];

// ─────────────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────────────
const state = {
  produtos: [],       // array carregado (local ou Firebase)
  carrinho: [],       // [{ produto, qty }]
  filtroGrupo: "all",
  termoBusca: "",
};

// ─────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function showToast(msg, duration = 2400) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), duration);
}

// SVG genérico para placeholder de imagem
const PLACEHOLDER_SVG = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;

function thumbHtml(fotoUrl, classes = "") {
  if (fotoUrl) {
    return `<img src="${fotoUrl}" alt="foto" class="${classes}"
              onerror="this.parentElement.innerHTML='${PLACEHOLDER_SVG.replace(/"/g,"'")}'">`;
  }
  return PLACEHOLDER_SVG;
}

// ─────────────────────────────────────────────────────
//  CARGA DE PRODUTOS
// ─────────────────────────────────────────────────────

/**
 * Ponto de entrada principal.
 * Se CONFIG.usarFirebase = true → lê do Firestore em tempo real.
 * Se false → usa PRODUTOS_LOCAL.
 */
async function carregarProdutos() {
  if (CONFIG.usarFirebase) {
    await carregarDoFirebase();
  } else {
    state.produtos = PRODUTOS_LOCAL;
    finalizarCarga();
  }
}

/**
 * FIREBASE — leitura em tempo real (onSnapshot).
 *
 * Campos esperados no documento Firestore:
 *   nome        (string)
 *   valorVenda  (number)
 *   precoAtacado (number, opcional)
 *   qtdAtacado  (number, opcional)
 *   grupo       (string)
 *   fotoUrl     (string, URL pública — Firebase Storage ou externa)
 *   idLoja      (string)
 *   estoque     (number | "none")
 */
function carregarDoFirebase() {
  return new Promise((resolve) => {
    const db = firebase.firestore();
    const idLoja = (() => {
      try { return JSON.parse(localStorage.getItem("selecaoLoja"))?.id || localStorage.getItem("selecaoLoja"); }
      catch { return localStorage.getItem("selecaoLoja"); }
    })();

    db.collection("produtos")
      .orderBy("nome")
      .onSnapshot((snapshot) => {
        state.produtos = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((p) => String(p.idLoja || "").trim() === String(idLoja || "").trim())
          .filter((p) => CONFIG.mostrarSemEstoque || p.estoque === "none" || Number(p.estoque) > 0);

        finalizarCarga();
        resolve();
      });
  });
}

/** Chamado após produtos carregados (local ou Firebase) */
function finalizarCarga() {
  buildGroupFilters();
  document.getElementById("skeletonGrid").style.display = "none";
  document.getElementById("productsGrid").style.display = "grid";
  renderProducts();
}

// ─────────────────────────────────────────────────────
//  FILTROS DE GRUPO
// ─────────────────────────────────────────────────────
function buildGroupFilters() {
  const container = document.getElementById("groupFilters");

  // remove filtros anteriores (exceto "Todos")
  [...container.querySelectorAll(".filter-btn:not([data-group='all'])")].forEach((b) => b.remove());

  const grupos = [...new Set(state.produtos.map((p) => p.grupo).filter(Boolean))].sort();

  grupos.forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.dataset.group = g;
    btn.textContent = g;
    container.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────
//  FILTRAGEM
// ─────────────────────────────────────────────────────
function filteredProducts() {
  return state.produtos.filter((p) => {
    const matchGrupo = state.filtroGrupo === "all" || p.grupo === state.filtroGrupo;
    const matchBusca = (p.nome || "").toLowerCase().includes(state.termoBusca.toLowerCase());
    return matchGrupo && matchBusca;
  });
}

// ─────────────────────────────────────────────────────
//  RENDERIZAÇÃO — PRODUTOS
// ─────────────────────────────────────────────────────
function renderProducts() {
  const grid  = document.getElementById("productsGrid");
  const empty = document.getElementById("emptyState");
  const lista = filteredProducts();

  grid.innerHTML = "";

  if (lista.length === 0) {
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  lista.forEach((prod) => {
    const itemCart = state.carrinho.find((i) => i.produto.id === prod.id);
    const qty      = itemCart ? itemCart.qty : 0;
    const added    = qty > 0;

    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.id = prod.id;

    // ── foto ──
    const imgWrap = document.createElement("div");
    imgWrap.className = "product-img-wrap";
    if (prod.fotoUrl) {
      imgWrap.innerHTML = `<img class="product-img" src="${prod.fotoUrl}" alt="${prod.nome}"
        onerror="this.parentElement.innerHTML='<div class=\\'product-img-placeholder\\'>${PLACEHOLDER_SVG}<span>Sem foto</span></div>'">`;
    } else {
      imgWrap.innerHTML = `<div class="product-img-placeholder">${PLACEHOLDER_SVG}<span>Sem foto</span></div>`;
    }

    // ── body ──
    const body = document.createElement("div");
    body.className = "product-body";
    body.innerHTML = `
      <span class="product-group-tag">${prod.grupo || "Produto"}</span>
      <p class="product-name">${prod.nome}</p>
      <div class="product-price"><small>R$</small>${Number(prod.valorVenda).toFixed(2).replace(".", ",")}</div>
      ${prod.precoAtacado && prod.qtdAtacado
        ? `<p class="product-atacado">A partir de ${prod.qtdAtacado}un: ${fmt(Number(prod.precoAtacado))}</p>`
        : ""}
      <div class="product-actions">
        <div class="qty-controls ${added ? "visible" : ""}" id="qty-${prod.id}">
          <button class="qty-btn" data-action="dec" data-id="${prod.id}">−</button>
          <span class="qty-value" id="qv-${prod.id}">${qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${prod.id}">+</button>
        </div>
        <button class="btn-add ${added ? "added" : ""}" data-id="${prod.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${added
              ? '<polyline points="20 6 9 17 4 12"/>'
              : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
          </svg>
          ${added ? "Adicionado" : "Adicionar"}
        </button>
      </div>`;

    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);
  });

  // ── eventos delegados ──
  grid.querySelectorAll(".btn-add").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(btn.dataset.id))
  );
  grid.querySelectorAll(".qty-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.dataset.action === "inc" ? incrementItem(btn.dataset.id) : decrementItem(btn.dataset.id);
    })
  );
}

// ─────────────────────────────────────────────────────
//  CARRINHO — OPERAÇÕES
// ─────────────────────────────────────────────────────
function addToCart(id) {
  const prod = state.produtos.find((p) => p.id === id);
  if (!prod) return;

  const existing = state.carrinho.find((i) => i.produto.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.carrinho.push({ produto: prod, qty: 1 });
  }

  const nomeResumido = prod.nome.split(" ").slice(0, 3).join(" ");
  showToast(`✓ ${nomeResumido} adicionado`);
  renderProducts();
  renderCart();
}

function incrementItem(id) {
  const item = state.carrinho.find((i) => i.produto.id === id);
  if (item) { item.qty += 1; renderProducts(); renderCart(); }
}

function decrementItem(id) {
  const idx = state.carrinho.findIndex((i) => i.produto.id === id);
  if (idx === -1) return;
  state.carrinho[idx].qty -= 1;
  if (state.carrinho[idx].qty <= 0) state.carrinho.splice(idx, 1);
  renderProducts();
  renderCart();
}

// ─────────────────────────────────────────────────────
//  RENDERIZAÇÃO — CARRINHO
// ─────────────────────────────────────────────────────
const calcTotal = () => state.carrinho.reduce((acc, i) => acc + Number(i.produto.valorVenda) * i.qty, 0);

function renderCart() {
  const cartItems  = document.getElementById("cartItems");
  const cartEmpty  = document.getElementById("cartEmpty");
  const cartFooter = document.getElementById("cartFooter");
  const cartCount  = document.getElementById("cartCount");
  const badge      = document.getElementById("cartBadge");
  const totalQty   = state.carrinho.reduce((acc, i) => acc + i.qty, 0);
  const totalVal   = calcTotal();

  badge.textContent = totalQty;
  badge.classList.toggle("visible", totalQty > 0);
  cartCount.textContent = `${totalQty} ${totalQty === 1 ? "item" : "itens"}`;

  // remove itens anteriores (mantém cart-empty)
  [...cartItems.children].forEach((el) => { if (!el.classList.contains("cart-empty")) el.remove(); });

  if (state.carrinho.length === 0) {
    cartEmpty.style.display  = "flex";
    cartFooter.style.display = "none";
    return;
  }

  cartEmpty.style.display  = "none";
  cartFooter.style.display = "flex";

  state.carrinho.forEach((item) => {
    const el = document.createElement("div");
    el.className = "cart-item";

    el.innerHTML = `
      <div class="cart-item-thumb">
        ${item.produto.fotoUrl
          ? `<img src="${item.produto.fotoUrl}" alt="${item.produto.nome}"
               onerror="this.parentElement.innerHTML='<div class=\\'cart-item-thumb-placeholder\\'>${PLACEHOLDER_SVG.replace(/"/g,"'")}</div>'">`
          : `<div class="cart-item-thumb-placeholder">${PLACEHOLDER_SVG}</div>`}
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name" title="${item.produto.nome}">${item.produto.nome}</p>
        <p class="cart-item-price">${fmt(Number(item.produto.valorVenda) * item.qty)}</p>
      </div>
      <div class="cart-item-controls">
        <button class="cart-qty-btn remove" data-id="${item.produto.id}" data-action="dec">−</button>
        <span class="cart-qty-num">${item.qty}</span>
        <button class="cart-qty-btn" data-id="${item.produto.id}" data-action="inc">+</button>
      </div>`;

    cartItems.appendChild(el);
  });

  cartItems.querySelectorAll(".cart-qty-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.dataset.action === "inc" ? incrementItem(btn.dataset.id) : decrementItem(btn.dataset.id);
    })
  );

  document.getElementById("subtotalValue").textContent = fmt(totalVal);
  document.getElementById("totalValue").textContent    = fmt(totalVal);
}

// ─────────────────────────────────────────────────────
//  MODAL DE CONFIRMAÇÃO
// ─────────────────────────────────────────────────────
function openConfirmModal() {
  if (state.carrinho.length === 0) { showToast("Seu carrinho está vazio!"); return; }

  const modalItems = document.getElementById("modalItems");
  modalItems.innerHTML = "";

  state.carrinho.forEach((item) => {
    const el = document.createElement("div");
    el.className = "modal-item";
    el.innerHTML = `
      <div class="modal-item-thumb">
        ${item.produto.fotoUrl
          ? `<img src="${item.produto.fotoUrl}" alt="${item.produto.nome}"
               onerror="this.parentElement.innerHTML='<div class=\\'modal-item-thumb-placeholder\\'>${PLACEHOLDER_SVG.replace(/"/g,"'")}</div>'">`
          : `<div class="modal-item-thumb-placeholder">${PLACEHOLDER_SVG}</div>`}
      </div>
      <div class="modal-item-info">
        <p class="modal-item-name">${item.produto.nome}</p>
        <p class="modal-item-qty">x${item.qty} — ${fmt(Number(item.produto.valorVenda))}/un</p>
      </div>
      <span class="modal-item-price">${fmt(Number(item.produto.valorVenda) * item.qty)}</span>`;
    modalItems.appendChild(el);
  });

  document.getElementById("modalTotal").textContent = fmt(calcTotal());
  document.getElementById("modalBackdrop").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalBackdrop").style.display = "none";
}

/**
 * CONFIRMAR PEDIDO
 * O objeto `pedido` está pronto para ser enviado ao Firebase,
 * Telegram, ou qualquer outra integração.
 */
function confirmarPedido() {
  const pedido = {
    id:     `PED-${Date.now()}`,
    status: "pendente",
    data:   new Date().toISOString(),
    total:  calcTotal(),
    itens:  state.carrinho.map((i) => ({
      produtoId:  i.produto.id,
      nome:       i.produto.nome,
      fotoUrl:    i.produto.fotoUrl || "",
      qty:        i.qty,
      precoUnit:  Number(i.produto.valorVenda),
      subtotal:   Number(i.produto.valorVenda) * i.qty,
    })),
  };

  console.log("[Mestre Maro] Pedido:", pedido);

  // ── Aqui você conecta com o sistema: ──────────────────
  // salvarPedidoFirestore(pedido);   // salva no Firestore
  // enviarPedidoTelegram(pedido);    // notifica no Telegram
  // ──────────────────────────────────────────────────────

  state.carrinho = [];
  closeModal();
  closeMobileCart();
  renderProducts();
  renderCart();
  showToast("🎉 Pedido realizado com sucesso!", 3200);
}

// ─────────────────────────────────────────────────────
//  CART MOBILE
// ─────────────────────────────────────────────────────
function openMobileCart()  {
  document.getElementById("cartSidebar").classList.add("open");
  document.getElementById("cartOverlay").classList.add("visible");
  document.body.style.overflow = "hidden";
}
function closeMobileCart() {
  document.getElementById("cartSidebar").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("visible");
  document.body.style.overflow = "";
}

// ─────────────────────────────────────────────────────
//  INICIALIZAÇÃO
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // Carga dos produtos
  carregarProdutos();

  // Busca
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.termoBusca = e.target.value;
    renderProducts();
  });

  // Filtros de grupo (delegação — botões criados dinamicamente)
  document.getElementById("groupFilters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.filtroGrupo = btn.dataset.group;
    renderProducts();
  });

  // Cart mobile
  document.getElementById("cartToggle").addEventListener("click", openMobileCart);
  document.getElementById("cartOverlay").addEventListener("click", closeMobileCart);

  // Checkout
  document.getElementById("btnCheckout").addEventListener("click", openConfirmModal);
  document.getElementById("btnCancel").addEventListener("click", closeModal);
  document.getElementById("btnConfirm").addEventListener("click", confirmarPedido);

  // Fechar modal clicando fora
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
});