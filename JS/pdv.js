let vendaAtual = {
    produtos: [],
    meiosPagamento: [],
    totalVenda: 0
}

// ─────────────────────────────────────────────
// FUNÇÃO PARA REGISTRAR A VENDA NO BD
// ─────────────────────────────────────────────
async function registrarVenda() {
    const pErro = document.getElementById('erroPagamento');
    if (pErro) pErro.style.display = 'none';

    const totalPagamentos = await calcularMeiosDePagamento();

    // 🔴 FIX 1: verificação de null antes de usar pErro
    if (totalPagamentos === 0 || getTotalFinal() > totalPagamentos) {
        if (pErro) pErro.style.display = 'flex';
        return;
    }

    const db = firebase.firestore();
    const idLoja = localStorage.getItem('selecaoLoja');

    if (!idLoja) return;

    let cliente = document.getElementById('nomeCliente').value;
    if (!cliente) cliente = 'Sem Nome';

    const dataAgora = new Date();
    const dataCompleta = dataAgora.toLocaleString('pt-BR');
    const dataSplitada = dataCompleta.split(',');

    const idVenda =
        crypto?.randomUUID?.() ??
        'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);

    const vendaBase = {
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        data: dataSplitada[0],
        hora: dataSplitada[1],
        idLoja: idLoja,
        idVenda: idVenda,
        idCaixa: localStorage.getItem('caixaAtualId'), // <- adiciona isso
        meiosPagamento: vendaAtual.meiosPagamento,
        produtos: vendaAtual.produtos,
        totalVenda: getTotalFinal(),
        cliente: cliente
    };

    await db.collection('vendas').doc().set(vendaBase);

    alert('Venda Registrada com sucesso!');
    cashbackClientes(vendaBase.cliente, vendaBase.totalVenda);
    atualizarEstoque(vendaBase.produtos, idLoja);
    limparPDV();
    fecharPagamento();
    const inputProduto = document.getElementById("produto");
    inputProduto.focus();
}

// ─────────────────────────────────────────────
// FUNÇÃO DE CÁLCULO DOS MEIOS DE PAGAMENTO E TAXAS
// ─────────────────────────────────────────────

