/* =====================================================
   delivery.js  —  Mestre Maro  |  Cardápio Público (Delivery)
   =====================================================
   Arquivo EXCLUSIVO da página delivery.html — cliente final,
   sem login. Não confundir com um futuro pedidos.js interno
   (ex: tela de admin/caixa pra gerenciar pedidos já feitos).
   =====================================================
   COMO FUNCIONA A LOJA NESSA PÁGINA:
   - A loja NÃO vem mais do localStorage.
   - A loja vem de um parâmetro na URL: ?loja=ID_DA_LOJA
   - Exemplo de link pra mandar pro cliente:
       https://seudominio.com/delivery.html?loja=LOJA_001
   - Pra testar localmente, é só abrir o arquivo com o
     parâmetro na barra de endereço, ex:
       delivery.html?loja=LOJA_001

   INTEGRAÇÃO FIREBASE:
   - Coleção "lojas"    → valida se a loja existe e pega o nome dela
   - Coleção "produtos" → lê os produtos, filtrando por idLoja
     Campos lidos: nome, valorVenda, precoAtacado,
     qtdAtacado, grupo, fotoUrl, idLoja, estoque

   STATUS DO CHECKOUT (proposital, fase de testes):
   - Ao confirmar o pedido, NÃO grava nada no Firestore ainda.
   - Só monta o objeto do pedido, loga no console e mostra um
     alert() de sucesso — pra você validar o fluxo completo
     (loja certa → produtos certos → carrinho → confirmação)
     antes de plugar a gravação de verdade.
   ===================================================== */

// ─────────────────────────────────────────────────────
//  CONFIGURAÇÃO — ajuste conforme sua loja
// ─────────────────────────────────────────────────────
const CONFIG = {
  usarFirebase: true,          // true  → busca do Firestore em tempo real
                                // false → usa PRODUTOS_LOCAL abaixo (para testes sem Firebase)
  mostrarSemEstoque: true,     // false → oculta produtos com estoque 0
  taxaEntrega: 5.00,           // valor fixo da entrega, somado ao total do pedido

  // Usado só se a loja (Firestore) não tiver "taxas.credito"/"taxas.debito"
  // configurados ainda (aba "Editar taxas" em loja.js). Com a loja
  // configurada, a taxa REAL dela é usada — não esse valor.
  taxaCartaoFallback: 0.03,
};

// ─────────────────────────────────────────────────────
//  DADOS LOCAIS — usados quando CONFIG.usarFirebase = false
// ─────────────────────────────────────────────────────
const PRODUTOS_LOCAL = [
  { id:"1",  nome:"WHISKY BLACK&WHITE 1L",              grupo:"Destilados",     valorVenda:75.00,  precoAtacado:72.00, qtdAtacado:6,  fotoUrl:"", idLoja:"LOJA_001" },
  { id:"2",  nome:"ABSOLUT VODKA 1L",                   grupo:"Destilados",     valorVenda:89.90,  precoAtacado:85.00, qtdAtacado:6,  fotoUrl:"", idLoja:"LOJA_001" },
  { id:"7",  nome:"HEINEKEN LATA 350ML",                grupo:"Cervejas",       valorVenda: 7.50,  precoAtacado: 6.50, qtdAtacado:12, fotoUrl:"", idLoja:"LOJA_001" },
  { id:"11", nome:"COCA-COLA LATA 350ML",               grupo:"Não Alcoólicos", valorVenda: 6.00,  precoAtacado: 5.50, qtdAtacado:12, fotoUrl:"", idLoja:"LOJA_001" },
];

// ─────────────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────────────
const state = {
  idLoja: null,        // preenchido a partir da URL (?loja=...)
  nomeLoja: "",         // nome da loja, pra exibir no cabeçalho
  taxasLoja: {},         // { credito: 0.0X, debito: 0.0X } — vem do Firestore, igual o PDV usa
  produtos: [],
  carrinho: [],
  filtroGrupo: "all",
  termoBusca: "",
  cliente: {            // preenchido no modal de dados do cliente
    nome: "",
    telefone: "",
    endereco: "",
    referencia: "",
    observacoes: "",
  },
  pagamento: {          // preenchido no modal de forma de pagamento
    metodo: null,        // "PIX" | "CARTAO" | "DINHEIRO"
    tipoCartao: null,    // "DEBITO" | "CREDITO" — só quando metodo === "CARTAO"
    semTroco: false,      // true = vai pagar com valor exato
    trocoPara: null,      // ex: 50 → vai pagar com nota de R$50 (troco = 50 - total)
  },
};

// ─────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Quantas unidades ainda dá pra vender desse produto.
 * "none" (ou sem o campo) = estoque não controlado, sem limite —
 * mesmo padrão usado no resto do sistema (ver atualizarEstoque no pdv.js).
 */
function estoqueDisponivel(produto) {
  if (produto.estoque === "none" || produto.estoque == null || produto.estoque === "") return Infinity;
  const num = Number(produto.estoque);
  return isNaN(num) ? Infinity : num;
}

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

