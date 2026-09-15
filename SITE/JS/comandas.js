// ═══════════════════════════════════════════════
// COMANDAS.JS
// Tela de comandas conectada ao Firestore (coleção "comandas")
// Segue o mesmo padrão de itens do pdv.js (mesmo formato de vendaAtual.produtos)
// e reaproveita o fluxo de pagamento existente (abrirPagamento/registrarVenda)
// ═══════════════════════════════════════════════

// Cache local das comandas já carregadas do Firestore (evita ficar buscando toda hora)
let comandas = [];

// Guarda qual filtro está ativo no momento (todas / aberta / fechada)
let filtroAtual = 'todas';

// Guarda o ID da comanda que está em processo de pagamento no momento.
// É lido pelo registrarVenda() do pdv.js pra saber se precisa fechar
// alguma comanda depois que a venda for registrada com sucesso.
let comandaEmPagamento = null;

// ─────────────────────────────────────────────
// FUNÇÕES UTILITÁRIAS
// ─────────────────────────────────────────────

// Gera um ID único (mesmo padrão usado em vendas, compras, etc)
function gerarId(prefixo) {
    return prefixo + '-' + (crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random().toString(16).slice(2));
}

// Soma o valorTotal de cada item (igual a lógica de valorItem no pdv.js)
function calcularTotalComanda(comanda) {
    return comanda.itens.reduce((acc, item) => acc + Number(item.valorTotal || 0), 0);
}

function formatarReal(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
}

function horarioAgora() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────
// CARREGAR COMANDAS DO FIRESTORE (só as da loja atualmente selecionada)
// ─────────────────────────────────────────────
async function carregarComandas() {
    const idLoja = localStorage.getItem('selecaoLoja');
    if (!idLoja) return;

    const db = firebase.firestore();

    try {
        const snapshot = await db.collection('comandas')
            .where('idLoja', '==', idLoja)
            .get();

        comandas = snapshot.docs.map(doc => doc.data());

        // Limpa comandas com mais de 24h assim que os dados chegam
        await limparComandasExpiradas();

        renderComandas();
    } catch (error) {
        console.error('Erro ao carregar comandas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao carregar comandas',
            text: error.message,
            heightAuto: false
        });
    }
}

// ─────────────────────────────────────────────
// RENDERIZAR A LISTA DE CARDS DE COMANDAS
// Ordena da mais recente pra mais antiga e ajusta colunas dinamicamente (máx 4)
// ─────────────────────────────────────────────
function renderComandas() {
    const grid = document.getElementById('comandasGrid');
    const vazio = document.getElementById('comandasVazio');

    grid.innerHTML = '';

    const listaFiltrada = comandas
        .filter(comanda => {
            if (filtroAtual === 'todas') return true;
            return comanda.status === filtroAtual;
        })
        .sort((a, b) => b.criadoEm - a.criadoEm);

    if (listaFiltrada.length === 0) {
        vazio.style.display = 'flex';
        grid.style.display = 'none';
        return;
    }

    vazio.style.display = 'none';
    grid.style.display = 'grid';

    const LIMITE_MAXIMO_COLUNAS = 4;
    const colunas = Math.min(listaFiltrada.length, LIMITE_MAXIMO_COLUNAS);
    grid.style.gridTemplateColumns = `repeat(${colunas}, 260px)`;

    listaFiltrada.forEach(comanda => {
        const total = calcularTotalComanda(comanda);
        const qtdItens = comanda.itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);

        const card = document.createElement('div');
        card.classList.add('comandaCard');
        card.onclick = () => abrirComanda(comanda.id);

        card.innerHTML = `
            <span class="statusBadge ${comanda.status}">${comanda.status}</span>
            <h3>${comanda.cliente}</h3>
            <div class="mesaInfo">${comanda.mesa || 'Sem identificação'} • Aberta às ${comanda.abertura}</div>
            <div class="comandaResumo">
                <span>${qtdItens} ite${qtdItens === 1 ? 'm' : 'ns'}</span>
                <span>${comanda.itens.length} produto(s)</span>
            </div>
            <div class="comandaTotal">${formatarReal(total)}</div>
        `;

        grid.appendChild(card);
    });
}

// ─────────────────────────────────────────────
// TROCAR O FILTRO (Todas / Abertas / Fechadas)
// ─────────────────────────────────────────────
function filtrarComandas(filtro) {
    filtroAtual = filtro;

    document.querySelectorAll('.filtroComanda').forEach(btn => {
        btn.classList.toggle('ativo', btn.dataset.filtro === filtro);
    });

    renderComandas();
}