// 🟡 FIX 9: normalizar fora do loop, reutilizada em todo o escopo do módulo
function normalizar(texto) {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

async function calcularMeiosDePagamento() {
    try {
        const db = firebase.firestore();
        const idLoja = localStorage.getItem('selecaoLoja');

        const meiosDePagamento = document.querySelectorAll('.valorPagamento[data-tipo]');
        let total = 0;

        vendaAtual.meiosPagamento = [];

        const snapshot = await db.collection('lojas').where('id', '==', idLoja).get();

        if (snapshot.empty) {
            console.log("Loja não encontrada");
            return 0;
        }

        const loja = snapshot.docs[0].data();
        const taxasDaLoja = loja.taxas || {};

        meiosDePagamento.forEach(input => {
            if (input.id === 'valorRestante' || input.id === 'troco') return;

            const valorNumerico = Number(
                input.value
                    .replace(/[^\d.,]/g, '')
                    .replace(/\./g, '')
                    .replace(',', '.')
            );

            if (isNaN(valorNumerico) || valorNumerico <= 0) return;

            const tipoInput = normalizar(input.dataset.tipo);

            const taxa = Object.entries(taxasDaLoja).find(([tipo]) =>
                normalizar(tipo) === tipoInput
            )?.[1];

            if (taxa !== undefined) {
                const valorTaxa = valorNumerico * taxa;
                vendaAtual.meiosPagamento.push({
                    tipoPagamento: input.dataset.tipo,
                    valor: valorNumerico,
                    taxa: valorTaxa
                });
            } else {
                vendaAtual.meiosPagamento.push({
                    tipoPagamento: input.dataset.tipo,
                    valor: valorNumerico,
                    taxa: 0
                });
            }

            total += valorNumerico;
        });

        return total;
    } catch (erro) {
        console.error("Erro ao calcular meios de pagamento:", erro);
        return 0;
    }
}

// ─────────────────────────────────────────────
// FUNÇÃO DE GERAR PIX
// ─────────────────────────────────────────────
function pix() {
    // 🔴 FIX 4: renomeada variável para evitar shadowing + parsing corrigido
    const inputPix = document.querySelector('[data-tipo="PIX"]');
    const pixNumerico = Number(
        inputPix.value
            .replace(/[^\d.,]/g, '')
            .replace(/\./g, '')   // remove pontos de milhar antes de trocar vírgula
            .replace(',', '.')
    );

    if (pixNumerico === 0) {
        alert('Digite um valor antes de gerar o PIX');
    } else {
        gerarPixEEnviarTelegram(pixNumerico);
    }
}

// ─────────────────────────────────────────────
// FUNÇÃO DE IMPRESSÃO DO PEDIDO
// ─────────────────────────────────────────────
async function imprimirPedido() {

    const { isConfirmed } = await Swal.fire({
        title: "Tipo do pedido",
        text: "Esse pedido é entrega?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sim, é entrega",
        cancelButtonText: "Não, balcão / retirada",
        confirmButtonColor: "#2a9d8f",
        cancelButtonColor: "#3a86ff",
        reverseButtons: true,
        heightAuto: false,
        customClass: { popup: "swal-venda-popup" }
    });

    let enderecoEntrega = "";
    let numeroEntrega = "";
    let valorEntrega = 0;

    // 🔵 FIX 11: vendaAtual.cliente agora é lido corretamente — mas como
    // imprimirPedido() é chamada ANTES de registrarVenda(), o cliente vem
    // do campo do DOM, que é a fonte correta aqui.
    let nomeCliente =
        document.getElementById("nomeCliente")?.value?.trim() ||
        document.getElementById("nomeCliente")?.textContent?.trim() ||
        "Sem Nome";

    if (isConfirmed) {

        const resultEndereco = await Swal.fire({
            title: "Dados da entrega",
            html: `
                <input id="nomeEntrega" class="swal2-input" placeholder="Nome do cliente" value="${nomeCliente}">
                <input id="ruaEntrega" class="swal2-input" placeholder="Rua / Avenida">
                <input id="numeroEntrega" class="swal2-input" placeholder="Número">
                <input id="bairroEntrega" class="swal2-input" placeholder="Bairro">
            `,
            showCancelButton: true,
            confirmButtonText: "Continuar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#2a9d8f",
            heightAuto: false,
            focusConfirm: false,
            customClass: { popup: "swal-venda-popup" },
            preConfirm: () => {
                const nome   = document.getElementById("nomeEntrega").value.trim();
                const rua    = document.getElementById("ruaEntrega").value.trim();
                const numero = document.getElementById("numeroEntrega").value.trim();
                const bairro = document.getElementById("bairroEntrega").value.trim();

                if (!nome || !rua || !numero || !bairro) {
                    Swal.showValidationMessage("Preencha nome, rua, número e bairro.");
                    return false;
                }

                return { nome, rua, numero, bairro };
            }
        });

        if (!resultEndereco.isConfirmed) return;

        nomeCliente    = resultEndereco.value.nome;
        numeroEntrega  = resultEndereco.value.numero;
        enderecoEntrega = `${resultEndereco.value.rua} - ${resultEndereco.value.bairro}`;

        const resultTaxa = await Swal.fire({
            title: "Valor da entrega",
            input: "number",
            inputPlaceholder: "Ex: 5.00",
            inputValue: 0,
            inputAttributes: { step: "0.01", min: "0" },
            showCancelButton: true,
            confirmButtonText: "Continuar",
            cancelButtonText: "Sem taxa",
            confirmButtonColor: "#2a9d8f",
            heightAuto: false,
            customClass: { popup: "swal-venda-popup" }
        });

        valorEntrega = resultTaxa.dismiss === Swal.DismissReason.cancel
            ? 0
            : (resultTaxa.value ? Number(resultTaxa.value) : 0);
    }

    const resultObs = await Swal.fire({
        title: "Observações",
        input: "textarea",
        inputPlaceholder: "Ex: sem gelo, entregar rápido, troco para 100...",
        showCancelButton: true,
        confirmButtonText: "Imprimir pedido",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#2a9d8f",
        heightAuto: false,
        customClass: { popup: "swal-venda-popup" }
    });

    if (!resultObs.isConfirmed) return;

    const observacoes = resultObs.value || "";

    let produtos = [];

    if (Array.isArray(vendaAtual?.produtos) && vendaAtual.produtos.length) {
        produtos = vendaAtual.produtos;
    }

    if (!produtos.length) {
        const tabela = document.getElementById("tabelaProdutos");

        if (tabela) {
            const linhas = tabela.querySelectorAll("tbody tr");

            produtos = Array.from(linhas).map((linha) => {
                const colunas = linha.querySelectorAll("td");
                if (colunas.length < 3) return null;

                const nome       = colunas[0].textContent.trim();
                const quantidade = Number(colunas[1].textContent.trim()) || 0;

                const valorTexto = colunas[2].textContent
                    .replace("R$", "")
                    .replace(/\./g, "")
                    .replace(",", ".")
                    .trim();

                const valorTotal = Number(valorTexto) || 0;

                if (!nome || nome.toLowerCase().includes("nenhum produto")) return null;

                return { nome, quantidade, valorTotal };
            }).filter(Boolean);
        }
    }

    let total = 0;

    if (typeof getTotalFinal === "function") {
        total = Number(getTotalFinal()) || 0;
    }

    if (!total) total = Number(vendaAtual?.totalVenda || vendaAtual?.total || 0);

    if (!total) {
        const elTotal    = document.getElementById("totalVenda");
        const totalTexto = elTotal?.textContent
            ?.replace("R$", "")
            ?.replace(/\./g, "")
            ?.replace(",", ".")
            ?.trim();

        total = Number(totalTexto) || 0;
    }

    imprimirConteudoPedido80mm({
        nomeCliente,
        endereco: enderecoEntrega,
        numero: numeroEntrega,
        produtos,
        observacoes,
        total,
        valorEntrega
    });
}

function imprimirConteudoPedido80mm({
    nomeCliente,
    endereco,
    numero,
    produtos,
    observacoes,
    total,
    valorEntrega
}) {
    const logoPath = "/IMAGENS/LOGOPRETOMONOCROMATICO.png";

    const janela = window.open("", "_blank", "width=420,height=800");

    const linhasProdutos = produtos.map(produto => `
        <tr>
            <td>${produto.nome}</td>
            <td style="text-align:center">${produto.quantidade}</td>
            <td style="text-align:right">
                R$ ${Number(produto.valorTotal || 0).toFixed(2).replace(".", ",")}
            </td>
        </tr>
    `).join("");

    const totalFinal = Number(total || 0) + Number(valorEntrega || 0);

    janela.document.write(`
    <html>
    <head>
        <style>
            @page { size: 80mm auto; margin: 0; }
            body { width:80mm; font-family:Arial,sans-serif; margin:0; padding:4mm; color:#000; font-size:12px; }
            .logo { text-align:center; margin-bottom:6px; }
            .logo img { max-width:60mm; max-height:45px; }
            .titulo { text-align:center; font-weight:bold; font-size:16px; margin-bottom:8px; }
            .linha { border-top:1px dashed #000; margin:8px 0; }
            .cliente { margin-bottom:8px; font-size:12px; line-height:1.5; word-break:break-word; }
            table { width:100%; border-collapse:collapse; font-size:12px; }
            th { border-bottom:1px solid #000; padding-bottom:4px; text-align:left; }
            td { padding:4px 0; }
            .obs { margin-top:8px; font-size:12px; }
            .obs-box { border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin:6px 0; white-space:pre-line; word-break:break-word; }
            .totais { margin-top:8px; font-size:13px; font-weight:bold; }
            .totais div { display:flex; justify-content:space-between; margin-top:4px; }
            .rodape { text-align:center; margin-top:10px; font-size:11px; }
        </style>
    </head>
    <body>
        <div class="logo"><img src="${logoPath}"></div>
        <div class="linha"></div>
        <div class="cliente">
            <div><strong>Cliente:</strong> ${nomeCliente || "Sem Nome"}</div>
            ${endereco
                ? `<div><strong>Endereço:</strong> ${endereco}, ${numero}</div>`
                : `<div><strong>Tipo:</strong> Balcão / Retirada</div>`
            }
        </div>
        <div class="linha"></div>
        <table>
            <thead>
                <tr>
                    <th>Produto</th>
                    <th style="text-align:center">Qtd</th>
                    <th style="text-align:right">Valor</th>
                </tr>
            </thead>
            <tbody>
                ${linhasProdutos || `<tr><td colspan="3">Nenhum produto</td></tr>`}
            </tbody>
        </table>
        <div class="obs">
            <strong>Observações</strong>
            <div class="obs-box">${observacoes || "Sem observações"}</div>
        </div>
        <div class="totais">
            <div><span>Total pedido</span><span>R$ ${Number(total || 0).toFixed(2).replace(".", ",")}</span></div>
            <div><span>Entrega</span><span>R$ ${Number(valorEntrega || 0).toFixed(2).replace(".", ",")}</span></div>
            <div><span>Total final</span><span>R$ ${totalFinal.toFixed(2).replace(".", ",")}</span></div>
        </div>
        <div class="linha"></div>
        <div class="rodape">Obrigado pela preferência, fique atento nas novidades @EsquentaDoPovo</div>
        <script>
            window.onload = function(){ window.print(); window.close(); }
        <\/script>
    </body>
    </html>
    `);

    janela.document.close();
}

function abrirModalImpressaoPedido() {
    imprimirPedido();
}

// ─────────────────────────────────────────────
// AUTOCOMPLETE DE PRODUTOS
// ─────────────────────────────────────────────
function autoComplete() {
    const inputProduto = document.getElementById("produto");
    const quantidade   = document.getElementById("quantidade");
    const idLoja       = localStorage.getItem('selecaoLoja');
    const db           = firebase.firestore();

    let dataList = document.getElementById('listaProdutosSugestao');
    if (!dataList) {
        dataList    = document.createElement("datalist");
        dataList.id = "listaProdutosSugestao";
        document.body.appendChild(dataList);
    }
    inputProduto.setAttribute("list", "listaProdutosSugestao");

    (async () => {
        const snapshot = await db.collection("produtos")
            .where("idLoja", "==", idLoja)
            .orderBy("nome")
            .get();

        dataList.innerHTML = '';
        snapshot.forEach(doc => {
            const produto = doc.data();
            const opt     = document.createElement('option');
            opt.value              = produto.nome;
            opt.dataset.preco      = produto.valorVenda;
            opt.dataset.qtdAtacado = produto.qtdAtacado || 0;
            opt.dataset.valorAtacado = produto.valorAtacado || produto.valorVenda;
            dataList.appendChild(opt);
        });
    })();

    // 🟡 FIX 5: listeners adicionados uma única vez — autoComplete() deve ser
    // chamada apenas uma vez (já está assim no final do script).
    inputProduto.addEventListener("input", () => {
        const selecionado = inputProduto.value;
        const option = Array.from(document.querySelectorAll("#listaProdutosSugestao option"))
            .find(o => o.value === selecionado);
        if (!option) return;

        const preco = Number(option.dataset.preco);
        document.getElementById("valorVendido").value = preco.toFixed(2).replace('.', ',');
        quantidade.focus();
    });

    quantidade.addEventListener("change", () => {
        const nomeProduto = inputProduto.value || '';
        const option = Array.from(document.querySelectorAll("#listaProdutosSugestao option"))
            .find(o => o.value === nomeProduto);
        if (!option) return;

        const quantidadeDigitada = Number(quantidade.value);
        const precoDigitado      = document.getElementById('valorVendido');

        if (quantidadeDigitada >= Number(option.dataset.qtdAtacado)) {
            const valorAtacado = Number(option.dataset.valorAtacado);
            precoDigitado.value = valorAtacado.toFixed(2).replace('.', ',');
            document.getElementById("totalItem").value =
                (valorAtacado * quantidadeDigitada).toFixed(2).replace('.', ',');
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Shift") {
            event.preventDefault();

            const produtoVal = document.getElementById('produto').value.trim();
            const qtdVal     = document.getElementById('quantidade').value.trim();
            const valorVal   = document.getElementById('valorVendido').value.trim();

            if (!produtoVal || !qtdVal || !valorVal) {
                console.warn("Preencha produto, quantidade e preço antes de adicionar");
                return;
            }

            addToShoppingList();
        }
        if (event.key === "Enter") {
            event.preventDefault();
            abrirPagamento();
        }
        if (event.key === "F10") {
            event.preventDefault();
            registrarVenda();
        }
        if (event.key === "F8") {
            event.preventDefault();
            event.stopImmediatePropagation(); // ✅ troca stopPropagation por esse
            abrirResumoCaixa();
        }
    });
}

// ─────────────────────────────────────────────
// QUANTIDADE E VALORES DO ITEM
// ─────────────────────────────────────────────
function itensQuantidades() {
    const inputQtd   = document.getElementById("quantidade");
    const inputValor = document.getElementById("valorVendido");
    const inputTotal = document.getElementById("totalItem");

    function formatarMoedaInput(input) {
        let valor = input.value.replace(/\D/g, "");
        valor     = (Number(valor) / 100).toFixed(2);
        input.value = valor.replace(".", ",");
    }

    function atualizarTotal() {
        const qtd   = Number(inputQtd.value) || 0;
        const valor = Number(inputValor.value.replace(",", ".")) || 0;

        inputTotal.value = (qtd * valor).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    inputValor.addEventListener("change", () => {
        formatarMoedaInput(inputValor);
        atualizarTotal();
    });

    inputQtd.addEventListener("input", atualizarTotal);
}

// ─────────────────────────────────────────────
// CALCULAR VALOR TOTAL DA VENDA
// ─────────────────────────────────────────────
function calcularValorTotal() {
    let total = 0;

    // 🟡 FIX 8: queries DOM fora do forEach
    const totalVenda       = document.getElementById("totalVenda");
    const totalVendaAVista = document.getElementById("totalVendaAVista");

    document.querySelectorAll(".valorItem").forEach(item => {
        const valor = Number(
            item.textContent
                .replace("R$", "")
                .replace(/\./g, "")
                .replace(",", ".")
                .trim()
        );
        total += valor;
    });

    if (totalVenda)       totalVenda.value       = total.toFixed(2).replace(".", ",");
    if (totalVendaAVista) totalVendaAVista.value  = (total * 1.05).toFixed(2).replace(".", ",");

    // 🔴 FIX 1: sempre retorna número, nunca string
    return total;
}

// ─────────────────────────────────────────────
// ADICIONAR PRODUTO À LISTA DA VENDA
// ─────────────────────────────────────────────
async function addToShoppingList() {
    const produto     = document.getElementById('produto');
    const quantidade  = document.getElementById('quantidade');
    const valorVendido = document.getElementById('valorVendido');
    const totalItem   = document.getElementById('totalItem');

    const nomeProduto        = produto.value.trim();
    const quantidadeNumero   = Number(quantidade.value);
    const valorUnitarioNumero = Number(String(valorVendido.value).replace(',', '.'));

    let totalDoItem = quantidadeNumero === 1
        ? valorUnitarioNumero
        : Number(String(totalItem.value).replace(',', '.'));

    if (
        !nomeProduto ||
        !quantidadeNumero || quantidadeNumero <= 0 ||
        !valorUnitarioNumero || valorUnitarioNumero <= 0 ||
        !totalDoItem || totalDoItem <= 0
    ) {
        console.warn('Produto inválido, não adicionado à venda');
        return;
    }

    const idItem = Date.now().toString();
    const tbody  = document.getElementById('listaProdutos');
    const tr     = document.createElement('tr');
    tr.dataset.id = idItem;

    const tdProduto = document.createElement('td');
    tdProduto.textContent = nomeProduto;
    tr.appendChild(tdProduto);

    const tdQuantidade = document.createElement('td');
    tdQuantidade.textContent = quantidadeNumero;
    tr.appendChild(tdQuantidade);

    const tdValor = document.createElement('td');
    tdValor.textContent = 'R$ ' + valorUnitarioNumero.toFixed(2).replace('.', ',');
    tr.appendChild(tdValor);

    const tdTotal = document.createElement('td');
    tdTotal.textContent = 'R$ ' + totalDoItem.toFixed(2).replace('.', ',');
    tdTotal.classList.add('valorItem');
    tr.appendChild(tdTotal);

    const tdExcluir = document.createElement('td');
    const btnExcluir = document.createElement('button');
    btnExcluir.textContent = '🗑';
    tdExcluir.appendChild(btnExcluir);
    tr.appendChild(tdExcluir);

    tbody.appendChild(tr);

    calcularValorTotal();

    if (!Array.isArray(vendaAtual.produtos)) vendaAtual.produtos = [];

    vendaAtual.produtos.push({
        nome: nomeProduto,
        quantidade: quantidadeNumero,
        valorUnitario: valorUnitarioNumero,
        valorTotal: totalDoItem,
        valorDeCusto: await custoDoProduto(nomeProduto),
        id: idItem
    });

    produto.value      = '';
    quantidade.value   = '';
    valorVendido.value = '';
    totalItem.value    = '';
    produto.focus();

    btnExcluir.addEventListener('click', () => {
        const linha = btnExcluir.closest('tr');
        const id    = linha.dataset.id;
        vendaAtual.produtos = vendaAtual.produtos.filter(p => p.id !== id);
        linha.remove();
        calcularValorTotal();
    });
}

// ─────────────────────────────────────────────
// CUSTO DO PRODUTO
// ─────────────────────────────────────────────
async function custoDoProduto(nomeProduto) {
    const db     = firebase.firestore();
    const idLoja = localStorage.getItem('selecaoLoja');

    const snapshot = await db.collection('produtos')
        .where('idLoja', '==', idLoja)
        .where('nome', '==', nomeProduto)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const dados = snapshot.docs[0].data();
        return dados.valorCompra ?? 0;
    }

    return 0;
}

// ─────────────────────────────────────────────
// DESCONTO
// ─────────────────────────────────────────────
function valoresDesconto() {
    const valorTotalVenda = calcularValorTotal();

    const inputValorTotal      = document.getElementById('valorTotalPagamento');
    const inputDesconto$       = document.querySelector('[data-tipo="DESCONTO$"]');
    const inputDescontoPercent = document.querySelector('[data-tipo="DESCONTO%"]');

    let realValor    = valorTotalVenda;
    let quemDisparou = null;

    function formatarReal(valor)    { return 'R$ ' + valor.toFixed(2).replace('.', ','); }
    function formatarPercent(valor) { return valor.toFixed(2).replace('.', ',') + '%'; }
    function limparNumero(valor) {
        return Number(valor.replace('R$', '').replace('%', '').replace(/\D/g, '')) / 100;
    }

    inputValorTotal.value      = formatarReal(realValor);
    inputDesconto$.value       = 'R$ 0,00';
    inputDescontoPercent.value = '0,00%';

    // 🟡 FIX 5: os listeners de desconto/acréscimo são adicionados a cada
    // abertura do modal — para evitar acúmulo, clonamos os inputs e
    // substituímos os elementos, removendo listeners antigos.
    const novoDesconto$ = inputDesconto$.cloneNode(true);
    inputDesconto$.parentNode.replaceChild(novoDesconto$, inputDesconto$);

    const novoDescontoPercent = inputDescontoPercent.cloneNode(true);
    inputDescontoPercent.parentNode.replaceChild(novoDescontoPercent, inputDescontoPercent);

    novoDesconto$.value       = 'R$ 0,00';
    novoDescontoPercent.value = '0,00%';

    aplicarMascaraMoeda(novoDesconto$);
    novoDesconto$.addEventListener('input', atualizarPagamento);

    novoDesconto$.addEventListener("input", () => {
        if (quemDisparou === 'percent') return;
        quemDisparou = 'real';

        const descontoReal = limparNumero(novoDesconto$.value);

        if (descontoReal >= valorTotalVenda) {
            alert('O desconto não pode ser maior que o valor da venda');
            realValor                = valorTotalVenda;
            novoDesconto$.value      = 'R$ 0,00';
            novoDescontoPercent.value = '0,00%';
            inputValorTotal.value    = formatarReal(realValor);
            quemDisparou = null;
            return;
        }

        realValor = valorTotalVenda - descontoReal;
        const percentual = (descontoReal / valorTotalVenda) * 100;

        novoDesconto$.value       = descontoReal ? formatarReal(descontoReal) : 'R$ 0,00';
        novoDescontoPercent.value = descontoReal ? formatarPercent(percentual) : '0,00%';
        inputValorTotal.value     = formatarReal(realValor);

        quemDisparou = null;
    });

    novoDescontoPercent.addEventListener("input", () => {
        if (quemDisparou === 'real') return;
        quemDisparou = 'percent';

        const percentual  = limparNumero(novoDescontoPercent.value);
        const valorEmReal = (percentual / 100) * valorTotalVenda;

        if (valorEmReal >= valorTotalVenda) {
            alert('O desconto não pode ser maior que o valor da venda');
            realValor                = valorTotalVenda;
            novoDesconto$.value      = 'R$ 0,00';
            novoDescontoPercent.value = '0,00%';
            inputValorTotal.value    = formatarReal(realValor);
            quemDisparou = null;
            return;
        }

        realValor = valorTotalVenda - valorEmReal;

        novoDesconto$.value       = percentual ? formatarReal(valorEmReal) : 'R$ 0,00';
        novoDescontoPercent.value = percentual ? formatarPercent(percentual) : '0,00%';
        inputValorTotal.value     = formatarReal(realValor);

        quemDisparou = null;
    });
}

// ─────────────────────────────────────────────
// ACRÉSCIMO
// ─────────────────────────────────────────────
function valoresAcrescimo() {
    const valorTotalVenda = calcularValorTotal();

    const inputValorTotal       = document.getElementById('valorTotalPagamento');
    const inputDesconto$        = document.querySelector('[data-tipo="DESCONTO$"]');
    const inputDescontoPercent  = document.querySelector('[data-tipo="DESCONTO%"]');

    // 🟡 FIX 5: clona para remover listeners acumulados
    const inputAcrescimo$_old       = document.querySelector('[data-tipo="ACRECIMO$"]');
    const inputAcrescimoPercent_old = document.querySelector('[data-tipo="ACRECIMO%"]');

    const inputAcrescimo$ = inputAcrescimo$_old.cloneNode(true);
    inputAcrescimo$_old.parentNode.replaceChild(inputAcrescimo$, inputAcrescimo$_old);

    const inputAcrescimoPercent = inputAcrescimoPercent_old.cloneNode(true);
    inputAcrescimoPercent_old.parentNode.replaceChild(inputAcrescimoPercent, inputAcrescimoPercent_old);

    inputAcrescimo$.value       = 'R$ 0,00';
    inputAcrescimoPercent.value = '0,00%';

    aplicarMascaraMoeda(inputAcrescimo$);
    inputAcrescimo$.addEventListener('input', atualizarPagamento);

    let quemDisparou = null;

    function formatarMoeda(valor)   { return 'R$ ' + valor.toFixed(2).replace('.', ','); }
    function formatarPercent(valor) { return valor.toFixed(2).replace('.', ',') + '%'; }
    function pegarNumero(valor)     { return Number(valor.replace(/[^\d]/g, '')) / 100; }

    function zerarDesconto() {
        if (inputDesconto$)       inputDesconto$.value       = 'R$ 0,00';
        if (inputDescontoPercent) inputDescontoPercent.value = '0,00%';
    }

    inputValorTotal.value = formatarMoeda(valorTotalVenda);

    inputAcrescimo$.addEventListener('input', () => {
        if (quemDisparou === 'percent') return;
        quemDisparou = 'real';

        zerarDesconto();

        const valorEmReal = pegarNumero(inputAcrescimo$.value);
        const percentual  = (valorEmReal / valorTotalVenda) * 100;
        const totalFinal  = valorTotalVenda + valorEmReal;

        inputAcrescimo$.value       = formatarMoeda(valorEmReal);
        inputAcrescimoPercent.value = formatarPercent(percentual);
        inputValorTotal.value       = formatarMoeda(totalFinal);

        quemDisparou = null;
    });

    inputAcrescimoPercent.addEventListener('input', () => {
        if (quemDisparou === 'real') return;
        quemDisparou = 'percent';

        zerarDesconto();

        const percentual = pegarNumero(inputAcrescimoPercent.value);
        const valorEmReal = (percentual / 100) * valorTotalVenda;
        const totalFinal  = valorTotalVenda + valorEmReal;

        inputAcrescimoPercent.value = formatarPercent(percentual);
        inputAcrescimo$.value       = formatarMoeda(valorEmReal);
        inputValorTotal.value       = formatarMoeda(totalFinal);

        quemDisparou = null;
    });
}

// ─────────────────────────────────────────────
// TOTAL FINAL (com desconto, acréscimo e cashback)
// ─────────────────────────────────────────────
function getTotalFinal() {
    const totalBase = calcularValorTotal() || 0;

    const desconto = Number(
        document.querySelector('[data-tipo="DESCONTO$"]')
            .value.replace(/\D/g, '')
    ) / 100 || 0;

    const acrescimo = Number(
        document.querySelector('[data-tipo="ACRECIMO$"]')
            .value.replace(/\D/g, '')
    ) / 100 || 0;

    const subtotal = Math.max(totalBase - desconto + acrescimo, 0);

    const usarCashback = document.getElementById('usarCashback');

    if (!usarCashback || !usarCashback.checked) return subtotal;

    const cashbackDisponivel = document.getElementById('cashbackDisponivel');
    const cashbackInput = Number(
        cashbackDisponivel.value.replace(/\D/g, '')
    ) / 100 || 0;

    // 🟡 FIX 7: não dispara alert dentro de getTotalFinal() (chamada em
    // cada keystroke). A validação do cashback fica apenas no momento
    // em que o checkbox é marcado (listener abaixo).
    const cashbackUsado = cashbackInput <= subtotal ? cashbackInput : 0;

    return Math.max(subtotal - cashbackUsado, 0);
}

// ─────────────────────────────────────────────
// LISTENER DO CHECKBOX DE CASHBACK
// ─────────────────────────────────────────────
const usarCashback = document.getElementById('usarCashback');

if (usarCashback) {
    usarCashback.addEventListener('change', () => {
        if (usarCashback.checked) {
            // 🟡 FIX 7: validação feita aqui, uma única vez ao marcar
            const totalBase = calcularValorTotal() || 0;
            const desconto  = Number(
                document.querySelector('[data-tipo="DESCONTO$"]').value.replace(/\D/g, '')
            ) / 100 || 0;
            const acrescimo = Number(
                document.querySelector('[data-tipo="ACRECIMO$"]').value.replace(/\D/g, '')
            ) / 100 || 0;
            const subtotal  = Math.max(totalBase - desconto + acrescimo, 0);

            const cashbackDisponivel = document.getElementById('cashbackDisponivel');
            const cashbackInput = Number(
                cashbackDisponivel.value.replace(/\D/g, '')
            ) / 100 || 0;

            if (cashbackInput > subtotal) {
                alert("Você não pode usar o cashback nessa compra.");
                usarCashback.checked = false;
                return;
            }
        }

        atualizarPagamento();
    });
}

// ─────────────────────────────────────────────
// CASHBACK — EXIBIR SALDO DO CLIENTE
// 🔵 FIX 10: função agora é chamada no final do script
// ─────────────────────────────────────────────
async function mostrarCashbackDisponivel() {
    const db           = firebase.firestore();
    const inputCliente = document.getElementById('nomeCliente');

    inputCliente.addEventListener('change', async () => {
        const nome = inputCliente.value.trim();
        if (!nome) return;

        const snapshot = await db
            .collection("clientes")
            .where('nome', '==', nome)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log("Cliente não encontrado");
            return;
        }

        const dados = snapshot.docs[0].data();
        const cashbackTotal = dados.cashbackTotal || 0;

        document.getElementById('cashbackDisponivel').value =
            'R$ ' + cashbackTotal.toFixed(2).replace('.', ',');
    });
}