// ─────────────────────────────────────────────────────
//  LOJA — vem da URL, não mais do localStorage
// ─────────────────────────────────────────────────────

/** Lê ?loja=XXXX da URL atual */
function getLojaIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("loja");
  return id ? id.trim() : null;
}

/** Mostra a tela de erro (sem loja / loja inexistente) e esconde o cardápio */
function mostrarErroDeLoja(mensagem) {
  document.getElementById("storeErrorMsg").textContent = mensagem;
  document.getElementById("storeErrorState").style.display = "flex";
  document.getElementById("cardapioContent").style.display = "none";
}

/**
 * Valida a loja da URL contra a coleção "lojas".
 * Retorna true se a loja existe (e já preenche state.nomeLoja),
 * false caso contrário.
 */
async function validarLoja(idLoja) {
  try {
    const db = firebase.firestore();
    const snapshot = await db.collection("lojas").where("id", "==", idLoja).limit(1).get();

    if (snapshot.empty) return false;

    const dadosLoja = snapshot.docs[0].data();
    state.nomeLoja = dadosLoja.nome || "";
    // mesmas taxas configuradas em loja.js (Editar taxas) e usadas pelo PDV —
    // { credito: 0.0X, debito: 0.0X, ifood: 0.0X }. Usamos elas aqui também,
    // pra bater exatamente com o que o financeiro.js espera em meio.taxa.
    state.taxasLoja = dadosLoja.taxas || {};
    return true;
  } catch (error) {
    console.error("[Mestre Maro] Erro ao validar loja:", error);
    return false;
  }
}

/** Atualiza o cabeçalho com o nome da loja carregada */
function aplicarCabecalhoDaLoja() {
  if (!state.nomeLoja) return;
  document.getElementById("headerTag").textContent = state.nomeLoja;
}

// ─────────────────────────────────────────────────────
//  CARGA DE PRODUTOS
// ─────────────────────────────────────────────────────

async function carregarProdutos() {
  if (CONFIG.usarFirebase) {
    await carregarDoFirebase();
  } else {
    state.produtos = PRODUTOS_LOCAL.filter(
      (p) => String(p.idLoja || "").trim() === String(state.idLoja || "").trim()
    );
    finalizarCarga();
  }
}

/**
 * FIREBASE — leitura em tempo real (onSnapshot), filtrando
 * sempre por state.idLoja (vindo da URL).
 */
