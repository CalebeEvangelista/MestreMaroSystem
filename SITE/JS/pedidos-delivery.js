/* =====================================================
   pedidos-delivery.js  —  Mestre Maro  |  Kanban de Pedidos Delivery
   =====================================================
   Roda dentro do home.html, na aba "Delivery" (mesmo padrão de
   produtos.js/compras.js/clientes.js/comandas.js — um arquivo por
   tela, carregado sob demanda via carregarDadosDaTela() no home.js).

   3 colunas: CONFIRMADO → SAIU_ENTREGA → FINALIZADO
   (o status ENVIADO não aparece aqui — esse é resolvido no popup
   "Novo Pedido" do home.js, que já confirma antes de chegar no board).

   Arrastar um card entre colunas muda o status no Firestore.
   Clicar (sem arrastar) abre o detalhe, com botão de reimprimir e
   de avançar etapa.

   SÓ QUANDO um pedido cai em FINALIZADO é que uma venda de verdade é
   criada na coleção "vendas" (mesmo formato do PDV) e o estoque é
   baixado — reaproveitando atualizarEstoque(), já definida em pdv.js.

   Reaproveita formatarReais(), iconeParaTipo() e
   imprimirConteudoPedido80mm(), todas já definidas em pdv.js.
   ===================================================== */

const STATUS_COLUNAS = ["CONFIRMADO", "SAIU_ENTREGA", "FINALIZADO"];
const PROXIMO_STATUS = { CONFIRMADO: "SAIU_ENTREGA", SAIU_ENTREGA: "FINALIZADO" };
const LABEL_PROXIMO  = { SAIU_ENTREGA: "Saiu p/ Entrega", FINALIZADO: "Finalizar Pedido" };

// nome específico (não "state") pra não colidir com nada de
// pdv.js/produtos.js/compras.js/etc, que rodam no mesmo escopo global
const kanbanState = {
  idLoja: null,
  pedidos: new Map(), // id -> pedido (com id incluso)
};

// ─────────────────────────────────────────────────────
//  INICIALIZAÇÃO — chamada por carregarDadosDaTela() no home.js,
//  na primeira vez que a aba "Delivery" é aberta. Nesse ponto a loja
//  já está selecionada (é obrigatório antes de qualquer tela abrir),
//  então não precisa de polling/espera.
// ─────────────────────────────────────────────────────
function iniciarKanbanDelivery() {
  const idLoja = localStorage.getItem("selecaoLoja");
  if (!idLoja) return; // defensivo — não deveria acontecer

  kanbanState.idLoja = idLoja.trim();
  ligarEventosColunas(); // só aqui — as colunas nunca são recriadas
  iniciarListenerKanban(kanbanState.idLoja);
}

function iniciarListenerKanban(idLoja) {
  const db = firebase.firestore();

  db.collection("pedidosDelivery")
    .where("idLoja", "==", idLoja)
    .where("status", "in", STATUS_COLUNAS)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const id = change.doc.id;
          if (change.type === "removed") {
            kanbanState.pedidos.delete(id);
          } else {
            kanbanState.pedidos.set(id, { id, ...change.doc.data() });
          }
        });
        renderQuadro();
      },
      (erro) => console.error("[Mestre Maro] Erro no listener do Kanban:", erro)
    );
}

// ─────────────────────────────────────────────────────
//  RENDERIZAÇÃO DO QUADRO
// ─────────────────────────────────────────────────────
function renderQuadro() {
  STATUS_COLUNAS.forEach((status) => {
    const container = document.getElementById("coluna-" + status);
    const cardsDoStatus = [...kanbanState.pedidos.values()]
      .filter((p) => p.status === status)
      .sort((a, b) => segundosDoTimestamp(a.confirmadoEm) - segundosDoTimestamp(b.confirmadoEm));

    document.getElementById("count-" + status).textContent = cardsDoStatus.length;

    container.innerHTML = cardsDoStatus.length
      ? cardsDoStatus.map(criarCardHTML).join("")
      : `<p class="kanban-vazio">Nenhum pedido aqui</p>`;
  });

  ligarEventosCards();
  atualizarTimers();
}