// ─────────────────────────────────────────────
// MÁSCARA DE MOEDA
// ─────────────────────────────────────────────
function aplicarMascaraMoeda(input) {
    if (!input) return;

    input.value = 'R$ 0,00';

    input.addEventListener('input', () => {
        let valor = input.value.replace(/\D/g, '');

        if (valor === '') {
            input.value = 'R$ 0,00';
            return;
        }

        valor = Number(valor) / 100;
        input.value = valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    });
}

// ─────────────────────────────────────────────
// ABRIR / FECHAR PAGAMENTO
// ─────────────────────────────────────────────
function abrirPagamento() {
    if (calcularValorTotal() === 0) {
        alert("Adicione itens à venda!");
        return;
    }

    // 🟡 FIX 5: valoresDesconto/valoresAcrescimo clonam os inputs internamente
    valoresDesconto();
    valoresAcrescimo();

    openScreen('pagamento');
}

function fecharPagamento() {
    document.querySelectorAll('.valorPagamento').forEach(input => {
        if (!input.readOnly) input.value = 'R$ 0,00';
    });

    const descontoReal    = document.querySelector('[data-tipo="DESCONTO$"]');
    const descontoPercent = document.querySelector('[data-tipo="DESCONTO%"]');
    if (descontoReal)    descontoReal.value    = 'R$ 0,00';
    if (descontoPercent) descontoPercent.value = '0,00%';

    const acrescimoReal    = document.querySelector('[data-tipo="ACRECIMO$"]');
    const acrescimoPercent = document.querySelector('[data-tipo="ACRECIMO%"]');
    if (acrescimoReal)    acrescimoReal.value    = 'R$ 0,00';
    if (acrescimoPercent) acrescimoPercent.value = '0,00%';

    setarMoedaBR(document.getElementById('valorTotalPagamento'), 0);
    setarMoedaBR(document.getElementById('valorRestante'), 0);
    setarMoedaBR(document.getElementById('troco'), 0);

    const pagamento = document.querySelector('.pagamento');
    const pdv       = document.querySelector('.pdv');
    if (pagamento) pagamento.style.display = 'none';
    if (pdv)       pdv.style.display       = 'flex';
}