function carregarDoFirebase() {
  return new Promise((resolve) => {
    const db = firebase.firestore();

    db.collection("produtos")
      .orderBy("nome")
      .onSnapshot((snapshot) => {
        state.produtos = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((p) => String(p.idLoja || "").trim() === String(state.idLoja || "").trim())
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

    const disponivel    = estoqueDisponivel(prod);
    const esgotado       = disponivel <= 0;

    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.id = prod.id;

    const imgWrap = document.createElement("div");
    imgWrap.className = "product-img-wrap";
    if (prod.fotoUrl) {
      imgWrap.innerHTML = `<img class="product-img" src="${prod.fotoUrl}" alt="${prod.nome}"
        onerror="this.parentElement.innerHTML='<div class=\\'product-img-placeholder\\'>${PLACEHOLDER_SVG}<span>Sem foto</span></div>'">`;
    } else {
      imgWrap.innerHTML = `<div class="product-img-placeholder">${PLACEHOLDER_SVG}<span>Sem foto</span></div>`;
    }

    const body = document.createElement("div");
    body.className = "product-body";
    body.innerHTML = `
      <span class="product-group-tag">${prod.grupo || "Produto"}</span>
      <p class="product-name">${prod.nome}</p>
      <div class="product-price"><small>R$</small>${Number(prod.valorVenda).toFixed(2).replace(".", ",")}</div>
      ${prod.precoAtacado && prod.qtdAtacado
        ? `<p class="product-atacado">A partir de ${prod.qtdAtacado}un: ${fmt(Number(prod.precoAtacado))}</p>`
        : ""}
      ${esgotado ? `<p class="product-esgotado">Esgotado</p>` : ""}
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
          ${esgotado ? "Esgotado" : (added ? "Adicionado" : "Adicionar")}
        </button>
      </div>`;

    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);
  });

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

  const existing  = state.carrinho.find((i) => i.produto.id === id);
  const qtyAtual  = existing ? existing.qty : 0;
  const disponivel = estoqueDisponivel(prod);

  if (qtyAtual + 1 > disponivel) {
    const nomeResumido = prod.nome.split(" ").slice(0, 3).join(" ");
    showToast(
      disponivel <= 0
        ? `😕 ${nomeResumido} está sem estoque no momento`
        : `Você já tem todo o estoque disponível de ${nomeResumido} no carrinho (${disponivel} un.)`,
      3200
    );
    return;
  }

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
  if (!item) return;

  const disponivel = estoqueDisponivel(item.produto);
  if (item.qty + 1 > disponivel) {
    const nomeResumido = item.produto.nome.split(" ").slice(0, 3).join(" ");
    showToast(`Você já tem todo o estoque disponível de ${nomeResumido} no carrinho (${disponivel} un.)`, 3200);
    return;
  }

  item.qty += 1;
  renderProducts();
  renderCart();
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
const calcSubtotal = () => state.carrinho.reduce((acc, i) => acc + Number(i.produto.valorVenda) * i.qty, 0);
const calcTotal    = () => calcSubtotal() + CONFIG.taxaEntrega;

/**
 * Taxa (fração, ex: 0.035) configurada de verdade pra essa loja, pro
 * tipo de cartão escolhido — mesma fonte que o PDV usa
 * (loja.taxas.credito / loja.taxas.debito, editável em "Editar taxas").
 * Retorna 0 se o método não é cartão ou o tipo ainda não foi escolhido.
 */
function taxaPercentualCartao() {
  if (state.pagamento.metodo !== "CARTAO" || !state.pagamento.tipoCartao) return 0;

  const chave = state.pagamento.tipoCartao === "CREDITO" ? "credito" : "debito";
  const taxaDaLoja = state.taxasLoja[chave];

  return taxaDaLoja != null ? Number(taxaDaLoja) : CONFIG.taxaCartaoFallback;
}

// arredondado pra centavos, pra não sujar o valor salvo com
// imprecisão de ponto flutuante (ex: 0.44999999999999996)
const calcTaxaCartao = () => Math.round(calcTotal() * taxaPercentualCartao() * 100) / 100;
const calcTotalFinal = () => Math.round((calcTotal() + calcTaxaCartao()) * 100) / 100;

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

  document.getElementById("subtotalValue").textContent    = fmt(calcSubtotal());
  document.getElementById("deliveryFeeValue").textContent = fmt(CONFIG.taxaEntrega);
  document.getElementById("totalValue").textContent       = fmt(totalVal);
}

// ─────────────────────────────────────────────────────
//  MODAL DE DADOS DO CLIENTE
// ─────────────────────────────────────────────────────
function openCustomerModal() {
  if (state.carrinho.length === 0) { showToast("Seu carrinho está vazio!"); return; }

  // pré-preenche com o que já foi digitado antes (se o cliente voltou pra editar)
  document.getElementById("custNome").value        = state.cliente.nome;
  document.getElementById("custTelefone").value     = state.cliente.telefone;
  document.getElementById("custEndereco").value      = state.cliente.endereco;
  document.getElementById("custReferencia").value    = state.cliente.referencia;
  document.getElementById("custObservacoes").value   = state.cliente.observacoes;

  // limpa erros de validação de uma tentativa anterior
  ["fieldNome", "fieldTelefone", "fieldEndereco"].forEach((id) =>
    document.getElementById(id).classList.remove("invalid")
  );

  document.getElementById("customerModalBackdrop").style.display = "flex";
}

function closeCustomerModal() {
  document.getElementById("customerModalBackdrop").style.display = "none";
}

/** Valida os campos obrigatórios (nome, telefone, endereço). Marca visualmente os inválidos. */
function validarDadosCliente() {
  const nome      = document.getElementById("custNome").value.trim();
  const telefone  = document.getElementById("custTelefone").value.trim();
  const endereco  = document.getElementById("custEndereco").value.trim();

  let valido = true;

  const marcar = (fieldId, ok) => {
    document.getElementById(fieldId).classList.toggle("invalid", !ok);
    if (!ok) valido = false;
  };

  marcar("fieldNome", nome.length > 0);
  marcar("fieldTelefone", telefone.length >= 8);
  marcar("fieldEndereco", endereco.length > 0);

  return valido;
}

/** Chamado quando o cliente clica "Continuar" no modal de dados */
function confirmarDadosCliente() {
  if (!validarDadosCliente()) return;

  state.cliente = {
    nome:        document.getElementById("custNome").value.trim(),
    telefone:    document.getElementById("custTelefone").value.trim(),
    endereco:    document.getElementById("custEndereco").value.trim(),
    referencia:  document.getElementById("custReferencia").value.trim(),
    observacoes: document.getElementById("custObservacoes").value.trim(),
  };

  closeCustomerModal();
  openPaymentModal();
}

/** Preenche o resumo do cliente dentro do modal de revisão do pedido */
function renderCustomerSummary() {
  const el = document.getElementById("modalCustomerSummary");
  const c  = state.cliente;

  el.innerHTML = `
    <div><strong>${c.nome}</strong> — ${c.telefone}</div>
    <div>${c.endereco}${c.referencia ? ` (${c.referencia})` : ""}</div>
    ${c.observacoes ? `<div class="summary-obs">"${c.observacoes}"</div>` : ""}
  `;
}

// ─────────────────────────────────────────────────────
//  MODAL DE FORMA DE PAGAMENTO
// ─────────────────────────────────────────────────────
function openPaymentModal() {
  document.getElementById("paySummarySubtotal").textContent = fmt(calcSubtotal());
  document.getElementById("paySummaryFee").textContent      = fmt(CONFIG.taxaEntrega);

  // reflete a seleção anterior (se o cliente voltou pra editar)
  document.querySelectorAll(".payment-method-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.method === state.pagamento.metodo)
  );
  document.getElementById("paymentPixSection").style.display  = state.pagamento.metodo === "PIX" ? "flex" : "none";
  document.getElementById("paymentCardSection").style.display = state.pagamento.metodo === "CARTAO" ? "flex" : "none";
  document.getElementById("paymentTrocoSection").style.display = state.pagamento.metodo === "DINHEIRO" ? "flex" : "none";

  document.querySelectorAll("#cardTypeGrid .troco-quick-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.cardtype === state.pagamento.tipoCartao)
  );
  document.querySelectorAll("#paymentTrocoSection .troco-quick-btn").forEach((btn) =>
    btn.classList.toggle("active", !state.pagamento.semTroco && Number(btn.dataset.troco) === state.pagamento.trocoPara)
  );
  document.getElementById("trocoCustomInput").value =
    state.pagamento.trocoPara && ![0, 50, 100].includes(state.pagamento.trocoPara)
      ? state.pagamento.trocoPara
      : "";

  document.getElementById("paymentMethodError").style.display = "none";
  document.getElementById("cardTypeError").style.display = "none";
  document.getElementById("trocoError").style.display = "none";

  atualizarResumoPagamento();

  document.getElementById("paymentModalBackdrop").style.display = "flex";
}

/** Recalcula e mostra o total no resumo, com a taxa real da loja quando é cartão */
function atualizarResumoPagamento() {
  const percentual = taxaPercentualCartao();
  const taxaCartao = calcTaxaCartao();

  document.getElementById("paySummaryCardFeeRow").style.display = taxaCartao > 0 ? "flex" : "none";
  document.getElementById("paySummaryCardFeeLabel").textContent =
    `Acréscimo cartão (${(percentual * 100).toFixed(1).replace(".0", "")}%)`;
  document.getElementById("paySummaryCardFee").textContent = fmt(taxaCartao);
  document.getElementById("paySummaryTotal").textContent   = fmt(calcTotalFinal());
}

function closePaymentModal() {
  document.getElementById("paymentModalBackdrop").style.display = "none";
}

function selecionarMetodoPagamento(metodo) {
  state.pagamento.metodo = metodo;
  document.querySelectorAll(".payment-method-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.method === metodo)
  );
  document.getElementById("paymentMethodError").style.display = "none";

  document.getElementById("paymentPixSection").style.display  = metodo === "PIX" ? "flex" : "none";
  document.getElementById("paymentCardSection").style.display = metodo === "CARTAO" ? "flex" : "none";
  if (metodo !== "CARTAO") {
    state.pagamento.tipoCartao = null;
    document.querySelectorAll("#cardTypeGrid .troco-quick-btn").forEach((btn) => btn.classList.remove("active"));
  }

  const secaoTroco = document.getElementById("paymentTrocoSection");
  if (metodo === "DINHEIRO") {
    secaoTroco.style.display = "flex";
  } else {
    secaoTroco.style.display = "none";
    state.pagamento.semTroco  = false;
    state.pagamento.trocoPara = null;
  }

  atualizarResumoPagamento();
}

function selecionarTipoCartao(tipo) {
  state.pagamento.tipoCartao = tipo;
  document.querySelectorAll("#cardTypeGrid .troco-quick-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.cardtype === tipo)
  );
  document.getElementById("cardTypeError").style.display = "none";
  atualizarResumoPagamento(); // a taxa (débito x crédito) muda o total
}

function selecionarTrocoRapido(valor) {
  state.pagamento.semTroco  = valor === 0;
  state.pagamento.trocoPara = valor === 0 ? null : valor;
  document.getElementById("trocoCustomInput").value = "";
  document.querySelectorAll("#paymentTrocoSection .troco-quick-btn").forEach((btn) =>
    btn.classList.toggle("active", Number(btn.dataset.troco) === valor)
  );
  document.getElementById("trocoError").style.display = "none";
}

function alterarTrocoCustom(valorDigitado) {
  const num = Number(valorDigitado.replace(",", "."));
  document.querySelectorAll("#paymentTrocoSection .troco-quick-btn").forEach((btn) => btn.classList.remove("active"));

  if (valorDigitado.trim() === "" || isNaN(num)) {
    state.pagamento.semTroco  = false;
    state.pagamento.trocoPara = null;
    return;
  }
  state.pagamento.semTroco  = false;
  state.pagamento.trocoPara = num;
  document.getElementById("trocoError").style.display = "none";
}

/** Valida a forma de pagamento escolhida. Retorna true/false. */
function validarPagamento() {
  let valido = true;

  if (!state.pagamento.metodo) {
    document.getElementById("paymentMethodError").style.display = "block";
    valido = false;
  } else {
    document.getElementById("paymentMethodError").style.display = "none";
  }

  if (state.pagamento.metodo === "CARTAO") {
    const tipoOk = !!state.pagamento.tipoCartao;
    document.getElementById("cardTypeError").style.display = tipoOk ? "none" : "block";
    if (!tipoOk) valido = false;
  }

  if (state.pagamento.metodo === "DINHEIRO") {
    const trocoOk = state.pagamento.semTroco || (state.pagamento.trocoPara && state.pagamento.trocoPara > 0);
    document.getElementById("trocoError").style.display = trocoOk ? "none" : "block";
    if (!trocoOk) valido = false;
  }

  return valido;
}

/** Chamado quando o cliente clica "Continuar" no modal de pagamento */
function confirmarFormaPagamento() {
  if (!validarPagamento()) return;
  closePaymentModal();
  openConfirmModal();
}

/** Texto amigável da forma de pagamento escolhida, pra mostrar no modal de revisão */
function renderPaymentSummary() {
  const el = document.getElementById("modalPaymentSummary");
  const p  = state.pagamento;
  const nomes = { PIX: "Pix (na entrega)", CARTAO: "Cartão", DINHEIRO: "Dinheiro" };

  let detalhe = "";
  if (p.metodo === "DINHEIRO") {
    detalhe = p.semTroco
      ? " — sem troco (valor exato)"
      : ` — troco para ${fmt(p.trocoPara)}`;
  }
  if (p.metodo === "CARTAO") {
    const nomesCartao = { DEBITO: "Débito", CREDITO: "Crédito" };
    const percentual = (taxaPercentualCartao() * 100).toFixed(1).replace(".0", "");
    detalhe = ` — ${nomesCartao[p.tipoCartao] || ""} (na entrega, +${percentual}%)`;
  }

  el.innerHTML = `<div><strong>Pagamento:</strong> ${nomes[p.metodo] || "-"}${detalhe}</div>`;
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

  // linha da taxa de entrega, junto com os itens
  const taxaEl = document.createElement("div");
  taxaEl.className = "modal-item";
  taxaEl.innerHTML = `
    <div class="modal-item-thumb"><div class="modal-item-thumb-placeholder">🛵</div></div>
    <div class="modal-item-info">
      <p class="modal-item-name">Taxa de Entrega</p>
    </div>
    <span class="modal-item-price">${fmt(CONFIG.taxaEntrega)}</span>`;
  modalItems.appendChild(taxaEl);

  // linha do acréscimo de cartão (só aparece quando o método é cartão)
  const taxaCartao = calcTaxaCartao();
  if (taxaCartao > 0) {
    const cartaoEl = document.createElement("div");
    cartaoEl.className = "modal-item";
    cartaoEl.innerHTML = `
      <div class="modal-item-thumb"><div class="modal-item-thumb-placeholder">💳</div></div>
      <div class="modal-item-info">
        <p class="modal-item-name">Acréscimo Cartão (${(taxaPercentualCartao() * 100).toFixed(1).replace(".0", "")}%)</p>
      </div>
      <span class="modal-item-price">${fmt(taxaCartao)}</span>`;
    modalItems.appendChild(cartaoEl);
  }

  document.getElementById("modalTotal").textContent = fmt(calcTotalFinal());
  renderCustomerSummary();
  renderPaymentSummary();
  document.getElementById("modalBackdrop").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalBackdrop").style.display = "none";
}

// ─────────────────────────────────────────────────────
//  MINI CADASTRO DO CLIENTE — por telefone, sem senha/login
// ─────────────────────────────────────────────────────

/** Deixa só os dígitos — usado como chave de busca/gravação */
function normalizarTelefone(telefone) {
  return (telefone || "").replace(/\D/g, "");
}

/** ID do doc em "clientesDelivery": uma chave só, sem precisar de query */
function idClienteDelivery(idLoja, telefone) {
  return `${idLoja}_${normalizarTelefone(telefone)}`;
}

/** Busca um cliente já cadastrado dessa loja pelo telefone. null se não achar. */
async function buscarClientePorTelefone(telefone) {
  const tel = normalizarTelefone(telefone);
  if (tel.length < 8) return null;

  try {
    const doc = await firebase.firestore()
      .collection("clientesDelivery")
      .doc(idClienteDelivery(state.idLoja, tel))
      .get();
    return doc.exists ? doc.data() : null;
  } catch (erro) {
    console.error("[Mestre Maro] Erro ao buscar cliente pelo telefone:", erro);
    return null;
  }
}

/** Salva/atualiza os dados do cliente, pra não precisar digitar de novo da próxima vez */
async function salvarClienteDelivery(cliente) {
  const tel = normalizarTelefone(cliente.telefone);
  if (tel.length < 8) return;

  try {
    await firebase.firestore()
      .collection("clientesDelivery")
      .doc(idClienteDelivery(state.idLoja, tel))
      .set({
        idLoja:               state.idLoja,
        telefone:             cliente.telefone,
        telefoneNormalizado:  tel,
        nome:                 cliente.nome,
        endereco:             cliente.endereco,
        referencia:           cliente.referencia || "",
        atualizadoEm:         firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
  } catch (erro) {
    console.error("[Mestre Maro] Erro ao salvar cliente:", erro);
  }
}

/** Ao sair do campo telefone, se achar cadastro anterior, preenche nome/endereço sozinho */
async function handleTelefoneBlurAutofill() {
  const nomeVazio     = document.getElementById("custNome").value.trim() === "";
  const enderecoVazio = document.getElementById("custEndereco").value.trim() === "";
  if (!nomeVazio && !enderecoVazio) return; // já preenchido — não sobrescreve o que a pessoa digitou

  const telefone = document.getElementById("custTelefone").value.trim();
  const cliente   = await buscarClientePorTelefone(telefone);
  if (!cliente) return;

  if (nomeVazio)     document.getElementById("custNome").value = cliente.nome || "";
  if (enderecoVazio) document.getElementById("custEndereco").value = cliente.endereco || "";
  if (!document.getElementById("custReferencia").value.trim()) {
    document.getElementById("custReferencia").value = cliente.referencia || "";
  }

  showToast(`Bem-vindo de volta, ${(cliente.nome || "").split(" ")[0]}!`);
}

/**
 * GERA ID DE VENDA — mesmo padrão usado no pdv.js
 */
function gerarIdVenda() {
  return crypto?.randomUUID?.() ?? "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

/**
 * Monta o objeto `venda` no MESMO FORMATO que o pdv.js grava na
 * coleção "vendas" (produtos, meiosPagamento, totalVenda, idLoja...).
 */
function montarObjetoVenda() {
  const agora = new Date();
  const [dataStr, horaStr] = agora.toLocaleString("pt-BR").split(",");

  const produtosVenda = state.carrinho.map((item) => ({
    nome:          item.produto.nome,
    quantidade:    item.qty,
    valorUnitario: Number(item.produto.valorVenda),
    valorTotal:    Number(item.produto.valorVenda) * item.qty,
    valorDeCusto:  Number(item.produto.valorCompra || 0),
    id:            item.produto.id,
  }));

  // taxa de entrega entra como se fosse mais um item da venda
  produtosVenda.push({
    nome:          "Taxa de Entrega",
    quantidade:    1,
    valorUnitario: CONFIG.taxaEntrega,
    valorTotal:    CONFIG.taxaEntrega,
    valorDeCusto:  0,
    id:            "taxa-entrega",
  });

  // Precisa ser EXATAMENTE igual ao data-tipo usado no PDV (home.html):
  // "DINHEIRO", "PIX", "DEBITO", "CREDITO" — é essa string que alimenta
  // o Resumo do Caixa, o financeiro.js e o agrupamento por meio de
  // pagamento. Nada de texto extra tipo "(na entrega)" aqui.
  const tipoPagamentoFinal =
    state.pagamento.metodo === "CARTAO" ? state.pagamento.tipoCartao : state.pagamento.metodo;

  // meio de pagamento, no mesmo formato usado em vendaAtual.meiosPagamento no PDV
  const meioPagamento = {
    tipoPagamento: tipoPagamentoFinal, // "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO"
    valor:         calcTotalFinal(),
    taxa:          calcTaxaCartao(), // taxa real da loja (débito/crédito), 0 nos outros métodos
  };
  if (state.pagamento.metodo === "DINHEIRO" && !state.pagamento.semTroco) {
    meioPagamento.trocoPara = state.pagamento.trocoPara; // nota que o cliente vai usar pra pagar
  }

  return {
    data:            dataStr.trim(),
    hora:            horaStr.trim(),
    idLoja:          state.idLoja,
    idVenda:         gerarIdVenda(),
    idCaixa:         null,          // não passou pelo caixa físico
    origem:          "delivery",     // diferencia de venda feita no PDV
    meiosPagamento:  [meioPagamento],
    produtos:        produtosVenda,
    totalVenda:      calcTotalFinal(),
    cliente:         state.cliente.nome,
    clienteDetalhes: { ...state.cliente }, // telefone, endereço, referência, observações
  };
}

// (A baixa de estoque não acontece mais aqui — só vai acontecer quando o
// pedido for FINALIZADO pela loja, lá no Kanban. Isso ainda não existe
// nessa parte; entra numa etapa futura.)

/**
 * CONFIRMAR PEDIDO
 *
 * Sem gateway de pagamento por enquanto: Pix e Cartão são pagos na
 * entrega, na maquininha; Dinheiro com troco combinado. O sistema só
 * registra o pedido — não processa pagamento nenhum.
 *
 * NÃO grava direto em "vendas" — grava em "pedidosDelivery" com
 * status "ENVIADO". A loja confirma (isso ainda vai ser feito no
 * popup do home.js, numa próxima etapa) antes de virar venda de
 * verdade.
 */
async function confirmarPedido() {
  const btnConfirm = document.getElementById("btnConfirm");

  // Revalida o estoque agora — pode ter mudado desde que o item foi
  // adicionado ao carrinho (outro cliente comprou o último, etc.)
  for (const item of state.carrinho) {
    const produtoAtual = state.produtos.find((p) => p.id === item.produto.id) || item.produto;
    const disponivel   = estoqueDisponivel(produtoAtual);
    if (item.qty > disponivel) {
      Swal.fire({
        heightAuto: false,
        icon: "warning",
        title: "Estoque mudou",
        text: disponivel <= 0
          ? `${produtoAtual.nome} acabou de esgotar. Remova do carrinho pra continuar.`
          : `Só sobrou ${disponivel} unidade(s) de ${produtoAtual.nome}. Ajuste a quantidade no carrinho.`,
      });
      return;
    }
  }

  const venda = montarObjetoVenda();

  btnConfirm.disabled = true;
  btnConfirm.textContent = "Enviando pedido...";

  try {
    const db = firebase.firestore();

    // Vira um "pedido" (não uma venda ainda!) — só quando a loja
    // marcar como FINALIZADO (etapa futura) é que isso vira venda de
    // verdade, entra no financeiro e dá baixa no estoque.
    const pedido = {
      ...venda,
      status:               "ENVIADO", // ENVIADO → CONFIRMADO → SAIU_ENTREGA → FINALIZADO
      telefoneNormalizado:  normalizarTelefone(state.cliente.telefone),
      criadoEm:             firebase.firestore.FieldValue.serverTimestamp(),
      confirmadoEm:         null,
      saiuEntregaEm:        null,
      finalizadoEm:         null,
    };

    const docRef = await db.collection("pedidosDelivery").add(pedido);
    console.log("[Mestre Maro] Pedido enviado (aguardando confirmação da loja):", pedido);

    salvarClienteDelivery(state.cliente); // não precisa esperar terminar

    // guarda pra facilitar a busca em "Acompanhar Pedido" da próxima vez
    localStorage.setItem("mestremaro_ultimo_telefone", state.cliente.telefone);

    Swal.fire({
      heightAuto: false,
      customClass: {
        popup: "swal-pedido-popup",
        title: "swal-pedido-titulo",
        htmlContainer: "swal-pedido-texto",
        confirmButton: "swal-pedido-btn-confirm",
        cancelButton: "swal-pedido-btn-secundario",
      },
      buttonsStyling: false,
      iconHtml: `<div class="swal-pedido-icone-sucesso"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`,
      title: "Pedido enviado!",
      html: "Assim que a loja confirmar, você acompanha tudo por aqui.",
      showCancelButton: true,
      confirmButtonText: "Acompanhar Pedido",
      cancelButtonText: "Fechar",
    }).then((resultado) => {
      if (resultado.isConfirmed) openTrackModal();
    });

    state.carrinho  = [];
    state.pagamento = { metodo: null, tipoCartao: null, semTroco: false, trocoPara: null };
    closeModal();
    closeMobileCart();
    renderProducts();
    renderCart();
  } catch (error) {
    console.error("[Mestre Maro] Erro ao enviar o pedido:", error);
    Swal.fire({
      heightAuto: false,
      customClass: {
        popup: "swal-pedido-popup",
        title: "swal-pedido-titulo",
        htmlContainer: "swal-pedido-texto",
        confirmButton: "swal-pedido-btn-erro",
      },
      buttonsStyling: false,
      icon: "error",
      title: "Não foi possível enviar",
      html: `Tente novamente. Se o erro persistir, avise a loja.<br><small style="opacity:0.6">${error.message}</small>`,
      confirmButtonText: "Entendi",
    });
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = "Confirmar Pedido";
  }
}

// ─────────────────────────────────────────────────────
//  ACOMPANHAR PEDIDO — busca por telefone, em tempo real
// ─────────────────────────────────────────────────────
const ORDEM_STATUS  = ["ENVIADO", "CONFIRMADO", "SAIU_ENTREGA", "FINALIZADO"];
const LABEL_STATUS  = {
  ENVIADO:      "Pedido Enviado",
  CONFIRMADO:   "Pedido Confirmado",
  SAIU_ENTREGA: "Saiu p/ Entrega",
  FINALIZADO:   "Pedido Finalizado",
};

let _trackUnsubscribe = null; // cancela o listener anterior quando busca de novo / fecha o modal

function openTrackModal() {
  const telefoneSalvo = state.cliente.telefone || localStorage.getItem("mestremaro_ultimo_telefone") || "";
  document.getElementById("trackTelefoneInput").value = telefoneSalvo;
  document.getElementById("trackResultados").innerHTML = "";
  document.getElementById("trackModalBackdrop").style.display = "flex";

  if (telefoneSalvo) buscarPedidosPorTelefone();
}

function closeTrackModal() {
  document.getElementById("trackModalBackdrop").style.display = "none";
  if (_trackUnsubscribe) {
    _trackUnsubscribe();
    _trackUnsubscribe = null;
  }
}

function buscarPedidosPorTelefone() {
  const telefone = document.getElementById("trackTelefoneInput").value.trim();
  const tel = normalizarTelefone(telefone);

  if (tel.length < 8) {
    showToast("Digite um telefone válido");
    return;
  }

  if (_trackUnsubscribe) _trackUnsubscribe();

  document.getElementById("trackResultados").innerHTML =
    `<p style="text-align:center;color:var(--gray-soft);padding:20px 0;">Buscando...</p>`;

  const db = firebase.firestore();
  // Combinação de 2 .where + orderBy — o Firestore pode pedir pra criar um
  // índice composto na primeira vez que isso rodar (link aparece sozinho
  // no console do navegador — é só clicar).
  _trackUnsubscribe = db.collection("pedidosDelivery")
    .where("idLoja", "==", state.idLoja)
    .where("telefoneNormalizado", "==", tel)
    .orderBy("criadoEm", "desc")
    .limit(5)
    .onSnapshot(
      (snapshot) => {
        const pedidos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderResultadosPedidos(pedidos);
      },
      (erro) => {
        console.error("[Mestre Maro] Erro ao buscar pedidos:", erro);
        document.getElementById("trackResultados").innerHTML =
          `<p style="text-align:center;color:var(--gray-soft);padding:20px 0;">Não foi possível buscar agora. Tente de novo.</p>`;
      }
    );
}

function renderResultadosPedidos(pedidos) {
  const container = document.getElementById("trackResultados");

  if (pedidos.length === 0) {
    container.innerHTML =
      `<p style="text-align:center;color:var(--gray-soft);padding:20px 0;">Nenhum pedido encontrado com esse telefone.</p>`;
    return;
  }

  container.innerHTML = pedidos.map((pedido) => {
    const idxAtual = ORDEM_STATUS.indexOf(pedido.status);

    const steps = ORDEM_STATUS.map((status, i) => {
      const classe = i < idxAtual ? "done" : i === idxAtual ? "active" : "";
      return `
        <div class="track-step ${classe}">
          <div class="track-step-line"></div>
          <div class="track-step-dot"></div>
          <span>${LABEL_STATUS[status]}</span>
        </div>`;
    }).join("");

    return `
      <div class="track-pedido-card">
        <div class="track-pedido-header">
          <span>${pedido.data} às ${pedido.hora}</span>
          <span>${fmt(pedido.totalVenda)}</span>
        </div>
        <div class="track-steps">${steps}</div>
      </div>
    `;
  }).join("");
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
document.addEventListener("DOMContentLoaded", async () => {

  // 1) Pega a loja da URL
  state.idLoja = getLojaIdFromURL();

  if (!state.idLoja) {
    mostrarErroDeLoja("Este link não informa uma loja válida. Peça um link atualizado.");
    return;
  }

  // 2) Valida se a loja existe (pulado quando estiver testando sem Firebase)
  if (CONFIG.usarFirebase) {
    const lojaExiste = await validarLoja(state.idLoja);
    if (!lojaExiste) {
      mostrarErroDeLoja("Loja não encontrada. Verifique o link e tente novamente.");
      return;
    }
  }

  // 3) Loja válida → mostra o cardápio
  document.getElementById("storeErrorState").style.display = "none";
  document.getElementById("cardapioContent").style.display = "block";
  aplicarCabecalhoDaLoja();

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

  // Acompanhar Pedido
  document.getElementById("trackToggle").addEventListener("click", openTrackModal);
  document.getElementById("btnTrackFechar").addEventListener("click", closeTrackModal);
  document.getElementById("btnBuscarPedidos").addEventListener("click", buscarPedidosPorTelefone);
  document.getElementById("trackTelefoneInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); buscarPedidosPorTelefone(); }
  });
  document.getElementById("trackModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "trackModalBackdrop") closeTrackModal();
  });

  // Checkout — primeiro pede os dados do cliente, depois abre a revisão do pedido
  document.getElementById("btnCheckout").addEventListener("click", openCustomerModal);
  document.getElementById("btnCustomerCancel").addEventListener("click", closeCustomerModal);
  document.getElementById("btnCustomerContinue").addEventListener("click", confirmarDadosCliente);
  document.getElementById("customerForm").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      confirmarDadosCliente();
    }
  });
  document.getElementById("custTelefone").addEventListener("blur", handleTelefoneBlurAutofill);
  document.getElementById("btnCancel").addEventListener("click", closeModal);
  document.getElementById("btnConfirm").addEventListener("click", confirmarPedido);

  // Pagamento
  document.getElementById("btnPaymentCancel").addEventListener("click", closePaymentModal);
  document.getElementById("btnPaymentContinue").addEventListener("click", confirmarFormaPagamento);
  document.getElementById("paymentMethodGrid").addEventListener("click", (e) => {
    const btn = e.target.closest(".payment-method-btn");
    if (btn) selecionarMetodoPagamento(btn.dataset.method);
  });
  document.getElementById("cardTypeGrid").addEventListener("click", (e) => {
    const btn = e.target.closest(".troco-quick-btn");
    if (btn) selecionarTipoCartao(btn.dataset.cardtype);
  });
  document.querySelectorAll("#paymentTrocoSection .troco-quick-btn").forEach((btn) =>
    btn.addEventListener("click", () => selecionarTrocoRapido(Number(btn.dataset.troco)))
  );
  document.getElementById("trocoCustomInput").addEventListener("input", (e) =>
    alterarTrocoCustom(e.target.value)
  );

  // Fechar modais clicando fora
  document.getElementById("customerModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "customerModalBackdrop") closeCustomerModal();
  });
  document.getElementById("paymentModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "paymentModalBackdrop") closePaymentModal();
  });
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
});