// ─────────────────────────────────────────────
// ABRIR MODAL PRA CRIAR UMA NOVA COMANDA
// ─────────────────────────────────────────────
function abrirNovaComanda() {
    Swal.fire({
        html: `
        <div class="swal-caixa-wrap">
            <div class="swal-caixa-header">
                <h2>Nova comanda</h2>
                <p class="swal-caixa-subtitle">Preencha os dados para abrir</p>
            </div>

            <div class="swal-caixa-section">
                <div class="swal-caixa-section-head">
                    <span>Identificação</span>
                    <div class="swal-caixa-section-line"></div>
                </div>

                <div class="swal-caixa-field">
                    <label>Nome do cliente</label>
                    <input id="nc-cliente" class="swal-caixa-input" type="text" placeholder="Ex: João Silva">
                </div>

                <div class="swal-caixa-field">
                    <label>Quantidade de pessoas</label>
                    <input id="nc-qtdPessoas" class="swal-caixa-input" type="number" placeholder="Ex: 5">
                </div>

                <div class="swal-caixa-field">
                    <label>Mesa / Identificação (opcional)</label>
                    <input id="nc-mesa" class="swal-caixa-input" type="text" placeholder="Ex: Mesa 05, Balcão...">
                </div>
            </div>
        </div>
        `,
        customClass: {
            popup: 'swal-caixa-popup',
            cancelButton: 'swal-caixa-btn swal-caixa-btn-cancel',
            confirmButton: 'swal-caixa-btn swal-caixa-btn-confirm',
            actions: 'swal-caixa-footer'
        },
        buttonsStyling: false,
        showCancelButton: true,
        cancelButtonText: '<i class="fa-solid fa-xmark"></i>',
        confirmButtonText: '<i class="fa-solid fa-check"></i>',
        focusConfirm: false,
        heightAuto: false,
        preConfirm: () => {
            const cliente = document.getElementById('nc-cliente').value.trim();
            const mesa = document.getElementById('nc-mesa').value.trim();
            const qtdPessoas = document.getElementById('nc-qtdPessoas').value.trim();

            if (!cliente) {
                Swal.showValidationMessage('Informe o nome do cliente');
                return false;
            }

            return { cliente, mesa, qtdPessoas: qtdPessoas ? Number(qtdPessoas) : null };
        }
    }).then(async result => {
        if (!result.isConfirmed) return;

        await criarComanda(result.value.cliente, result.value.mesa, result.value.qtdPessoas);

        Swal.fire({
            icon: 'success',
            title: 'Comanda aberta!',
            timer: 1200,
            showConfirmButton: false,
            heightAuto: false,
            customClass: { popup: 'swal-caixa-popup' }
        });
    });
}

// ─────────────────────────────────────────────
// CRIAR COMANDA NO FIRESTORE + ADICIONAR NO CACHE LOCAL
// ─────────────────────────────────────────────
async function criarComanda(cliente, mesa, qtdPessoas) {
    const idLoja = localStorage.getItem('selecaoLoja');
    if (!idLoja) {
        Swal.fire({ icon: 'error', title: 'Nenhuma loja selecionada', heightAuto: false });
        return;
    }

    const db = firebase.firestore();
    const id = gerarId('cmd');

    const novaComanda = {
        id,
        cliente,
        mesa: mesa || '',
        qtdPessoas: qtdPessoas || null,
        status: 'aberta',
        abertura: horarioAgora(),
        criadoEm: Date.now(),
        idLoja,
        itens: []
    };

    try {
        await db.collection('comandas').doc(id).set(novaComanda);

        comandas.push(novaComanda);
        renderComandas();
    } catch (error) {
        console.error('Erro ao criar comanda:', error);
        Swal.fire({ icon: 'error', title: 'Erro ao criar comanda', text: error.message, heightAuto: false });
    }
}