// ─────────────────────────────────────────────
// ATUALIZAR VALORES DE PAGAMENTO (restante / troco)
// ─────────────────────────────────────────────
function atualizarPagamento() {
    const totalFinal = getTotalFinal();

    let totalPago = 0;
    document.querySelectorAll('.valorPagamento').forEach(input => {
        totalPago += Number(input.value.replace(/\D/g, '')) / 100 || 0;
    });

    const restante = totalFinal - totalPago;
    const troco    = totalPago - totalFinal;

    setarMoedaBR(document.getElementById('valorTotalPagamento'), totalFinal);

    if (restante > 0) {
        setarMoedaBR(document.getElementById('valorRestante'), restante);
        setarMoedaBR(document.getElementById('troco'), 0);
    } else {
        setarMoedaBR(document.getElementById('valorRestante'), 0);
        setarMoedaBR(document.getElementById('troco'), troco);
    }
}

// ─────────────────────────────────────────────
// APLICAR MÁSCARA E LISTENER NOS INPUTS DE PAGAMENTO
// 🟡 FIX 6: não aplica máscara de moeda em inputs de percentual
// ─────────────────────────────────────────────
document.querySelectorAll('input').forEach(input => {
    const tipo = input.dataset.tipo || '';

    // Pula inputs de percentual — não devem receber máscara de moeda
    if (tipo.includes('%')) return;

    if (input.classList.contains('valorPagamento') && !input.readOnly) {
        aplicarMascaraMoeda(input);
        input.addEventListener('input', atualizarPagamento);
    }

    // Inputs com data-tipo que NÃO são de percentual
    if (input.dataset.tipo && !tipo.includes('%')) {
        aplicarMascaraMoeda(input);
        input.addEventListener('input', atualizarPagamento);
    }
});

