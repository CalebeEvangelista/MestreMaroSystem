let vendaAtual = {
    produtos: [],
    meiosPagamento: [],
    totalVenda: 0
}

//FUNÇÃO PARA REGISTRAR A VENDA NO BD
async function registrarVenda() {
    const pErro = document.getElementById('erroPagamento');
    if (pErro) pErro.style.display = 'none';

    const totalPagamentos = await calcularMeiosDePagamento();

    if (totalPagamentos === 0 || getTotalFinal() > totalPagamentos) {
        pErro.style.display = 'flex';
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
    inputProduto.focus()

}

//FUNÇÃO ONDE CALCULA OS MEIOS DE PAGAMENTO NO PDV E COLOCAR O VALOR DAS TAXAS
async function calcularMeiosDePagamento() {
    try {
        const db = firebase.firestore();
        const idLoja = localStorage.getItem('selecaoLoja');

        //PUXA OS MEIOS DE PAGAMENTO NO HTML POR QUERY
        const meiosDePagamento = document.querySelectorAll('.valorPagamento[data-tipo]');
        let total = 0;

        // ZERA O ARRAY DE VENDAATUAL PARA NÃO PUXAR NADA DE VENDAS ANTIGAS
        vendaAtual.meiosPagamento = [];

        //PEGA O SNAPSHOP A PARTIR DO ID DA LOJA
        const snapshot = await db.collection('lojas').where('id', '==', idLoja).get();

        if (snapshot.empty) {
            console.log("Loja não encontrada");
            return 0;
        }

        //PUXA OS DADOS DA LOJA E OS VALORES DAS TAXAS
        const loja = snapshot.docs[0].data();
        const taxasDaLoja = loja.taxas || {};

        meiosDePagamento.forEach(input => {
            //CASO ELE IDENTIFICAR QUE É VALORRESTANTE OU TROCO ELE FINALIZA O FOREACH
            if (input.id === 'valorRestante' || input.id === 'troco') return;

            //TIRA TUDO E DEIXA SOMENTE OS NUMEROS
            const valorNumerico = Number(
                input.value
                    .replace(/[^\d.,]/g, '')
                    .replace(/\./g, '')
                    .replace(',', '.')
            );

            if (isNaN(valorNumerico) || valorNumerico <= 0) return;

            //MINI FUNÇÃO PRA NORMALIZAR O TEXTO TIRANDO ACENTO E PADRONIZANDO
            function normalizar(texto) {
                return (texto || '')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim();
            }

            const tipoInput = normalizar(input.dataset.tipo);

            //AQUI ELE TRANSFORMA O OBJETO MAP EM ARRAY E PROCURA A TAXA QUE ENCAIXA COM O NEGOCIO
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
                console.log(`Taxa de ${tipoInput}:`, taxa);
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

//FUNÇÕES DE GERAR O PIX
function pix() {
    const pix = document.querySelector('[data-tipo="PIX"]');
    const pixNumerico = Number(pix.value
            .replace(/[^\d.,]/g, '')
            .replace(',','.')
        );

    if (pixNumerico == 0) {
        alert('Digite um valor antes de gerar o PIX')
    } else {
        gerarPixEEnviarTelegram(pixNumerico)
    }
}

//FUNÇÃO DE IMPRESSÃO DO PEDIDO
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
        customClass: {
            popup: "swal-venda-popup"
        }
    });

    let enderecoEntrega = "";
    let numeroEntrega = "";
    let valorEntrega = 0;

    let nomeCliente =
        vendaAtual?.cliente?.trim?.() ||
        vendaAtual?.nomeCliente?.trim?.() ||
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
            customClass: {
                popup: "swal-venda-popup"
            },
            preConfirm: () => {
                const nome = document.getElementById("nomeEntrega").value.trim();
                const rua = document.getElementById("ruaEntrega").value.trim();
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

        nomeCliente = resultEndereco.value.nome;
        numeroEntrega = resultEndereco.value.numero;
        enderecoEntrega = `${resultEndereco.value.rua} - ${resultEndereco.value.bairro}`;

        const resultTaxa = await Swal.fire({
            title: "Valor da entrega",
            input: "number",
            inputPlaceholder: "Ex: 5.00",
            inputValue: 0,
            inputAttributes: {
                step: "0.01",
                min: "0"
            },
            showCancelButton: true,
            confirmButtonText: "Continuar",
            cancelButtonText: "Sem taxa",
            confirmButtonColor: "#2a9d8f",
            heightAuto: false,
            customClass: {
                popup: "swal-venda-popup"
            }
        });

        if (resultTaxa.dismiss === Swal.DismissReason.cancel) {
            valorEntrega = 0;
        } else {
            valorEntrega = resultTaxa.value ? Number(resultTaxa.value) : 0;
        }
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
        customClass: {
            popup: "swal-venda-popup"
        }
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

                const nome = colunas[0].textContent.trim();
                const quantidade = Number(colunas[1].textContent.trim()) || 0;

                const valorTexto = colunas[2].textContent
                    .replace("R$", "")
                    .replace(/\./g, "")
                    .replace(",", ".")
                    .trim();

                const valorTotal = Number(valorTexto) || 0;

                if (!nome || nome.toLowerCase().includes("nenhum produto")) {
                    return null;
                }

                return {
                    nome,
                    quantidade,
                    valorTotal
                };
            }).filter(Boolean);
        }
    }

    let total = 0;

    if (typeof getTotalFinal === "function") {
        total = Number(getTotalFinal()) || 0;
    }

    if (!total) {
        total = Number(vendaAtual?.totalVenda || vendaAtual?.total || 0);
    }

    if (!total) {
        const elTotal = document.getElementById("totalVenda");
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

    const logoPath = "/IMAGENS/LOGOPRETOMONOCROMATICO.png"; // coloque o caminho da sua logo aqui

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
            @page{
                size:80mm auto;
                margin:0;
            }

            body{
                width:80mm;
                font-family:Arial, sans-serif;
                margin:0;
                padding:4mm;
                color:#000;
                font-size:12px;
            }

            .logo{
                text-align:center;
                margin-bottom:6px;
            }

            .logo img{
                max-width:60mm;
                max-height:45px;
            }

            .titulo{
                text-align:center;
                font-weight:bold;
                font-size:16px;
                margin-bottom:8px;
            }

            .linha{
                border-top:1px dashed #000;
                margin:8px 0;
            }

            .cliente{
                margin-bottom:8px;
                font-size:12px;
                line-height:1.5;
                word-break:break-word;
            }

            table{
                width:100%;
                border-collapse:collapse;
                font-size:12px;
            }

            th{
                border-bottom:1px solid #000;
                padding-bottom:4px;
                text-align:left;
            }

            td{
                padding:4px 0;
            }

            .obs{
                margin-top:8px;
                font-size:12px;
            }

            .obs-box{
                border-top:1px dashed #000;
                border-bottom:1px dashed #000;
                padding:6px 0;
                margin:6px 0;
                white-space:pre-line;
                word-break:break-word;
            }

            .totais{
                margin-top:8px;
                font-size:13px;
                font-weight:bold;
            }

            .totais div{
                display:flex;
                justify-content:space-between;
                margin-top:4px;
            }

            .rodape{
                text-align:center;
                margin-top:10px;
                font-size:11px;
            }
        </style>
    </head>

    <body>

        <div class="logo">
            <img src="${logoPath}">
        </div>

        <div class="linha"></div>

        <div class="cliente">
            <div><strong>Cliente:</strong> ${nomeCliente || "Sem Nome"}</div>
            ${endereco ? `<div><strong>Endereço:</strong> ${endereco}, ${numero}</div>` : `<div><strong>Tipo:</strong> Balcão / Retirada</div>`}
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

            <div class="obs-box">
                ${observacoes || "Sem observações"}
            </div>
        </div>

        <div class="totais">

            <div>
                <span>Total pedido</span>
                <span>R$ ${Number(total || 0).toFixed(2).replace(".", ",")}</span>
            </div>

            <div>
                <span>Entrega</span>
                <span>R$ ${Number(valorEntrega || 0).toFixed(2).replace(".", ",")}</span>
            </div>

            <div>
                <span>Total final</span>
                <span>R$ ${totalFinal.toFixed(2).replace(".", ",")}</span>
            </div>

        </div>

        <div class="linha"></div>

        <div class="rodape">
            Obrigado pela preferência, fique atento nas novidades @EsquentaDoPovo
        </div>

        <script>
            window.onload = function(){
                window.print();
                window.close();
            }
        <\/script>

    </body>
    </html>
    `)

    janela.document.close()
}

function abrirModalImpressaoPedido(){
    imprimirPedido();
}

//FUNÇÃO DE COMPLETAR O NOME DO PRODUTO NO PDV E ADICIONAR INFORMAÇOES NA TELA
function autoComplete() {
    const inputProduto = document.getElementById("produto");
    const quantidade = document.getElementById("quantidade");
    const idLoja = localStorage.getItem('selecaoLoja');
    const db = firebase.firestore();

    // Cria datalist se não existir
    let dataList = document.getElementById('listaProdutosSugestao');
    if (!dataList) {
        dataList = document.createElement("datalist");
        dataList.id = "listaProdutosSugestao";
        document.body.appendChild(dataList);
    }
    inputProduto.setAttribute("list", "listaProdutosSugestao");

    // Carrega todos os produtos da loja uma vez
    (async () => {
        const snapshot = await db.collection("produtos")
            .where("idLoja", "==", idLoja)
            .orderBy("nome")
            .get();

        dataList.innerHTML = ''; // garante que esteja limpo
        snapshot.forEach(doc => {
            const produto = doc.data();

            const opt = document.createElement('option');
            opt.value = produto.nome;                        // texto visível no input
            opt.dataset.preco = produto.valorVenda;          // preço normal
            opt.dataset.qtdAtacado = produto.qtdAtacado || 0;
            opt.dataset.valorAtacado = produto.valorAtacado || produto.valorVenda;

            dataList.appendChild(opt);
        });
    })();

    // Quando o usuário seleciona um produto (clicando ou setas+Enter)
    inputProduto.addEventListener("input", () => {
        const selecionado = inputProduto.value;
        const option = Array.from(document.querySelectorAll("#listaProdutosSugestao option"))
            .find(o => o.value === selecionado);
        if (!option) return;

        // Atualiza preço do produto
        const preco = Number(option.dataset.preco);
        document.getElementById("valorVendido").value = preco.toFixed(2).replace('.', ',');

        // Foca imediatamente no input de quantidade
        quantidade.focus();
    });

    // Atualiza preço e total do item se quantidade >= atacado
    quantidade.addEventListener("change", () => {
        const nomeProduto = inputProduto.value || '';
        const option = Array.from(document.querySelectorAll("#listaProdutosSugestao option"))
            .find(o => o.value === nomeProduto);
        if (!option) return;

        const quantidadeDigitada = Number(quantidade.value);
        const precoDigitado = document.getElementById('valorVendido');

        if (quantidadeDigitada >= Number(option.dataset.qtdAtacado)) {
            const valorAtacado = Number(option.dataset.valorAtacado);
            precoDigitado.value = valorAtacado.toFixed(2).replace('.', ',');
            const inputTotal = document.getElementById("totalItem");
            inputTotal.value = (valorAtacado * quantidadeDigitada).toFixed(2).replace('.', ',');
        }
    });

    // Atalhos de teclado
    document.addEventListener("keydown", (event) => {
        if (event.key === "Shift") {
            event.preventDefault();

            const produto = document.getElementById('produto').value.trim();
            const quantidade = document.getElementById('quantidade').value.trim();
            const valorVendido = document.getElementById('valorVendido').value.trim();

            if (!produto || !quantidade || !valorVendido) {
                console.warn("Preencha produto, quantidade e preço antes de adicionar");
                return;
            }

            addToShoppingList(); // adiciona ao shopping list
        }
        if (event.key === "Enter") {
            event.preventDefault();
            abrirPagamento();
        }
        if (event.key === "F10") {
            event.preventDefault();
            registrarVenda()
        }

    });
}

function itensQuantidades() {
    const inputQtd = document.getElementById("quantidade");
    const inputValor = document.getElementById("valorVendido");
    const inputTotal = document.getElementById("totalItem");

    function formatarMoedaInput(input) {
        let valor = input.value.replace(/\D/g, "");

        valor = (Number(valor) / 100).toFixed(2);

        input.value = valor.replace(".", ",");
    }

    function atualizarTotal() {
        const qtd = Number(inputQtd.value) || 0;
        const valor = Number(inputValor.value.replace(",", ".")) || 0;

        const total = qtd * valor;

        inputTotal.value = total.toLocaleString("pt-BR", {
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

function calcularValorTotal() {
    let total = 0;

    document.querySelectorAll(".valorItem").forEach(item => {
        const totalVenda = document.getElementById("totalVenda")
        const totalVendaAVista = document.getElementById("totalVendaAVista")

        const valor = Number(
            item.textContent
                .replace("R$", "")
                .replace(".", "")
                .replace(",", ".")
                .trim()
        );

        total += valor;
        
        totalVenda.value = total.toFixed(2).replace(".", ",")
        totalVendaAVista.value = (total + (total * 0.05)).toFixed(2).replace(".", ",")
    });

    if (total == 0){
        return '0,00'
    } else {
        return total
    }
}

async function addToShoppingList() {
    const produto = document.getElementById('produto')
    const quantidade = document.getElementById('quantidade')
    const valorVendido = document.getElementById('valorVendido')
    const totalItem = document.getElementById('totalItem')

    const nomeProduto = produto.value.trim()
    const quantidadeNumero = Number(quantidade.value)
    const valorUnitarioNumero = Number(String(valorVendido.value).replace(',', '.'))

    let totalDoItem = 0
    if (quantidadeNumero === 1) {
        totalDoItem = valorUnitarioNumero
    } else {
        totalDoItem = Number(String(totalItem.value).replace(',', '.'))
    }

    if (
        !nomeProduto ||
        !quantidadeNumero ||
        quantidadeNumero <= 0 ||
        !valorUnitarioNumero ||
        valorUnitarioNumero <= 0 ||
        !totalDoItem ||
        totalDoItem <= 0
    ) {
        console.warn('Produto inválido, não adicionado à venda')
        return
    }

    const idItem = Date.now().toString()
    const tbody = document.getElementById('listaProdutos')
    const tr = document.createElement('tr')
    tr.dataset.id = idItem

    // Produto
    const tdProduto = document.createElement('td')
    tdProduto.textContent = nomeProduto
    tr.appendChild(tdProduto)

    // Quantidade
    const tdQuantidade = document.createElement('td')
    tdQuantidade.textContent = quantidadeNumero
    tr.appendChild(tdQuantidade)

    // Valor unitário
    const tdValor = document.createElement('td')
    tdValor.textContent = 'R$ ' + valorUnitarioNumero.toFixed(2).replace('.', ',')
    tr.appendChild(tdValor)

    // Total do item
    const tdTotal = document.createElement('td')
    tdTotal.textContent = 'R$ ' + totalDoItem.toFixed(2).replace('.', ',')
    tdTotal.classList.add('valorItem')
    tr.appendChild(tdTotal)

    // Botão de exclusão
    const tdExcluir = document.createElement('td')
    const btnExcluir = document.createElement('button')
    btnExcluir.textContent = '🗑'
    tdExcluir.appendChild(btnExcluir)
    tr.appendChild(tdExcluir)

    tbody.appendChild(tr)

    calcularValorTotal()

    if (!Array.isArray(vendaAtual.produtos)) {
        vendaAtual.produtos = []
    }

    vendaAtual.produtos.push({
        nome: nomeProduto,
        quantidade: quantidadeNumero,
        valorUnitario: valorUnitarioNumero,
        valorTotal: totalDoItem,
        valorDeCusto: await custoDoProduto(nomeProduto),
        id: idItem
    })

    produto.value = ''
    quantidade.value = ''
    valorVendido.value = ''
    totalItem.value = ''

    produto.focus()

    btnExcluir.addEventListener('click', () => {
        const linha = btnExcluir.closest('tr')
        const id = linha.dataset.id
        vendaAtual.produtos = vendaAtual.produtos.filter(produto => produto.id !== id)
        linha.remove()
        calcularValorTotal()
    })
}

async function custoDoProduto(nomeProduto) {
    const db = firebase.firestore();
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

function valoresDesconto() {
    const valorTotalVenda = calcularValorTotal()

    const inputValorTotal = document.getElementById('valorTotalPagamento')
    const inputDesconto$ = document.querySelector('[data-tipo="DESCONTO$"]')
    const inputDescontoPercent = document.querySelector('[data-tipo="DESCONTO%"]')

    let realValor = valorTotalVenda
    let quemDisparou = null

    // ===== FUNÇÕES AUXILIARES =====
    function formatarReal(valor) {
        return 'R$ ' + valor.toFixed(2).replace('.', ',')
    }

    function formatarPercent(valor) {
        return valor.toFixed(2).replace('.', ',') + '%'
    }

    // limpa input e considera centavos
    function limparNumero(valor) {
        return Number(
            valor
                .replace('R$', '')
                .replace('%', '')
                .replace(/\D/g, '')
        ) / 100
    }

    // valor inicial
    inputValorTotal.value = formatarReal(realValor)
    inputDesconto$.value = 'R$ 0,00'
    inputDescontoPercent.value = '0,00%'

    // ===== DESCONTO EM R$ =====
    inputDesconto$.addEventListener("input", () => {
        if (quemDisparou === 'percent') return
        quemDisparou = 'real'

        const descontoReal = limparNumero(inputDesconto$.value)

        if (descontoReal >= valorTotalVenda) {
            alert('O desconto não pode ser maior que o valor da venda')

            realValor = valorTotalVenda
            inputDesconto$.value = ''
            inputDescontoPercent.value = ''
            inputValorTotal.value = formatarReal(realValor)

            quemDisparou = null
            return
        }

        realValor = valorTotalVenda - descontoReal
        const percentual = (descontoReal / valorTotalVenda) * 100

        inputDesconto$.value = descontoReal ? formatarReal(descontoReal) : ''
        inputDescontoPercent.value = descontoReal ? formatarPercent(percentual) : ''
        inputValorTotal.value = formatarReal(realValor)

        quemDisparou = null
    })

    // ===== DESCONTO EM % =====
    inputDescontoPercent.addEventListener("input", () => {
        if (quemDisparou === 'real') return
        quemDisparou = 'percent'

        const percentual = limparNumero(inputDescontoPercent.value)
        const valorEmReal = (percentual / 100) * valorTotalVenda

        if (valorEmReal >= valorTotalVenda) {
            alert('O desconto não pode ser maior que o valor da venda')

            realValor = valorTotalVenda
            inputDesconto$.value = ''
            inputDescontoPercent.value = ''
            inputValorTotal.value = formatarReal(realValor)

            quemDisparou = null
            return
        }

        realValor = valorTotalVenda - valorEmReal

        inputDesconto$.value = percentual ? formatarReal(valorEmReal) : ''
        inputDescontoPercent.value = percentual ? formatarPercent(percentual) : ''
        inputValorTotal.value = formatarReal(realValor)

        quemDisparou = null
    })
}

function valoresAcrescimo() {
    const valorTotalVenda = calcularValorTotal()

    const inputValorTotal = document.getElementById('valorTotalPagamento')

    const inputAcrescimo$ = document.querySelector('[data-tipo="ACRECIMO$"]')
    const inputAcrescimoPercent = document.querySelector('[data-tipo="ACRECIMO%"]')

    const inputDesconto$ = document.querySelector('[data-tipo="DESCONTO$"]')
    const inputDescontoPercent = document.querySelector('[data-tipo="DESCONTO%"]')

    let quemDisparou = null

    // ===== FUNÇÕES AUXILIARES =====
    function formatarMoeda(valor) {
        return 'R$ ' + valor.toFixed(2).replace('.', ',')
    }

    function formatarPercent(valor) {
        return valor.toFixed(2).replace('.', ',') + '%'
    }

    function pegarNumero(valor) {
        return Number(valor.replace(/[^\d]/g, '')) / 100
    }

    function zerarDesconto() {
        inputDesconto$.value = 'R$ 0,00'
        inputDescontoPercent.value = '0,00%'
    }

    // valor inicial
    inputValorTotal.value = formatarMoeda(valorTotalVenda)
    inputAcrescimo$.value = 'R$ 0,00'
    inputAcrescimoPercent.value = '0,00%'

    // ===== ACRÉSCIMO EM R$ =====
    inputAcrescimo$.addEventListener('input', () => {
        if (quemDisparou === 'percent') return
        quemDisparou = 'real'

        zerarDesconto()

        const valorEmReal = pegarNumero(inputAcrescimo$.value)
        const percentual = (valorEmReal / valorTotalVenda) * 100
        const totalFinal = valorTotalVenda + valorEmReal

        inputAcrescimo$.value = formatarMoeda(valorEmReal)
        inputAcrescimoPercent.value = formatarPercent(percentual)
        inputValorTotal.value = formatarMoeda(totalFinal)

        quemDisparou = null
    })

    // ===== ACRÉSCIMO EM % =====
    inputAcrescimoPercent.addEventListener('input', () => {
        if (quemDisparou === 'real') return
        quemDisparou = 'percent'

        zerarDesconto()

        const percentual = pegarNumero(inputAcrescimoPercent.value)
        const valorEmReal = (percentual / 100) * valorTotalVenda
        const totalFinal = valorTotalVenda + valorEmReal

        inputAcrescimoPercent.value = formatarPercent(percentual)
        inputAcrescimo$.value = formatarMoeda(valorEmReal)
        inputValorTotal.value = formatarMoeda(totalFinal)

        quemDisparou = null
    })
}

function getTotalFinal() {
    const totalBase = calcularValorTotal() || 0

    const desconto = Number(
        document.querySelector('[data-tipo="DESCONTO$"]')
        .value.replace(/\D/g, '')
    ) / 100 || 0

    const acrescimo = Number(
        document.querySelector('[data-tipo="ACRECIMO$"]')
        .value.replace(/\D/g, '')
    ) / 100 || 0

    // 🔹 Primeiro calcula o subtotal (sem cashback)
    const subtotal = Math.max(totalBase - desconto + acrescimo, 0)

    const usarCashback = document.getElementById('usarCashback')

    if (!usarCashback || !usarCashback.checked) {
        return subtotal
    }

    // 🔹 Cashback
    const cashbackDisponivel = document.getElementById('cashbackDisponivel')
    const cashbackInput = Number(
        cashbackDisponivel.value.replace(/\D/g, '')
    ) / 100 || 0

    // Não permite usar mais cashback do que o valor da compra
    /*const cashbackUsado = Math.min(cashbackInput, subtotal)

    const totalFinal = subtotal - cashbackUsado

    return Math.max(totalFinal, 0)*/

    let cashbackUsado = 0

    if (usarCashback.checked) {

        if (cashbackInput <= subtotal) {
            cashbackUsado = cashbackInput
        } else {
            // bloqueia uso
            cashbackUsado = 0
            alert("Você não pode usar o cashback nessa compra.")

            usarCashback.checked = false
        }
    }

    const totalFinal = subtotal - cashbackUsado
    return totalFinal
}

// PUXAR A ALTERAÇÃO DO CHECKBOX PARA USAR O CASHBACK
const usarCashback = document.getElementById('usarCashback')

if (usarCashback) {
    usarCashback.addEventListener('change', atualizarPagamento)
}

// DETECTAR A ADIÇÃO DO NOME DO MALUGANGO PRA PUXAR O CASHBACK DELE
async function mostrarCashbackDisponivel() {
    const db = firebase.firestore()
    const inputCliente = document.getElementById('nomeCliente')

    inputCliente.addEventListener('change', async () => {

        const nome = inputCliente.value.trim()

        if (!nome) return

        const snapshot = await db
            .collection("clientes")
            .where('nome', '==', nome)
            .limit(1)
            .get()

        if (snapshot.empty) {
            console.log("Cliente não encontrado")
            return
        }

        const dados = snapshot.docs[0].data()

       /* const cashbackDisponivel = document.getElementById('cashbackDisponivel')
        cashbackDisponivel.textContent = 'R$' + dados.cashbackTotal.toFixed(2).replace('.',',') */

        console.log("Cashback disponível:", dados.cashbackTotal || 0)

        document.getElementById('cashbackDisponivel').value = 'R$' + dados.cashbackTotal.toFixed(2).replace('.',',') || 0
    })
}

function aplicarMascaraMoeda(input) {
    // se o input não existir, sai da função
    if (!input) return

    input.value = 'R$ 0,00'

    input.addEventListener('input', () => {
        let valor = input.value.replace(/\D/g, '')

        if (valor === '') {
            input.value = 'R$ 0,00'
            return
        }

        valor = Number(valor) / 100

        input.value = valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        })
    })
}

function abrirPagamento() {
    if (calcularValorTotal() === 0) {
        alert("Adicione itens à venda!");
        return;
    }

    valoresDesconto();
    valoresAcrescimo();

    openScreen('pagamento');
}

function fecharPagamento() {

    // ===== LIMPA MEIOS DE PAGAMENTO =====
    document.querySelectorAll('.valorPagamento').forEach(input => {
        if (!input.readOnly) {
            input.value = 'R$ 0,00'
        }
    })

    // ===== LIMPA DESCONTO =====
    const descontoReal = document.querySelector('[data-tipo="DESCONTO$"]')
    const descontoPercent = document.querySelector('[data-tipo="DESCONTO%"]')

    if (descontoReal) descontoReal.value = 'R$ 0,00'
    if (descontoPercent) descontoPercent.value = '0,00%'

    // ===== LIMPA ACRÉSCIMO =====
    const acrescimoReal = document.querySelector('[data-tipo="ACRECIMO$"]')
    const acrescimoPercent = document.querySelector('[data-tipo="ACRECIMO%"]')

    if (acrescimoReal) acrescimoReal.value = 'R$ 0,00'
    if (acrescimoPercent) acrescimoPercent.value = '0,00%'

    // ===== LIMPA CAMPOS DE SISTEMA =====
    setarMoedaBR(document.getElementById('valorTotalPagamento'), 0)
    setarMoedaBR(document.getElementById('valorRestante'), 0)
    setarMoedaBR(document.getElementById('troco'), 0)

    // ===== FECHA PAGAMENTO E VOLTA PRO PDV =====
    const pagamento = document.querySelector('.pagamento')
    const pdv = document.querySelector('.pdv')

    if (pagamento) pagamento.style.display = 'none'
    if (pdv) pdv.style.display = 'flex'
}

function atualizarPagamento() {

    const totalFinal = getTotalFinal()

    // SOMA DOS PAGAMENTOS
    let totalPago = 0

    document.querySelectorAll('.valorPagamento').forEach(input => {
        let valor = Number(input.value.replace(/\D/g,'')) / 100 || 0
        totalPago += valor
    })

    const restante = totalFinal - totalPago
    const troco = totalPago - totalFinal

    setarMoedaBR(
        document.getElementById('valorTotalPagamento'),
        totalFinal
    )

    if (restante > 0) {
        setarMoedaBR(document.getElementById('valorRestante'), restante)
        setarMoedaBR(document.getElementById('troco'), 0)
    } else {
        setarMoedaBR(document.getElementById('valorRestante'), 0)
        setarMoedaBR(document.getElementById('troco'), troco)
    }
}

document.querySelectorAll('input').forEach(input => {
    if (input.classList.contains('valorPagamento') && !input.readOnly) {
        aplicarMascaraMoeda(input)
        input.addEventListener('input', atualizarPagamento)
    }

    if (input.dataset.tipo) {
        aplicarMascaraMoeda(input)
        input.addEventListener('input', atualizarPagamento)
    }
})

function limparPDV() {

    // Limpa lista de produtos da tela
    const lista = document.getElementById("listaProdutos");
    if (lista) lista.innerHTML = "";

    // Zera objeto da venda atual
    vendaAtual = {
        produtos: [],
        meiosPagamento: [],
        totalVenda: 0
    }

    // Limpa campos de pagamento
    document.querySelectorAll(".valorPagamento").forEach(input => {
        input.value = "";
    });

    // Limpa nomeCliente
    const nomeCliente = document.getElementById("nomeCliente");
    nomeCliente.value = ''

    // Atualiza total na tela
    document.getElementById("totalVenda").value = "0,00";
    document.getElementById("totalVendaAVista").value = "0,00";
}

function setarMoedaBR(input, valor) {
    if (!input) return

    input.value = Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    })
}

// FUNÇÃO DE CADASTRO DE CLIENTES
async function cadastrarCliente() {
    const idLoja = localStorage.getItem('selecaoLoja')

    const db = firebase.firestore();

    const nome = document.getElementById('nomeClienteCadastro')
    const dataNascimentoCliente = document.getElementById('dataNascimentoCliente')
    const instagram = document.getElementById('instagramCliente')
    const telefone = document.getElementById('telefoneCliente')
    const cadastroCliente = document.getElementById('cadastroCliente')

    const idCliente = crypto?.randomUUID?.() ??
    'id-' + Date.now() + '-' + Math.random().toString(16).slice(2)

    const cliente = {
        nome: nome.value,
        dataNascimento: dataNascimentoCliente.value,
        instagram: instagram.value,
        telefone: telefone.value,
        idCliente: idCliente,
        idLoja: idLoja
    }

    const clientes = await db.collection('clientes')
        .where('nome', '==', nome.value.trim())
        .get()

    if (!clientes.empty) {
        alert('Já existe um cliente com esse nome!')
        nome.textContent = ''
    } else {
        await db
            .collection('clientes')
            .doc(cliente.idCliente)
            .set(cliente)

        alert('Cliente registrado com sucesso!')
        cadastroCliente.style.display = 'none'
    }
}

// FUNÇÃO DE CASHBACK
async function cashbackClientes(nomeCliente, valorFinalVenda) {

    const db = firebase.firestore()
    const idLoja = localStorage.getItem('selecaoLoja')
    const usarCashback = document.getElementById('usarCashback')

    const snapshot = await db.collection('clientes')
        .where('nome', '==', nomeCliente)
        .where('idLoja', '==', idLoja)
        .limit(1)
        .get()

    if (snapshot.empty) {
        console.log("Cliente não encontrado")
        return
    }

    const doc = snapshot.docs[0]
    const clienteRef = db.collection('clientes').doc(doc.id)
    const dadosCliente = doc.data()

    const saldoAtual = dadosCliente.cashbackTotal || 0

    // 🔥 DESCOBRE QUANTO FOI REALMENTE PAGO
    const valorCashback = valorFinalVenda * 0.02

    // 🔥 SE USOU CASHBACK → MOVE PARA HISTÓRICO
    if (usarCashback && usarCashback.checked && saldoAtual > 0) {

        const cashbackAtual = dadosCliente.cashback || []

        const cashbackMovido = cashbackAtual.map(item => ({
            ...item,
            usadoEm: new Date()
        }))

        await clienteRef.set({
            cashbackTotal: 0,
            cashback: [],
            cashbackHistorico: firebase.firestore.FieldValue.arrayUnion(...cashbackMovido)
        }, { merge: true })
    }

    // 🔥 GERA 2% SOBRE O QUE FOI PAGO DE VERDADE

    if (valorCashback < 0) return

    const criadoEm = new Date()
    const expiraEm = new Date()
    expiraEm.setMonth(expiraEm.getMonth() + 2)

    await clienteRef.set({
        cashback: firebase.firestore.FieldValue.arrayUnion({
            valor: valorCashback,
            criadoEm: criadoEm,
            expiraEm: expiraEm,
        }),
        cashbackTotal: firebase.firestore.FieldValue.increment(valorCashback)
    }, { merge: true })
}

async function addDataListDados() {
    const db = firebase.firestore();
    const clientes = await db.collection('clientes').orderBy('nome').get()

    clientes.forEach(doc => {
        const dados = doc.data();
        const listaClientes = document.getElementById('listaClientes')

        const nomeCliente = document.createElement('option')
        nomeCliente.value = dados.nome
        nomeCliente.textContent = dados.nome
        listaClientes.appendChild(nomeCliente)

    })
}

addDataListDados()
autoComplete()