// ─────────────────────────────────────────────
// AUTOCOMPLETE DE PRODUTOS NO CAMPO "ADICIONAR ITEM" DA COMANDA
// Mesma lógica do autoComplete() do pdv.js: monta um <datalist> com
// os produtos da loja (nome EXATO como está salvo no Firestore) e,
// quando o nome digitado bate com um produto, preenche o valor sozinho.
// É chamada toda vez que o modal da comanda abre (via didOpen).
// ─────────────────────────────────────────────
async function autoCompleteComanda() {
    const inputProduto = document.getElementById('ic-nome');
    const inputValor = document.getElementById('ic-valor');

    if (!inputProduto || !inputValor) return;

    const idLoja = localStorage.getItem('selecaoLoja');
    if (!idLoja) return;

    const db = firebase.firestore();

    let dataList = document.getElementById('listaProdutosComanda');
    if (!dataList) {
        dataList = document.createElement('datalist');
        dataList.id = 'listaProdutosComanda';
        document.body.appendChild(dataList);
    }
    inputProduto.setAttribute('list', 'listaProdutosComanda');

    try {
        const snapshot = await db.collection('produtos')
            .where('idLoja', '==', idLoja)
            .orderBy('nome')
            .get();

        dataList.innerHTML = '';
        snapshot.forEach(doc => {
            const produto = doc.data();
            const opt = document.createElement('option');
            opt.value = produto.nome;
            opt.dataset.preco = produto.valorVenda;
            dataList.appendChild(opt);
        });
    } catch (error) {
        console.error('Erro ao carregar produtos pro autocomplete da comanda:', error);
    }

    inputProduto.addEventListener('input', () => {
        const selecionado = inputProduto.value;
        const option = Array.from(dataList.querySelectorAll('option'))
            .find(o => o.value === selecionado);
        if (!option) return;

        inputValor.value = Number(option.dataset.preco).toFixed(2);
    });
}

// ─────────────────────────────────────────────
// ABRIR MODAL DE VISUALIZAÇÃO/EDIÇÃO DE UMA COMANDA
// ─────────────────────────────────────────────
function abrirComanda(idComanda) {
    const comanda = comandas.find(c => c.id === idComanda);
    if (!comanda) return;

    const total = calcularTotalComanda(comanda);

    const linhasItens = comanda.itens.map(item => `
        <tr data-id="${item.id}">
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>${formatarReal(item.valorUnitario)}</td>
            <td>${formatarReal(item.valorTotal)}</td>
            <td>
                ${comanda.status === 'aberta'
                    ? `<i class="fa-solid fa-xmark" style="color:red; cursor:pointer;" onclick="removerItemComanda('${comanda.id}', '${item.id}')"></i>`
                    : ''}
            </td>
        </tr>
    `).join('');

    Swal.fire({
        width: '750px',
        heightAuto: false,
        customClass: { popup: 'swal-venda-popup' },
        showConfirmButton: false,
        didOpen: () => {
            autoCompleteComanda();
        },
        html: `
            <div class="swal-venda">
                <div class="swal-venda-topo">
                    <div class="swal-venda-box">
                        <h3>COMANDA</h3>
                        <p><strong>Cliente:</strong> ${comanda.cliente}</p>
                        <p><strong>Identificação:</strong> ${comanda.mesa || '-'}</p>
                        ${comanda.qtdPessoas ? `<p><strong>Pessoas:</strong> ${comanda.qtdPessoas}</p>` : ''}
                        <p><strong>Aberta às:</strong> ${comanda.abertura}</p>
                        <p><strong>Status:</strong> ${comanda.status.toUpperCase()}</p>
                    </div>

                    <div class="swal-venda-box">
                        <h3>TOTAL</h3>
                        <p style="font-size:26px; color: yellow; font-weight:800;">${formatarReal(total)}</p>
                    </div>
                </div>

                ${comanda.status === 'aberta' ? `
                <div class="swal-venda-box" style="margin-bottom: 14px;">
                    <h3>ADICIONAR ITEM</h3>
                    <label class="swal2-label">
                        <input type="text" class="input-swal" id="ic-nome" placeholder="Produto">
                        <input type="number" class="input-swal swal-valores" id="ic-qtd" placeholder="Qtd" min="1" value="1">
                        <input type="number" class="input-swal swal-valores" id="ic-valor" placeholder="Valor Un.">
                        <button class="swal-button" onclick="adicionarItemComanda('${comanda.id}')"><i class="fa-solid fa-plus"></i></button>
                    </label>
                </div>
                ` : ''}

                <div class="swal-venda-tabela-box">
                    <h3>ITENS</h3>
                    <table class="swal-venda-tabela">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Qtd</th>
                                <th>Valor Un.</th>
                                <th>Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="tabelaItensComanda">
                            ${linhasItens || '<tr><td colspan="5">Nenhum item adicionado</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="swal-resumo-footer">
                <button class="swal-resumo-btn swal-resumo-btn-close" onclick="Swal.close()">
                    <i class="fa-solid fa-xmark"></i> Fechar
                </button>
                ${comanda.status === 'aberta' ? `
                    <button class="swal-resumo-btn swal-resumo-btn-fechar" onclick="finalizarComanda('${comanda.id}')">
                        <i class="fa-solid fa-lock"></i> Finalizar comanda
                    </button>
                ` : ''}
            </div>
        `
    });
}