// ─────────────────────────────────────────────
// LIMPAR PDV
// ─────────────────────────────────────────────
function limparPDV() {
    const lista = document.getElementById("listaProdutos");
    if (lista) lista.innerHTML = "";

    vendaAtual = {
        produtos: [],
        meiosPagamento: [],
        totalVenda: 0
    };

    document.querySelectorAll(".valorPagamento").forEach(input => {
        input.value = "";
    });

    const nomeCliente = document.getElementById("nomeCliente");
    if (nomeCliente) nomeCliente.value = '';

    document.getElementById("totalVenda").value       = "0,00";
    document.getElementById("totalVendaAVista").value = "0,00";
}

// ─────────────────────────────────────────────
// UTILITÁRIO — SETAR MOEDA BR
// ─────────────────────────────────────────────
function setarMoedaBR(input, valor) {
    if (!input) return;
    input.value = Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// ─────────────────────────────────────────────
// CADASTRO DE CLIENTES
// ─────────────────────────────────────────────
async function cadastrarCliente() {
    const idLoja = localStorage.getItem('selecaoLoja');
    const db     = firebase.firestore();

    const nome                   = document.getElementById('nomeClienteCadastro');
    const dataNascimentoCliente  = document.getElementById('dataNascimentoCliente');
    const instagram              = document.getElementById('instagramCliente');
    const telefone               = document.getElementById('telefoneCliente');
    const cadastroCliente        = document.getElementById('cadastroCliente');

    const idCliente = crypto?.randomUUID?.() ??
        'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);

    const cliente = {
        nome:           nome.value,
        dataNascimento: dataNascimentoCliente.value,
        instagram:      instagram.value,
        telefone:       telefone.value,
        idCliente:      idCliente,
        idLoja:         idLoja
    };

    const clientes = await db.collection('clientes')
        .where('nome', '==', nome.value.trim())
        .get();

    if (!clientes.empty) {
        alert('Já existe um cliente com esse nome!');
        // 🔴 FIX 2: usar .value em vez de .textContent para limpar o input
        nome.value = '';
    } else {
        await db.collection('clientes').doc(cliente.idCliente).set(cliente);
        alert('Cliente registrado com sucesso!');
        cadastroCliente.style.display = 'none';
    }
}

// ─────────────────────────────────────────────
// CASHBACK — REGISTRAR / CONSUMIR
// ─────────────────────────────────────────────
async function cashbackClientes(nomeCliente, valorFinalVenda) {
    const db           = firebase.firestore();
    const idLoja       = localStorage.getItem('selecaoLoja');
    const usarCashback = document.getElementById('usarCashback');

    const snapshot = await db.collection('clientes')
        .where('nome', '==', nomeCliente)
        .where('idLoja', '==', idLoja)
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("Cliente não encontrado");
        return;
    }

    const doc         = snapshot.docs[0];
    const clienteRef  = db.collection('clientes').doc(doc.id);
    const dadosCliente = doc.data();

    const saldoAtual    = dadosCliente.cashbackTotal || 0;
    const valorCashback = valorFinalVenda * 0.02;

    if (usarCashback && usarCashback.checked && saldoAtual > 0) {
        const cashbackAtual = dadosCliente.cashback || [];
        const cashbackMovido = cashbackAtual.map(item => ({
            ...item,
            usadoEm: new Date()
        }));

        await clienteRef.set({
            cashbackTotal:     0,
            cashback:          [],
            cashbackHistorico: firebase.firestore.FieldValue.arrayUnion(...cashbackMovido)
        }, { merge: true });
    }

    if (valorCashback <= 0) return;

    const criadoEm = new Date();
    const expiraEm = new Date();
    expiraEm.setMonth(expiraEm.getMonth() + 2);

    await clienteRef.set({
        cashback: firebase.firestore.FieldValue.arrayUnion({
            valor:     valorCashback,
            criadoEm:  criadoEm,
            expiraEm:  expiraEm,
        }),
        cashbackTotal: firebase.firestore.FieldValue.increment(valorCashback)
    }, { merge: true });
}