function segundosDoTimestamp(ts) {
  return ts && ts.seconds ? ts.seconds : 0;
}

/** Formata uma quantidade de segundos como "12:34" */
function formatarDuracao(segundos) {
  const total = Math.max(0, Math.floor(segundos));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

function criarCardHTML(pedido) {
  const cliente  = pedido.clienteDetalhes || {};
  const mp       = pedido.meiosPagamento?.[0] || {};
  const segConf  = segundosDoTimestamp(pedido.confirmadoEm);
  const { icon } = iconeParaTipo(mp.tipoPagamento);

  // Assim que sai pra entrega, o timer para de contar (fica marcando
  // só o tempo entre confirmado → saiu pra entrega, que é o que
  // interessa acompanhar). Continua congelado assim no Finalizado
  // também, em vez de voltar a somar o tempo de entrega.
  let timerHtml;
  if (pedido.status === "SAIU_ENTREGA" || pedido.status === "FINALIZADO") {
    const segSaiu = segundosDoTimestamp(pedido.saiuEntregaEm);
    const texto = (segConf && segSaiu) ? formatarDuracao(segSaiu - segConf) : "--:--";
    timerHtml = `<span class="kanban-card-timer timer-final">${texto}</span>`;
  } else {
    timerHtml = `<span class="kanban-card-timer" data-confirmado="${segConf}">--:--</span>`;
  }

  return `
    <div class="kanban-card" draggable="true" data-id="${pedido.id}">
      <div class="kanban-card-top">
        <span class="kanban-card-nome">${pedido.cliente || "Sem nome"}</span>
        ${timerHtml}
      </div>
      <div class="kanban-card-endereco">
        <i class="fa-solid fa-location-dot"></i>${(cliente.endereco || "-")}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-total">${formatarReais(pedido.totalVenda || 0)}</span>
        <span class="kanban-card-pagamento"><i class="fa-solid ${icon}"></i></span>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────
//  TIMER — atualiza a cada segundo, sem precisar re-renderizar tudo
// ─────────────────────────────────────────────────────
function atualizarTimers() {
  document.querySelectorAll(".kanban-card-timer:not(.timer-final)").forEach((el) => {
    const segConf = Number(el.dataset.confirmado);

    if (!segConf) { el.textContent = "--:--"; return; }

    const decorrido = Math.max(0, Math.floor(Date.now() / 1000) - segConf);
    const min = Math.floor(decorrido / 60);
    const seg = decorrido % 60;
    el.textContent = `${min}:${String(seg).padStart(2, "0")}`;

    el.classList.remove("timer-ok", "timer-atencao", "timer-atrasado");
    if (min < 10)      el.classList.add("timer-ok");
    else if (min < 20) el.classList.add("timer-atencao");
    else                el.classList.add("timer-atrasado");
  });
}
setInterval(atualizarTimers, 1000);

// ─────────────────────────────────────────────────────
//  DRAG & DROP
// ─────────────────────────────────────────────────────
/** Liga os listeners dos CARDS — chamada a cada render, porque os cards
 *  são recriados do zero (innerHTML) toda vez, então é seguro replugar. */
function ligarEventosCards() {
  document.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.id);
      card.classList.add("arrastando");
    });
    card.addEventListener("dragend", () => card.classList.remove("arrastando"));
    card.addEventListener("click", () => abrirDetalhePedido(card.dataset.id));
  });
}

/** Liga os listeners das COLUNAS — chamada só UMA VEZ (na inicialização).
 *  As colunas (#coluna-CONFIRMADO etc.) são os MESMOS elementos o tempo
 *  todo — só o conteúdo interno (os cards) é recriado a cada render. Se
 *  isso fosse chamado em todo render, cada drop() ficaria empilhando um
 *  listener novo, disparando o mesmo movimento várias vezes de uma vez
 *  (era exatamente o motivo da venda subir duplicada). */
function ligarEventosColunas() {
  document.querySelectorAll(".kanban-coluna-cards").forEach((coluna) => {
    coluna.addEventListener("dragover", (e) => {
      e.preventDefault();
      coluna.classList.add("dragover");
    });
    coluna.addEventListener("dragleave", () => coluna.classList.remove("dragover"));
    coluna.addEventListener("drop", (e) => {
      e.preventDefault();
      coluna.classList.remove("dragover");
      const idDoc = e.dataTransfer.getData("text/plain");
      moverPedido(idDoc, coluna.dataset.status);
    });
  });
}

/** Move um pedido pra outro status. Confirma antes se for voltar etapa (arrasto errado). */
async function moverPedido(idDoc, novoStatus) {
  const pedido = kanbanState.pedidos.get(idDoc);
  if (!pedido || pedido.status === novoStatus) return;

  if (STATUS_COLUNAS.indexOf(novoStatus) < STATUS_COLUNAS.indexOf(pedido.status)) {
    const { isConfirmed } = await Swal.fire({
      heightAuto: false,
      icon: "warning",
      title: "Voltar etapa?",
      text: "Esse pedido vai voltar pra uma etapa anterior. Confirma?",
      showCancelButton: true,
      confirmButtonText: "Sim, voltar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) { renderQuadro(); return; } // desfaz visualmente o drag
  }

  const campoTimestamp = {
    CONFIRMADO:   "confirmadoEm",
    SAIU_ENTREGA: "saiuEntregaEm",
    FINALIZADO:   "finalizadoEm",
  }[novoStatus];

  try {
    await firebase.firestore().collection("pedidosDelivery").doc(idDoc).update({
      status: novoStatus,
      [campoTimestamp]: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (novoStatus === "FINALIZADO") {
      await finalizarPedidoComoVenda(idDoc, pedido);
    }
  } catch (erro) {
    console.error("[Mestre Maro] Erro ao mover pedido:", erro);
    Swal.fire({
 heightAuto: false, icon: "error", title: "Erro ao mover pedido", text: erro.message });
  }
}

// ─────────────────────────────────────────────────────
//  FINALIZAÇÃO — só aqui a venda de verdade é criada
// ─────────────────────────────────────────────────────
/**
 * Botão de vassourinha na coluna "Finalizado" — apaga os PEDIDOS
 * dessa coluna (coleção "pedidosDelivery"), só pra limpar a tela.
 * NÃO mexe na coleção "vendas" — a venda já foi gravada lá quando o
 * pedido foi finalizado, com todos os dados, então nada se perde.
 */
async function limparPedidosFinalizados() {
  const pedidosFinalizados = [...kanbanState.pedidos.values()].filter((p) => p.status === "FINALIZADO");

  if (pedidosFinalizados.length === 0) {
    Swal.fire({ heightAuto: false, icon: "info", title: "Nada pra limpar", text: "Não tem pedido finalizado na tela." });
    return;
  }

  const { isConfirmed } = await Swal.fire({
    heightAuto: false,
    icon: "question",
    title: "Limpar pedidos finalizados?",
    text: `Isso tira ${pedidosFinalizados.length} pedido(s) dessa tela. As vendas continuam registradas normalmente — só some do quadro.`,
    showCancelButton: true,
    confirmButtonText: "Sim, limpar",
    cancelButtonText: "Cancelar",
  });
  if (!isConfirmed) return;

  try {
    const db = firebase.firestore();
    const batch = db.batch();
    pedidosFinalizados.forEach((p) => batch.delete(db.collection("pedidosDelivery").doc(p.id)));
    await batch.commit();

    Swal.fire({
      heightAuto: false,
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Quadro limpo!",
      showConfirmButton: false,
      timer: 1800,
    });
  } catch (erro) {
    console.error("[Mestre Maro] Erro ao limpar pedidos finalizados:", erro);
    Swal.fire({ heightAuto: false, icon: "error", title: "Erro ao limpar", text: erro.message });
  }
}

async function finalizarPedidoComoVenda(idDocPedido, pedido) {
  if (pedido.idVendaGerada) return; // já virou venda antes — não duplica

  const db = firebase.firestore();
  const agora = new Date();
  const [dataStr, horaStr] = agora.toLocaleString("pt-BR").split(",");

  const venda = {
    data:            pedido.data || dataStr.trim(),
    hora:            pedido.hora || horaStr.trim(),
    idLoja:          pedido.idLoja,
    idVenda:         pedido.idVenda || (crypto?.randomUUID?.() ?? ("id-" + Date.now())),
    idCaixa:         null,       // não passou pelo caixa físico
    origem:          "delivery",
    meiosPagamento:  pedido.meiosPagamento,
    produtos:        pedido.produtos,
    totalVenda:      pedido.totalVenda,
    cliente:         pedido.cliente,
    clienteDetalhes: pedido.clienteDetalhes,
    criadoEm:        firebase.firestore.FieldValue.serverTimestamp(),
  };

  console.log("[Mestre Maro] Finalizando pedido, montando venda:", venda);

  try {
    const vendaRef = await db.collection("vendas").add(venda);
    console.log("[Mestre Maro] Venda gravada no Firestore, id:", vendaRef.id);

    await atualizarEstoque(pedido.produtos, pedido.idLoja); // já existe em pdv.js
    console.log("[Mestre Maro] Estoque atualizado");

    await db.collection("pedidosDelivery").doc(idDocPedido).update({
      idVendaGerada: vendaRef.id,
    });
    console.log("[Mestre Maro] Pedido marcado como finalizado — venda criada:", venda);

    Swal.fire({
      heightAuto: false,
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Venda registrada!",
      showConfirmButton: false,
      timer: 2000,
    });
  } catch (erro) {
    console.error("[Mestre Maro] Erro ao finalizar pedido / gerar venda:", erro);
    Swal.fire({
      heightAuto: false,
      icon: "error",
      title: "Erro ao finalizar",
      text: "A venda pode não ter sido registrada. " + erro.message,
    });
  }
}

// ─────────────────────────────────────────────────────
//  DETALHE DO PEDIDO — mesmo padrão visual swal-resumo
// ─────────────────────────────────────────────────────
function abrirDetalhePedido(idDoc) {
  const pedido = kanbanState.pedidos.get(idDoc);
  if (!pedido) return;

  const cliente = pedido.clienteDetalhes || {};
  const mp      = pedido.meiosPagamento?.[0] || {};

  const linhasProdutos = pedido.produtos.map((p) => {
    const eEntrega = p.id === "taxa-entrega";
    return `
      <div class="swal-resumo-pagamento-row">
        <div class="swal-resumo-pagamento-left">
          <div class="swal-resumo-pagamento-icon" style="background:rgba(255,255,255,0.08); color:#fff">
            <i class="fa-solid ${eEntrega ? "fa-motorcycle" : "fa-basket-shopping"}"></i>
          </div>
          <div>
            <div class="swal-resumo-pagamento-tipo">${p.nome}</div>
            <div class="swal-resumo-pagamento-qtd">${p.quantidade}x</div>
          </div>
        </div>
        <div class="swal-resumo-pagamento-valor">${formatarReais(p.valorTotal)}</div>
      </div>
    `;
  }).join("");

  const proximo      = PROXIMO_STATUS[pedido.status];
  const botaoProximo  = proximo
    ? `<button class="swal-resumo-btn swal-resumo-btn-confirm" onclick="moverPedido('${idDoc}','${proximo}'); Swal.close();">
         <i class="fa-solid fa-arrow-right"></i> ${LABEL_PROXIMO[proximo]}
       </button>`
    : "";

  Swal.fire({
    heightAuto: false,
    customClass: { popup: "swal-resumo-popup" },
    showConfirmButton: false,
    html: `
      <div class="swal-resumo-wrap">
        <div class="swal-resumo-header">
          <h2>${pedido.cliente || "Sem nome"}</h2>
          <p class="swal-resumo-subtitle">${pedido.data} às ${pedido.hora}</p>
        </div>

        <div class="swal-resumo-section">
          <div class="swal-resumo-section-head"><span>Cliente</span><div class="swal-resumo-section-line"></div></div>
          <div class="swal-resumo-info-grid">
            <div class="swal-resumo-info-item"><label>Telefone</label><span>${cliente.telefone || "-"}</span></div>
            <div class="swal-resumo-info-item" style="grid-column: span 2">
              <label>Endereço</label>
              <span>${cliente.endereco || "-"}${cliente.referencia ? " (" + cliente.referencia + ")" : ""}</span>
            </div>
            ${cliente.observacoes ? `
            <div class="swal-resumo-info-item" style="grid-column: span 2">
              <label>Observações</label><span>${cliente.observacoes}</span>
            </div>` : ""}
          </div>
        </div>

        <div class="swal-resumo-section">
          <div class="swal-resumo-section-head"><span>Itens</span><div class="swal-resumo-section-line"></div></div>
          ${linhasProdutos}
        </div>

        <div class="swal-resumo-section">
          <div class="swal-resumo-section-head"><span>Pagamento</span><div class="swal-resumo-section-line"></div></div>
          <div class="swal-resumo-pagamento-row">
            <div class="swal-resumo-pagamento-tipo">${mp.tipoPagamento || "-"}</div>
            ${mp.trocoPara ? `<div class="swal-resumo-pagamento-qtd">Troco p/ ${formatarReais(mp.trocoPara)}</div>` : ""}
          </div>
          <div class="swal-resumo-total-row">
            <span class="swal-resumo-total-label">Total</span>
            <div class="swal-resumo-total-valor">${formatarReais(pedido.totalVenda)}</div>
          </div>
        </div>
      </div>

      <div class="swal-resumo-footer">
        <button class="swal-resumo-btn swal-resumo-btn-close" onclick="Swal.close()">
          <i class="fa-solid fa-xmark"></i> Fechar
        </button>
        <button class="swal-resumo-btn swal-resumo-btn-info" onclick="reimprimirPedido('${idDoc}')">
          <i class="fa-solid fa-print"></i> Reimprimir
        </button>
        ${botaoProximo}
      </div>
    `,
  });
}

/** Reimprime o cupom de um pedido — mesmo formato que sai na primeira impressão (home.js) */
function reimprimirPedido(idDoc) {
  const pedido = kanbanState.pedidos.get(idDoc);
  if (!pedido) return;

  const cliente = pedido.clienteDetalhes || {};
  const mp      = pedido.meiosPagamento?.[0] || {};

  const itensProduto = pedido.produtos.filter((p) => p.id !== "taxa-entrega");
  const itemEntrega   = pedido.produtos.find((p) => p.id === "taxa-entrega");
  const subtotal       = itensProduto.reduce((acc, p) => acc + Number(p.valorTotal || 0), 0);
  const valorEntrega   = Number(itemEntrega?.valorTotal || 0);

  imprimirConteudoPedido80mm({
    titulo:          "PEDIDO DELIVERY",
    nomeCliente:     pedido.cliente,
    telefone:        cliente.telefone,
    endereco:        (cliente.endereco || "") + (cliente.referencia ? ` (${cliente.referencia})` : ""),
    numero:          "",
    produtos:        itensProduto,
    observacoes:     cliente.observacoes,
    total:           subtotal,
    valorEntrega:    valorEntrega,
    acrescimoCartao: Number(mp.taxa || 0),
    formaPagamento:  mp.tipoPagamento,
    trocoPara:       mp.trocoPara,
  });
}

// (Sem DOMContentLoaded aqui — quem chama iniciarKanbanDelivery() é o
// carregarDadosDaTela() do home.js, na primeira vez que a aba abre.)