// ─────────────────────────────────────────────
// ADICIONAR ITEM DENTRO DA COMANDA ABERTA NO MODAL
// Formato do item é IGUAL ao vendaAtual.produtos do pdv.js:
// { id, nome, quantidade, valorUnitario, valorTotal, valorDeCusto }
// ─────────────────────────────────────────────
async function adicionarItemComanda(idComanda) {
    const comanda = comandas.find(c => c.id === idComanda);
    if (!comanda) return;

    const nomeInput = document.getElementById('ic-nome');
    const qtdInput = document.getElementById('ic-qtd');
    const valorInput = document.getElementById('ic-valor');

    const nome = nomeInput.value.trim();
    const quantidade = Number(qtdInput.value);
    const valorUnitario = Number(valorInput.value);

    if (!nome || !quantidade || quantidade <= 0 || !valorUnitario || valorUnitario <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Preencha tudo certinho',
            text: 'Informe produto, quantidade e valor unitário válidos.',
            heightAuto: false,
            customClass: { popup: 'swal-venda-popup' }
        });
        return;
    }

    const valorTotal = quantidade * valorUnitario;

    const valorDeCusto = typeof custoDoProduto === 'function'
        ? await custoDoProduto(nome)
        : 0;

    const novoItem = {
        id: gerarId('it'),
        nome,
        quantidade,
        valorUnitario,
        valorTotal,
        valorDeCusto
    };

    comanda.itens.push(novoItem);

    try {
        const db = firebase.firestore();
        await db.collection('comandas').doc(comanda.id).update({ itens: comanda.itens });
    } catch (error) {
        console.error('Erro ao salvar item na comanda:', error);
        Swal.fire({ icon: 'error', title: 'Erro ao salvar item', text: error.message, heightAuto: false });
    }

    renderComandas();
    abrirComanda(idComanda);
}

// ─────────────────────────────────────────────
// REMOVER UM ITEM DA COMANDA (botão X na tabela)
// ─────────────────────────────────────────────
async function removerItemComanda(idComanda, idItem) {
    const comanda = comandas.find(c => c.id === idComanda);
    if (!comanda) return;

    comanda.itens = comanda.itens.filter(item => item.id !== idItem);

    try {
        const db = firebase.firestore();
        await db.collection('comandas').doc(comanda.id).update({ itens: comanda.itens });
    } catch (error) {
        console.error('Erro ao remover item da comanda:', error);
        Swal.fire({ icon: 'error', title: 'Erro ao remover item', text: error.message, heightAuto: false });
    }

    renderComandas();
    abrirComanda(idComanda);
}