// ─────────────────────────────────────────────
// DATALIST DE CLIENTES
// ─────────────────────────────────────────────
async function addDataListDados() {
    const db      = firebase.firestore();
    const clientes = await db.collection('clientes').orderBy('nome').get();

    const listaClientes = document.getElementById('listaClientes');

    clientes.forEach(doc => {
        const dados        = doc.data();
        const nomeCliente  = document.createElement('option');
        nomeCliente.value  = dados.nome;
        nomeCliente.textContent = dados.nome;
        listaClientes.appendChild(nomeCliente);
    });
}

// ─────────────────────────────────────────────
// Abrir Modal do caixa
// ─────────────────────────────────────────────
// Chame essa função ao carregar a página do PDV
async function verificarCaixa() {
    const idLoja = localStorage.getItem('selecaoLoja');

    // ✅ para antes de fazer query inútil
    if (!idLoja) {
        console.warn('Nenhuma loja selecionada');
        document.querySelector('.storeClose').style.display = 'flex';
        return;
    }

    const db = firebase.firestore();

    try {
        const snapshot = await db.collection('caixas')
            .where('idLoja', '==', idLoja)
            .where('status', '==', 'aberto')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            // ✅ salva o id do caixa encontrado pro resto do sistema usar
            const caixaDoc = snapshot.docs[0];
            localStorage.setItem('caixaAtualId', caixaDoc.id);

            document.querySelector('.storeClose').style.display = 'none';
        } else {
            localStorage.removeItem('caixaAtualId'); // ✅ limpa se não tiver caixa aberto
            document.querySelector('.storeClose').style.display = 'flex';
        }
    } catch (err) {
        console.error('Erro ao verificar caixa:', err);
        document.querySelector('.storeClose').style.display = 'flex'; // ✅ seguro em caso de erro
    }
}

function abrirModalCaixa() {
    const agora = new Date();
    const dataHora = agora.toLocaleString('pt-BR');
    const operador = localStorage.getItem('user')

    const db = firebase.firestore()

    Swal.fire({
        target: document.querySelector('.pdv'),
        customClass: { popup: "swal-caixa-popup" },
        showConfirmButton: false,
        html: `
            <div class="swal-caixa-wrap">

                <div class="swal-caixa-header">
                    <h2>🔓 Abrir Caixa</h2>
                    <p class="swal-caixa-subtitle">Preencha as informações para iniciar o caixa</p>
                </div>

                <!-- Identificação -->
                <div class="swal-caixa-section">
                    <div class="swal-caixa-section-head">
                        <span>Identificação</span>
                        <div class="swal-caixa-section-line"></div>
                    </div>

                    <div class="swal-caixa-field">
                        <label>Operador</label>
                        <input class="swal-caixa-input" id="caixa-operador" value="${operador}" disabled>
                    </div>

                    <div class="swal-caixa-field">
                        <label>Data / Hora de abertura</label>
                        <input class="swal-caixa-input" id="caixa-dataHora" value="${dataHora}" disabled>
                    </div>
                </div>

                <!-- Fundo de caixa -->
                <div class="swal-caixa-section">
                    <div class="swal-caixa-section-head">
                        <span>Fundo de Caixa</span>
                        <div class="swal-caixa-section-line"></div>
                    </div>

                    <div class="swal-caixa-field">
                        <label>Valor inicial (R$)</label>
                        <input 
                            class="swal-caixa-input" 
                            id="caixa-fundo" 
                            type="text"
                            placeholder="0,00"
                            inputmode="numeric"
                        >
                    </div>

                    <div class="swal-caixa-info">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>Este valor é o troco disponível no início do turno.</span>
                    </div>
                </div>

                <!-- Observações -->
                <div class="swal-caixa-section">
                    <div class="swal-caixa-section-head">
                        <span>Observações</span>
                        <div class="swal-caixa-section-line"></div>
                    </div>

                    <div class="swal-caixa-field">
                        <label>Anotações do turno (opcional)</label>
                        <textarea 
                            class="swal-caixa-input" 
                            id="caixa-obs"
                            rows="2"
                            placeholder="Ex: caixa com moedas limitadas..."
                            style="height:auto; padding: 10px 14px; resize: none;"
                        ></textarea>
                    </div>
                </div>

            </div>

            <!-- Botões -->
            <div class="swal-caixa-footer">
                <button class="swal-caixa-btn swal-caixa-btn-cancel" onclick="Swal.close()" title="Cancelar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <button class="swal-caixa-btn swal-caixa-btn-confirm" onclick="confirmarAberturaCaixa()" title="Abrir caixa">
                    <i class="fa-solid fa-check"></i>
                </button>
            </div>
        `
    });

    // Máscara simples para o fundo de caixa
    document.getElementById('caixa-fundo').addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '');
        v = (parseInt(v || '0') / 100).toFixed(2);
        this.value = v.replace('.', ',');
    });
}

async function confirmarAberturaCaixa() {
    const fundo = document.getElementById('caixa-fundo').value || '0,00';
    const obs   = document.getElementById('caixa-obs').value;
    const agora = new Date().toLocaleString('pt-BR');
    const idLoja = localStorage.getItem('selecaoLoja');

    const db = firebase.firestore()

    try {
        // Primeiro cria o documento vazio para pegar o ID
        const docRef = db.collection('caixas').doc();

        const registro = {
            id: docRef.id,       // <- ID dentro do documento
            operador: document.getElementById('caixa-operador').value,
            abertura: agora,
            fundo: fundo,
            observacao: obs,
            status: 'aberto',
            idLoja: idLoja,
        };

        // Agora salva com o ID já incluso
        await docRef.set(registro);

        localStorage.setItem('caixaAtualId', docRef.id);

        Swal.close();
        document.querySelector('.storeClose').style.display = 'none';

    } catch (err) {
        console.error('Erro ao abrir caixa:', err);
    }
}