// ─────────────────────────────────────────────
// FINALIZAR COMANDA → agora leva pra tela de pagamento normal
// ─────────────────────────────────────────────
async function finalizarComanda(idComanda) {
    const comanda = comandas.find(c => c.id === idComanda);
    if (!comanda) return;

    const total = calcularTotalComanda(comanda);

    const resultado = await Swal.fire({
        title: 'Finalizar comanda?',
        html: `Você será levado pra tela de pagamento com o total de <strong>${comanda.cliente}</strong>: <br><span style="font-size:22px; color: yellow;">${formatarReal(total)}</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ir para pagamento',
        cancelButtonText: 'Voltar',
        heightAuto: false,
        customClass: { popup: 'swal-venda-popup' }
    });

    if (!resultado.isConfirmed) return;

    await enviarComandaParaPagamento(idComanda);
}

// ─────────────────────────────────────────────
// ENVIAR COMANDA PRO FLUXO DE PAGAMENTO DO PDV
// Reconstrói vendaAtual.produtos e a tabela #listaProdutos exatamente
// como o addToShoppingList() do pdv.js faria — daí abrirPagamento()
// abre a MESMA tela de sempre (desconto, acréscimo, cashback, meios
// de pagamento), sem duplicar nada dessa lógica aqui.
// ─────────────────────────────────────────────
async function enviarComandaParaPagamento(idComanda) {
    const comanda = comandas.find(c => c.id === idComanda);
    if (!comanda) return;

    if (!comanda.itens || comanda.itens.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Comanda sem itens',
            text: 'Adicione pelo menos um item antes de finalizar.',
            heightAuto: false,
            customClass: { popup: 'swal-venda-popup' }
        });
        return;
    }

    // Garante que o PDV começa limpo (mesma função usada ao cancelar uma venda normal)
    if (typeof limparPDV === 'function') limparPDV();

    const tbody = document.getElementById('listaProdutos');

    comanda.itens.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.id;

        const tdProduto = document.createElement('td');
        tdProduto.textContent = item.nome;
        tr.appendChild(tdProduto);

        const tdQuantidade = document.createElement('td');
        tdQuantidade.textContent = item.quantidade;
        tr.appendChild(tdQuantidade);

        const tdValor = document.createElement('td');
        tdValor.textContent = 'R$ ' + Number(item.valorUnitario).toFixed(2).replace('.', ',');
        tr.appendChild(tdValor);

        const tdTotal = document.createElement('td');
        tdTotal.textContent = 'R$ ' + Number(item.valorTotal).toFixed(2).replace('.', ',');
        tdTotal.classList.add('valorItem'); // usado por calcularValorTotal() no pdv.js
        tr.appendChild(tdTotal);

        const tdExcluir = document.createElement('td');
        const btnExcluir = document.createElement('button');
        btnExcluir.textContent = '🗑';
        tdExcluir.appendChild(btnExcluir);
        tr.appendChild(tdExcluir);

        tbody.appendChild(tr);

        // Mesmo listener de exclusão usado no PDV normal
        btnExcluir.addEventListener('click', () => {
            const linha = btnExcluir.closest('tr');
            const id = linha.dataset.id;
            vendaAtual.produtos = vendaAtual.produtos.filter(p => p.id !== id);
            linha.remove();
            if (typeof calcularValorTotal === 'function') calcularValorTotal();
        });

        vendaAtual.produtos.push({ ...item });
    });

    if (typeof calcularValorTotal === 'function') calcularValorTotal();

    const inputCliente = document.getElementById('nomeCliente');
    if (inputCliente) inputCliente.value = comanda.cliente;

    // Marca qual comanda está sendo paga agora — lido pelo registrarVenda() do pdv.js
    comandaEmPagamento = comanda.id;

    Swal.close();

    if (typeof abrirPagamento === 'function') abrirPagamento();
}

// ─────────────────────────────────────────────
// FECHAR A COMANDA DEPOIS QUE A VENDA FOI REGISTRADA COM SUCESSO
// Chamada automaticamente pelo registrarVenda() do pdv.js. Só mexe no
// Firestore/cache local — quem decide a tela de volta e limpa a
// referência de comandaEmPagamento é o fecharPagamento(), logo depois.
// ─────────────────────────────────────────────
async function fecharComandaAposVenda(idComanda, idVenda) {
    const comanda = comandas.find(c => c.id === idComanda);
    if (!comanda) return;

    comanda.status = 'fechada';
    comanda.idVendaVinculada = idVenda || null;

    try {
        const db = firebase.firestore();
        await db.collection('comandas').doc(comanda.id).update({
            status: 'fechada',
            idVendaVinculada: comanda.idVendaVinculada
        });
    } catch (error) {
        console.error('Erro ao fechar comanda após pagamento:', error);
    }

    renderComandas();
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO — carrega as comandas da loja assim que o script roda
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// EXCLUIR AUTOMATICAMENTE COMANDAS COM MAIS DE 24 HORAS
// Roda ao carregar a tela e periodicamente enquanto ela estiver aberta.
// Baseada em "criadoEm" (timestamp de quando a comanda foi aberta).
// ─────────────────────────────────────────────
const LIMITE_24_HORAS_MS = 24 * 60 * 60 * 1000; // 24h em milissegundos

async function limparComandasExpiradas() {
    const agora = Date.now();

    const expiradas = comandas.filter(comanda => (agora - comanda.criadoEm) >= LIMITE_24_HORAS_MS);

    if (expiradas.length === 0) return;

    const db = firebase.firestore();

    for (const comanda of expiradas) {
        try {
            await db.collection('comandas').doc(comanda.id).delete();
        } catch (error) {
            console.error(`Erro ao excluir comanda expirada (${comanda.id}):`, error);
        }
    }

    // Remove do cache local as que foram excluídas com sucesso
    const idsExpiradas = expiradas.map(c => c.id);
    comandas = comandas.filter(comanda => !idsExpiradas.includes(comanda.id));

    renderComandas();
}

carregarComandas();

setInterval(() => {
    limparComandasExpiradas();
}, 5 * 60 * 1000); // a cada 5 minutos