const ICONES_PAGAMENTO = {
    dinheiro:  { icon: 'fa-money-bill-wave', bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
    pix:       { icon: 'fa-pix',             bg: 'rgba(0,189,174,0.15)',   color: '#00BDAE' },
    credito:   { icon: 'fa-credit-card',     bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    debito:    { icon: 'fa-credit-card',     bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    ifood:     { icon: 'fa-bag-shopping',    bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
};

function iconeParaTipo(tipo) {
    const key = normalizar(tipo);
    return ICONES_PAGAMENTO[key] ?? { icon: 'fa-circle-dot', bg: 'rgba(255,255,255,0.08)', color: '#fff' };
}

function formatarReais(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function abrirResumoCaixa() {
    const db = firebase.firestore();

    const idCaixa = localStorage.getItem('caixaAtualId');
    if (!idCaixa) return;

    const caixaDoc = await db.collection('caixas').doc(idCaixa).get();

    // ✅ verifica se o caixa existe
    if (!caixaDoc.exists) {
        Swal.fire({ icon: 'error', title: 'Caixa não encontrado', heightAuto: false });
        return;
    }

    const caixa = caixaDoc.data();

    const vendasSnap = await db.collection('vendas')
        .where('idCaixa', '==', idCaixa)
        .get();

    const vendas = vendasSnap.docs.map(d => d.data());
    const totalVendas = vendas.length;
    let totalGeral = 0;

    const porTipo = {};
    vendas.forEach(venda => {
        // ✅ garante que meiosPagamento existe
        (venda.meiosPagamento || []).forEach(mp => {
            const tipo = mp.tipoPagamento;
            if (!porTipo[tipo]) porTipo[tipo] = { valor: 0, qtd: 0 };
            porTipo[tipo].valor += mp.valor;
            porTipo[tipo].qtd++;
            totalGeral += mp.valor;
        });
    });

    // ✅ fundo seguro contra NaN
    const fundo = parseFloat((caixa.fundo ?? '0').replace(',', '.')) || 0;
    const chaveDinheiro = Object.keys(porTipo).find(k => normalizar(k) === 'dinheiro');
    const totalDinheiro = (chaveDinheiro ? porTipo[chaveDinheiro].valor : 0) + fundo;

    const linhasPagamento = Object.entries(porTipo).map(([tipo, dados]) => {
        const { icon, bg, color } = iconeParaTipo(tipo);
        return `
            <div class="swal-resumo-pagamento-row">
                <div class="swal-resumo-pagamento-left">
                    <div class="swal-resumo-pagamento-icon" style="background:${bg}; color:${color}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <div class="swal-resumo-pagamento-tipo">${tipo}</div>
                        <div class="swal-resumo-pagamento-qtd">${dados.qtd} venda${dados.qtd > 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div class="swal-resumo-pagamento-valor">${formatarReais(dados.valor)}</div>
            </div>
        `;
    }).join('');

    Swal.fire({
        customClass: { popup: 'swal-resumo-popup' },
        showConfirmButton: false,
        html: `
            <div class="swal-resumo-wrap">

                <div class="swal-resumo-header">
                    <h2>📊 Resumo do Caixa</h2>
                    <p class="swal-resumo-subtitle">Caixa aberto em ${caixa.abertura}</p>
                </div>

                <div class="swal-resumo-section">
                    <div class="swal-resumo-section-head">
                        <span>Identificação</span>
                        <div class="swal-resumo-section-line"></div>
                    </div>
                    <div class="swal-resumo-info-grid">
                        <div class="swal-resumo-info-item">
                            <label>Operador</label>
                            <span>${caixa.operador}</span>
                        </div>
                        <div class="swal-resumo-info-item">
                            <label>Fundo de caixa</label>
                            <span>${formatarReais(fundo)}</span>
                        </div>
                        ${caixa.observacao ? `
                        <div class="swal-resumo-info-item" style="grid-column: span 2">
                            <label>Observação</label>
                            <span>${caixa.observacao}</span>
                        </div>` : ''}
                    </div>
                </div>

                <div class="swal-resumo-section">
                    <div class="swal-resumo-section-head">
                        <span>Meios de Pagamento</span>
                        <div class="swal-resumo-section-line"></div>
                    </div>
                    ${linhasPagamento || '<p style="color:rgba(255,255,255,0.35); font-size:13px">Nenhuma venda registrada.</p>'}
                </div>

                <div class="swal-resumo-section">
                    <div class="swal-resumo-section-head">
                        <span>Total</span>
                        <div class="swal-resumo-section-line"></div>
                    </div>
                    <div class="swal-resumo-total-row">
                        <span class="swal-resumo-total-label">Total em vendas</span>
                        <div>
                            <div class="swal-resumo-total-valor">${formatarReais(totalGeral)}</div>
                            <div class="swal-resumo-total-vendas">${totalVendas} venda${totalVendas !== 1 ? 's' : ''} no total</div>
                        </div>
                    </div>
                </div>

            </div>

            <div class="swal-resumo-footer">
                <button class="swal-resumo-btn swal-resumo-btn-close" onclick="Swal.close()">
                    <i class="fa-solid fa-xmark"></i> Fechar
                </button>
                <button class="swal-resumo-btn swal-resumo-btn-fechar" onclick="abrirFecharCaixa(${totalDinheiro}, ${totalGeral})">
                    <i class="fa-solid fa-lock"></i> Fechar Caixa
                </button>
            </div>
        `
    });
}

function abrirFecharCaixa(totalDinheiro, totalEmVendas) {
    totalDinheiro = isNaN(totalDinheiro) ? 0 : totalDinheiro;
    totalEmVendas = isNaN(totalEmVendas) ? 0 : totalEmVendas;

    Swal.fire({
        customClass: { popup: 'swal-fechar-popup' },
        showConfirmButton: false,
        html: `
            <div class="swal-fechar-wrap">

                <div class="swal-fechar-header">
                    <h2>🔒 Fechar Caixa</h2>
                    <p class="swal-fechar-subtitle">Confira o valor em caixa antes de fechar</p>
                </div>

                <div class="swal-fechar-section">
                    <div class="swal-fechar-section-head">
                        <span>Conferência</span>
                        <div class="swal-fechar-section-line"></div>
                    </div>

                    <div class="swal-fechar-field">
                        <label>Total esperado em dinheiro (R$)</label>
                        <input 
                            class="swal-fechar-input" 
                            id="fechar-esperado"
                            value="${formatarReais(totalDinheiro)}"
                            disabled
                        >
                    </div>

                    <div class="swal-fechar-field">
                        <label>Valor contado no caixa (R$)</label>
                        <input 
                            class="swal-fechar-input" 
                            id="fechar-contado"
                            type="text"
                            placeholder="0,00"
                            inputmode="numeric"
                        >
                    </div>

                    <div class="swal-fechar-diferenca neutro" id="fechar-diferenca">
                        <span>Diferença</span>
                        <span id="fechar-diferenca-valor">—</span>
                    </div>
                </div>

                <div class="swal-fechar-section">
                    <div class="swal-fechar-section-head">
                        <span>Observações</span>
                        <div class="swal-fechar-section-line"></div>
                    </div>
                    <div class="swal-fechar-field">
                        <label>Anotações (opcional)</label>
                        <textarea 
                            class="swal-fechar-input" 
                            id="fechar-obs"
                            rows="2"
                            placeholder="Ex: falta de troco, retirada feita..."
                            style="height:auto; padding:10px 14px; resize:none;"
                        ></textarea>
                    </div>
                </div>

            </div>

            <div class="swal-resumo-footer">
                <button class="swal-resumo-btn swal-resumo-btn-close" onclick="abrirResumoCaixa()">
                    <i class="fa-solid fa-arrow-left"></i> Voltar
                </button>
                <button class="swal-resumo-btn swal-resumo-btn-fechar" onclick="confirmarFechamentoCaixa(${totalDinheiro}, ${totalEmVendas})">
                    <i class="fa-solid fa-lock"></i> Fechar Caixa
                </button>
            </div>
        `
    });

    document.getElementById('fechar-contado').addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '');
        v = (parseInt(v || '0') / 100).toFixed(2);
        this.value = v.replace('.', ',');

        const contado = parseFloat(v) || 0; // ✅ seguro contra NaN
        const diferenca = contado - totalDinheiro;
        const el = document.getElementById('fechar-diferenca');
        const elValor = document.getElementById('fechar-diferenca-valor');
        const elLabel = el.querySelector('span');

        elValor.textContent = formatarReais(Math.abs(diferenca));
        el.className = 'swal-fechar-diferenca ' + (
            diferenca > 0 ? 'positivo' :
            diferenca < 0 ? 'negativo' : 'neutro'
        );
        elLabel.textContent = diferenca > 0 ? 'Sobra' : diferenca < 0 ? 'Falta' : 'Certo';
    });
}

async function confirmarFechamentoCaixa(totalDinheiro, totalEmVendas) {
    const idCaixa = localStorage.getItem('caixaAtualId');
    const contado = document.getElementById('fechar-contado').value || '0,00';
    const obs     = document.getElementById('fechar-obs').value;
    const agora   = new Date().toLocaleString('pt-BR');

    // ✅ seguro contra NaN
    const contadoNum = parseFloat(contado.replace(',', '.')) || 0;
    const diferenca  = contadoNum - totalDinheiro;

    const db = firebase.firestore();

    await db.collection('caixas').doc(idCaixa).update({
        status: 'fechado',
        fechamento: agora,
        valorContado: contado,
        totalVendido: formatarReais(totalEmVendas),
        totalEsperadoDinheiro: formatarReais(totalDinheiro),
        diferenca: formatarReais(Math.abs(diferenca)),
        tipoDiferenca: diferenca > 0 ? 'sobra' : diferenca < 0 ? 'falta' : 'correto',
        observacaoFechamento: obs
    });

    localStorage.removeItem('caixaAtualId');

    Swal.close();
    document.querySelector('.storeClose').style.display = 'flex';
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
verificarCaixa()
addDataListDados();
autoComplete();
mostrarCashbackDisponivel(); // 🔵 FIX 10: chamada que estava faltando
