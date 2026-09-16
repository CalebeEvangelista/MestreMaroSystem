// ─────────────────────────────────────────────
// COMPOSIÇÃO — lista de componentes (kits, doses, unidades)
// ─────────────────────────────────────────────
function escapeHtmlComposicao(valor) {
    if (valor === null || valor === undefined) return ''
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function estoqueEhNumero(valor) {
    return typeof valor === 'number' && Number.isFinite(valor)
}

// Aceita tanto o formato antigo ({ itemPai, qtdComposicao }) quanto o novo (array),
// pra não quebrar produtos já cadastrados antes dessa mudança.
function normalizarComposicaoParaLista(composicao) {
    if (!composicao) return []
    if (Array.isArray(composicao)) return composicao
    if (composicao.itemPai) return [composicao]
    return []
}

// ─────────────────────────────────────────────
// GRUPOS — configurável por loja (lojas/{id}.grupos), gerenciado em loja.js
// (gerenciarGruposLoja). Cai no padrão de fábrica se a loja ainda não configurou.
// ─────────────────────────────────────────────
const GRUPOS_PADRAO_FABRICA = ['COPAO', 'DESTILADOS', 'DIVERSOS', 'DOCES', 'PIPOCAS', 'TABACARIA', 'SEM ALCOOL', 'OUTROS']

// Cache em memória — evita ir no Firestore de novo a cada modal aberto na mesma sessão.
let _gruposLoja = null

function ordenarGrupos(grupos) {
    return [...grupos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

async function carregarGruposLoja() {
    if (_gruposLoja) return _gruposLoja

    let idLoja = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLoja)
        idLoja = parsed.id || parsed
    } catch {}
    idLoja = String(idLoja || '').trim()

    try {
        const db = firebase.firestore()
        const snapshot = await db.collection('lojas').where('id', '==', idLoja).get()

        if (!snapshot.empty) {
            const lojaDados = snapshot.docs[0].data()
            if (Array.isArray(lojaDados.grupos) && lojaDados.grupos.length) {
                _gruposLoja = ordenarGrupos(lojaDados.grupos)
                return _gruposLoja
            }
        }
    } catch (error) {
        console.error('Erro ao carregar categorias da loja:', error)
    }

    _gruposLoja = ordenarGrupos(GRUPOS_PADRAO_FABRICA)
    return _gruposLoja
}

function normalizarTextoGrupo(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acento
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
}

// Reconhece variações (acento, singular/plural, espaço duplicado) e mapeia pro grupo
// mais próximo dentro da lista da loja — ex: "Destilado" e "DESTILADOS " caem os dois
// em 'DESTILADOS', se essa for uma categoria cadastrada. Não achou nada → 'OUTROS'
// (ou o último item da lista, se a loja não tiver um grupo chamado 'OUTROS').
function mapearParaGrupoPadrao(grupoOriginal, grupos) {
    const listaGrupos = grupos || _gruposLoja || GRUPOS_PADRAO_FABRICA
    const normalizado = normalizarTextoGrupo(grupoOriginal)
    const fallback = listaGrupos.includes('OUTROS') ? 'OUTROS' : listaGrupos[listaGrupos.length - 1]

    if (!normalizado) return fallback
    if (listaGrupos.includes(normalizado)) return normalizado

    const semS = normalizado.endsWith('S') ? normalizado.slice(0, -1) : normalizado
    const comS = normalizado.endsWith('S') ? normalizado : normalizado + 'S'
    const candidato = listaGrupos.find(g => g === semS || g === comS)

    return candidato || fallback
}

function gerarOpcoesGrupo(valorSelecionado, grupos) {
    const listaGrupos = ordenarGrupos(grupos || _gruposLoja || GRUPOS_PADRAO_FABRICA)
    const temValor = valorSelecionado !== null && valorSelecionado !== undefined && String(valorSelecionado).trim() !== ''
    const selecionado = temValor ? mapearParaGrupoPadrao(valorSelecionado, listaGrupos) : ''

    const opcaoPlaceholder = `<option value="" ${selecionado ? '' : 'selected'} disabled hidden>Selecionar</option>`

    const opcoes = listaGrupos
        .map(g => `<option value="${g}" ${g === selecionado ? 'selected' : ''}>${g}</option>`)
        .join('')

    return opcaoPlaceholder + opcoes
}

// ─────────────────────────────────────────────
// CUSTO PELA COMPOSIÇÃO — mesmo raciocínio da cascata de estoque,
// só que aplicado no valorCompra em vez do estoque.
// ─────────────────────────────────────────────
// Cache leve dos produtos da loja atual (nome, valorCompra, composicao), preenchido
// junto com o datalist em garantirDatalistProdutoPai(), pra calcular custo sem
// precisar de uma consulta ao Firestore a cada tecla digitada.
let _cacheProdutosComposicao = []

// Desce a composição recursivamente até achar um produto sem composição própria
// (custo "de verdade", digitado à mão) e soma tudo multiplicado pelas frações.
function calcularCustoRecursivo(nomeProduto, visitados = new Set()) {
    const nome = String(nomeProduto || '').toUpperCase().trim()
    if (!nome) return 0
    if (visitados.has(nome)) return 0 // composição circular, evita loop infinito
    visitados.add(nome)

    const produto = _cacheProdutosComposicao.find(p => p.nome === nome)
    if (!produto) return 0

    const componentes = normalizarComposicaoParaLista(produto.composicao)
    if (!componentes.length) {
        return Number(produto.valorCompra) || 0
    }

    return componentes.reduce((total, componente) => {
        const fracao = Number(componente.qtdComposicao) || 0
        return total + fracao * calcularCustoRecursivo(componente.itemPai, new Set(visitados))
    }, 0)
}

// Soma só as linhas marcadas com "Somar no custo" — as desmarcadas ficam de referência.
function calcularCustoTotalComposicao(container) {
    return Array.from(container.querySelectorAll('.linha-composicao')).reduce((soma, linha) => {
        const checkbox = linha.querySelector('.campo-componente-somar-custo')
        if (!checkbox || !checkbox.checked) return soma

        const nomePai = linha.querySelector('.campo-componente-pai').value
        const qtd = parseFloat(String(linha.querySelector('.campo-componente-qtd').value || '0').replace(',', '.')) || 0

        return soma + qtd * calcularCustoRecursivo(nomePai)
    }, 0)
}

function criarLinhaComposicao(container, valores = {}, aoAtualizar) {
    const linha = document.createElement('div')
    linha.className = 'swal-add-produto-grid swal-add-produto-grid-2 linha-composicao'

    linha.innerHTML = `
        <div class="swal-add-produto-field">
            <label>Produto componente</label>
            <input class="swal-add-produto-input campo-componente-pai" type="text"
                list="listaProdutosPaiSugestao"
                value="${escapeHtmlComposicao(valores.itemPai || '')}"
                placeholder="Produto componente">
        </div>
        <div class="swal-add-produto-field">
            <label>Qtd por venda</label>
            <div class="composicao-qtd-linha">
                <input class="swal-add-produto-input campo-componente-qtd" type="number"
                    step="0.0001"
                    value="${escapeHtmlComposicao(valores.qtdComposicao ?? '')}"
                    placeholder="1">
                <button type="button" class="composicao-remover-btn" title="Remover componente">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="composicao-custo-linha">
                <span class="composicao-custo-valor">Custo: R$ 0,00</span>
                <label class="composicao-custo-check">
                    <input type="checkbox" class="campo-componente-somar-custo">
                    Somar no custo
                </label>
            </div>
        </div>
    `

    const inputPai = linha.querySelector('.campo-componente-pai')
    const inputQtd = linha.querySelector('.campo-componente-qtd')
    const spanCusto = linha.querySelector('.composicao-custo-valor')
    const checkboxSomar = linha.querySelector('.campo-componente-somar-custo')

    function recalcularLinha() {
        const qtd = parseFloat(String(inputQtd.value || '0').replace(',', '.')) || 0
        const custo = qtd * calcularCustoRecursivo(inputPai.value)
        spanCusto.textContent = 'Custo: R$ ' + custo.toFixed(2).replace('.', ',')

        if (typeof aoAtualizar === 'function') aoAtualizar()
    }

    inputPai.addEventListener('input', recalcularLinha)
    inputQtd.addEventListener('input', recalcularLinha)
    checkboxSomar.addEventListener('change', () => {
        if (typeof aoAtualizar === 'function') aoAtualizar()
    })

    linha.querySelector('.composicao-remover-btn').onclick = () => {
        linha.remove()
        if (typeof aoAtualizar === 'function') aoAtualizar()
    }

    container.appendChild(linha)
    recalcularLinha()
}

// Força recalcular o custo de todas as linhas já criadas — usado quando o cache
// de produtos termina de carregar depois que as linhas já foram montadas na tela.
function recalcularTodasLinhasComposicao(container) {
    if (!container) return
    container.querySelectorAll('.campo-componente-pai').forEach(input => {
        input.dispatchEvent(new Event('input'))
    })
}

function coletarComposicao(container) {
    function normalizarNumero(valor) {
        if (valor === null || valor === undefined || valor === '') return 0
        return parseFloat(String(valor).replace(',', '.')) || 0
    }

    return Array.from(container.querySelectorAll('.linha-composicao'))
        .map(linha => ({
            itemPai: linha.querySelector('.campo-componente-pai').value.trim(),
            qtdComposicao: normalizarNumero(linha.querySelector('.campo-componente-qtd').value)
        }))
        .filter(componente => componente.itemPai)
}

// Popula o datalist compartilhado com os nomes dos produtos da loja atual.
// Não depende mais de um input fixo — cada linha de componente aponta pra esse mesmo datalist.
function garantirDatalistProdutoPai(excluirDocId, aoCarregar) {
    let idLoja = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLoja)
        idLoja = parsed.id || parsed
    } catch {}
    idLoja = String(idLoja || '').trim()

    const db = firebase.firestore()

    let dataList = document.getElementById('listaProdutosPaiSugestao')
    if (!dataList) {
        dataList = document.createElement('datalist')
        dataList.id = 'listaProdutosPaiSugestao'
        document.body.appendChild(dataList)
    }

    db.collection('produtos')
        .where('idLoja', '==', idLoja)
        .orderBy('nome')
        .get()
        .then(snapshot => {
            dataList.innerHTML = ''
            _cacheProdutosComposicao = []

            snapshot.forEach(doc => {
                const produtoDaLista = doc.data()

                // Cache pro cálculo de custo — inclui todo mundo, mesmo o excluído do dropdown
                _cacheProdutosComposicao.push({
                    nome: String(produtoDaLista.nome || '').toUpperCase().trim(),
                    valorCompra: produtoDaLista.valorCompra,
                    composicao: produtoDaLista.composicao
                })

                if (excluirDocId && doc.id === excluirDocId) return

                const opt = document.createElement('option')
                opt.value = produtoDaLista.nome
                dataList.appendChild(opt)
            })

            if (typeof aoCarregar === 'function') aoCarregar()
        })
        .catch(error => console.error('Erro ao carregar produtos pai:', error))
}

//Função para adicionar a tabela de produtos
async function completeProducts() {
    const db = firebase.firestore();

    let idLojaSelecao = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLojaSelecao)
        idLojaSelecao = parsed.id || parsed
    } catch {}

    idLojaSelecao = String(idLojaSelecao || '').trim()

    const snapshot = await db.collection("produtos").orderBy("nome").get();

    const gruposLoja = await carregarGruposLoja()

    const listaNomes = []
    const listaCompra = []
    const listaVenda = []

    const ehAtendente = await verificarCargo(); //FUNÇÃO PRESENTE NO AUTHGUARD

    snapshot.docs.forEach(doc => {
        const produto = {
            docId: doc.id,
            ...doc.data()
        }

        if (String(produto.idLoja || '').trim() !== idLojaSelecao) return;

        listaNomes.push(produto.nome || '')
        listaCompra.push(Number(produto.valorCompra || 0).toFixed(2).replace('.', ','))
        listaVenda.push(Number(produto.valorVenda || 0).toFixed(2).replace('.', ','))

        const tabela = document.getElementById('tabelaProdutos')
        const tr = document.createElement('tr')
        tr.dataset.grupo = mapearParaGrupoPadrao(produto.grupo, gruposLoja)

        const codigo = document.createElement('td')
        codigo.innerHTML = produto.id || ''
        tr.appendChild(codigo)

        const nome = document.createElement('td')
        nome.innerHTML = produto.nome || ''
        tr.appendChild(nome)

        if (!ehAtendente) {

            const compra = document.createElement('td');

            compra.textContent =
                'R$ ' +
                Number(produto.valorCompra || 0)
                    .toFixed(2)
                    .replace('.', ',');

            tr.appendChild(compra);
        }


        const venda = document.createElement('td')
        venda.textContent = 'R$ ' + Number(produto.valorVenda || 0).toFixed(2).replace('.', ',')
        tr.appendChild(venda)

        const estoque = document.createElement('td')
        estoque.innerHTML =
            produto.estoque === 'none'
                ? 'Indeterminado'
                : (produto.estoque ?? 0)

        tr.appendChild(estoque)


        const excluir = document.createElement('td')
        const i = document.createElement('i')
        i.classList.add('fa-solid', 'fa-xmark')
        excluir.classList.add('excluirProduct')
        excluir.setAttribute('id', produto.docId)
        excluir.setAttribute('onclick', 'excluirProduto("' + produto.docId + '")')
        excluir.appendChild(i)
        tr.appendChild(excluir)

        const editar = document.createElement('td')
        const iEditar = document.createElement('i')
        iEditar.classList.add('fa-regular', 'fa-pen-to-square')
        editar.classList.add('excluirProduct')
        editar.dataset.id = produto.docId
        editar.style.color = 'yellow'
        editar.setAttribute('onclick', 'abrirEditorDeProduto("' + produto.docId + '")')
        editar.appendChild(iEditar)
        tr.appendChild(editar)

        tabela.appendChild(tr)
    });

    renderizarResumoGrupos()
    aplicarFiltroGrupo()
}

// ─────────────────────────────────────────────
// RESUMO DE GRUPOS — botões estilo pill em cima da tabela de produtos,
// com contador por grupo, filtro ao clicar e "+" pra cadastrar categoria nova
// direto ali (sem precisar ir no cadastro da loja).
// ─────────────────────────────────────────────
let filtroGrupoAtivo = 'TODAS'

async function renderizarResumoGrupos() {
    const container = document.getElementById('resumoGruposProdutos')
    if (!container) return

    const gruposLoja = await carregarGruposLoja()
    const linhas = document.querySelectorAll('#tabelaProdutos tr')

    const contagem = {}
    gruposLoja.forEach(g => { contagem[g] = 0 })

    linhas.forEach(tr => {
        const grupo = tr.dataset.grupo || 'OUTROS'
        contagem[grupo] = (contagem[grupo] || 0) + 1
    })

    container.innerHTML = `
        <button type="button" class="filtroComanda ${filtroGrupoAtivo === 'TODAS' ? 'ativo' : ''}" data-grupo="TODAS">
            Todas <span class="grupo-filtro-contagem">${linhas.length}</span>
        </button>
        ${gruposLoja.map(grupo => `
            <div class="grupo-filtro-item">
                <button type="button" class="filtroComanda ${filtroGrupoAtivo === grupo ? 'ativo' : ''}" data-grupo="${grupo}">
                    ${grupo} <span class="grupo-filtro-contagem">${contagem[grupo] || 0}</span>
                </button>
                ${grupo !== 'OUTROS' ? `
                    <button type="button" class="grupo-filtro-excluir" data-grupo-excluir="${grupo}" title="Excluir categoria">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                ` : ''}
            </div>
        `).join('')}
        <button type="button" id="botaoAdicionarGrupoResumo" class="grupo-filtro-add-btn" title="Adicionar categoria">
            <i class="fa-solid fa-plus"></i>
        </button>
    `

    container.querySelectorAll('.filtroComanda').forEach(botao => {
        botao.onclick = () => {
            filtroGrupoAtivo = botao.dataset.grupo
            aplicarFiltroGrupo()
            renderizarResumoGrupos() // só pra atualizar qual botão fica destacado
        }
    })

    container.querySelectorAll('.grupo-filtro-excluir').forEach(botao => {
        botao.onclick = evento => {
            evento.stopPropagation()
            excluirGrupoLoja(botao.dataset.grupoExcluir)
        }
    })

    const botaoAdicionar = container.querySelector('#botaoAdicionarGrupoResumo')
    if (botaoAdicionar) botaoAdicionar.onclick = abrirCadastroRapidoGrupo
}

// Remove a categoria de lojas/{id}.grupos, depois de confirmar. Não apaga nem
// mexe nos produtos que estavam nela — eles simplesmente passam a cair em
// 'OUTROS' na próxima vez que a tabela for montada (mesma lógica de sempre).
async function excluirGrupoLoja(nomeGrupo) {
    if (nomeGrupo === 'OUTROS') {
        Swal.fire({
            icon: 'info',
            title: 'Não dá pra excluir',
            text: 'OUTROS é a categoria padrão pra produto sem grupo definido.',
            heightAuto: false
        })
        return
    }

    const confirmacao = await Swal.fire({
        title: 'Excluir categoria?',
        html: `A categoria <b>${nomeGrupo}</b> será removida da lista. Produtos que estavam nela passam a aparecer em <b>OUTROS</b>.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Excluir',
        cancelButtonText: 'Cancelar',
        heightAuto: false,
        customClass: { popup: 'swal-caixa-popup' }
    })

    if (!confirmacao.isConfirmed) return

    let idLoja = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLoja)
        idLoja = parsed.id || parsed
    } catch {}
    idLoja = String(idLoja || '').trim()

    const db = firebase.firestore()

    try {
        const snapshot = await db.collection('lojas').where('id', '==', idLoja).get()

        if (snapshot.empty) {
            Swal.fire({ icon: 'error', title: 'Loja não encontrada', heightAuto: false })
            return
        }

        const gruposAtuais = await carregarGruposLoja()
        const gruposAtualizados = gruposAtuais.filter(g => g !== nomeGrupo)

        await db.collection('lojas').doc(snapshot.docs[0].id).set({ grupos: gruposAtualizados }, { merge: true })

        _gruposLoja = gruposAtualizados
        if (filtroGrupoAtivo === nomeGrupo) filtroGrupoAtivo = 'TODAS'

        completeProducts()
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Erro ao excluir categoria', text: error.message, heightAuto: false })
    }
}

// Esconde/mostra as linhas da tabela de acordo com o filtro ativo — a contagem
// de cada linha já foi decidida na hora de montar a tabela (tr.dataset.grupo).
function aplicarFiltroGrupo() {
    document.querySelectorAll('#tabelaProdutos tr').forEach(tr => {
        const mostra = filtroGrupoAtivo === 'TODAS' || tr.dataset.grupo === filtroGrupoAtivo
        tr.style.display = mostra ? '' : 'none'
    })
}

// Cadastra uma categoria nova direto do resumo — grava no mesmo lugar que
// gerenciarGruposLoja() (loja.js): lojas/{id}.grupos. Assim que salva, já
// atualiza o cache local e re-renderiza, sem precisar recarregar a página.
async function abrirCadastroRapidoGrupo() {
    const { value: nomeDigitado } = await Swal.fire({
        title: 'Nova categoria',
        input: 'text',
        inputPlaceholder: 'Ex: CERVEJAS',
        showCancelButton: true,
        confirmButtonText: 'Adicionar',
        cancelButtonText: 'Cancelar',
        heightAuto: false,
        customClass: { popup: 'swal-caixa-popup' },
        inputValidator: valor => {
            if (!valor || !valor.trim()) return 'Digite um nome pra categoria'
        }
    })

    if (!nomeDigitado) return

    const novoGrupo = normalizarTextoGrupo(nomeDigitado)

    let idLoja = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLoja)
        idLoja = parsed.id || parsed
    } catch {}
    idLoja = String(idLoja || '').trim()

    const db = firebase.firestore()

    try {
        const snapshot = await db.collection('lojas').where('id', '==', idLoja).get()

        if (snapshot.empty) {
            Swal.fire({ icon: 'error', title: 'Loja não encontrada', heightAuto: false })
            return
        }

        const gruposAtuais = await carregarGruposLoja()

        if (gruposAtuais.includes(novoGrupo)) {
            Swal.fire({ icon: 'info', title: 'Essa categoria já existe', heightAuto: false })
            return
        }

        const gruposAtualizados = [...gruposAtuais, novoGrupo]

        await db.collection('lojas').doc(snapshot.docs[0].id).set({ grupos: gruposAtualizados }, { merge: true })

        _gruposLoja = gruposAtualizados // atualiza o cache na hora

        Swal.fire({ icon: 'success', title: 'Categoria adicionada', timer: 1000, showConfirmButton: false, heightAuto: false })

        // Reconstrói a tabela com a lista de grupos atualizada — produto que já tinha
        // esse nome escrito passa a bater e sair de 'Outros' pra essa categoria nova
        completeProducts()
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Erro ao adicionar categoria', text: error.message, heightAuto: false })
    }
}

function abrirEditorDeProduto(docId) {
    editarProduto(docId)
}

async function editarProduto(docIdProduto) {
    const db = firebase.firestore()

    let idLoja = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLoja)
        idLoja = parsed.id || parsed
    } catch {}

    idLoja = String(idLoja || '').trim()

    let produtoSnap
    let dadosProduto
    let produtoRef

    try {
        produtoSnap = await db.collection("produtos").doc(docIdProduto).get()

        if (!produtoSnap.exists) {
            Swal.fire({
                icon: 'error',
                title: 'Produto não encontrado',
                text: 'O produto não existe.'
            })
            return
        }

        dadosProduto = produtoSnap.data()
        produtoRef = produtoSnap.ref

        if (String(dadosProduto.idLoja || '').trim() !== idLoja) {
            Swal.fire({
                icon: 'error',
                title: 'Produto inválido',
                text: 'Produto não pertence à loja atual.'
            })
            return
        }

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro ao carregar',
            text: error.message || 'Erro ao carregar produto.'
        })
        return
    }

    const gruposLoja = await carregarGruposLoja()

    const escapeHtml = (valor) => {
        if (valor === null || valor === undefined) return ''
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    await Swal.fire({
        width: '920px',
        showConfirmButton: false,
        showCancelButton: false,
        focusConfirm: false,
        heightAuto: false,
        customClass: {
            popup: 'swal-edit-produto-popup'
        },
        html: `
            <div class="swal-edit-produto-container">
                <div class="swal-edit-produto-header">
                    <h2>Editar produto</h2>
                    <div class="swal-edit-produto-subtitle">Atualize as informações do item selecionado</div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Informações do produto</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-2">
                        <div class="swal-edit-produto-field">
                            <label for="EditnomeProduto">Nome do produto</label>
                            <input id="EditnomeProduto" class="swal-edit-produto-input" type="text"
                                value="${escapeHtml(dadosProduto.nome)}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditcodigoBarras">Código de barras</label>
                            <input id="EditcodigoBarras" class="swal-edit-produto-input" type="text"
                                value="${escapeHtml(dadosProduto.id || '')}">
                        </div>
                    </div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Localização</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-4">
                        <div class="swal-edit-produto-field">
                            <label for="Editestoque">Estoque</label>
                            <input id="Editestoque" class="swal-edit-produto-input" type="text"
                                value="${estoqueEhNumero(dadosProduto.estoque) ? escapeHtml(dadosProduto.estoque) : ''}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditestoqueMinimo">Estoque mínimo</label>
                            <input id="EditestoqueMinimo" class="swal-edit-produto-input" type="number"
                                value="${escapeHtml(dadosProduto.estoqueMinimo ?? 0)}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditqtdAtacado">Qtd. atacado</label>
                            <input id="EditqtdAtacado" class="swal-edit-produto-input" type="number"
                                value="${escapeHtml(dadosProduto.qtdAtacado ?? 0)}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="Editgrupo">Grupo</label>
                            <select id="Editgrupo" class="swal-edit-produto-input">
                                ${gerarOpcoesGrupo(dadosProduto.grupo, gruposLoja)}
                            </select>
                        </div>

                        <div class="swal-edit-produto-field">
                            <label style="display:flex; align-items:center; gap:8px;">
                                <input id="EditrastrearEstoque" type="checkbox"
                                    ${!estoqueEhNumero(dadosProduto.estoque) ? 'checked' : ''}>
                                <span>Não rastrear estoque</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- COMPOSIÇÃO -->
                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Composição</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div id="EditcomposicaoContainer"></div>

                    <button type="button" id="EditbotaoAddComponente" class="composicao-add-btn">
                        <i class="fa-solid fa-plus"></i> Adicionar componente
                    </button>

                    <div class="composicao-custo-resumo">
                        <span>Custo somado da composição: <strong id="EditcomposicaoCustoTotal">R$ 0,00</strong></span>
                        <button type="button" id="EditbotaoAplicarCustoComposicao" class="composicao-add-btn">
                            <i class="fa-solid fa-arrow-right"></i> Usar no campo Compra
                        </button>
                    </div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Valores</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-4">
                        <div class="swal-edit-produto-field">
                            <label for="EditvalorCompraProd">Compra</label>
                            <input id="EditvalorCompraProd" class="swal-edit-produto-input" type="number"
                                value="${escapeHtml(dadosProduto.valorCompra ?? 0)}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditvalorVendaProd">Venda</label>
                            <input id="EditvalorVendaProd" class="swal-edit-produto-input" type="number"
                                value="${escapeHtml(dadosProduto.valorVenda ?? 0)}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditmargemLucro">Margem %</label>
                            <input id="EditmargemLucro" class="swal-edit-produto-input" type="text" disabled>
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditvalorVendaAtacado">Valor atacado</label>
                            <input id="EditvalorVendaAtacado" class="swal-edit-produto-input" type="number"
                                value="${escapeHtml(dadosProduto.valorAtacado ?? 0)}">
                        </div>
                    </div>
                </div>
            </div>

            <div class="swal-edit-produto-footer">
                <button type="button" id="swalEditProdutoCancelar" class="swal-edit-produto-btn swal-edit-produto-btn-cancel">✕</button>
                <button type="button" id="swalEditProdutoSalvar" class="swal-edit-produto-btn swal-edit-produto-btn-confirm">✓</button>
            </div>
        `,
        didOpen: () => {
            const popup = Swal.getPopup()

            const nomeProduto = popup.querySelector('#EditnomeProduto')
            const codigoBarras = popup.querySelector('#EditcodigoBarras')
            const estoque = popup.querySelector('#Editestoque')
            const estoqueMinimo = popup.querySelector('#EditestoqueMinimo')
            const grupo = popup.querySelector('#Editgrupo')
            const rastrearEstoque = popup.querySelector('#EditrastrearEstoque')
            const valorCompraProd = popup.querySelector('#EditvalorCompraProd')
            const valorVendaProd = popup.querySelector('#EditvalorVendaProd')
            const qtdAtacado = popup.querySelector('#EditqtdAtacado')
            const valorVendaAtacado = popup.querySelector('#EditvalorVendaAtacado')
            const margemLucro = popup.querySelector('#EditmargemLucro')

            const composicaoContainer = popup.querySelector('#EditcomposicaoContainer')
            const botaoAddComponente = popup.querySelector('#EditbotaoAddComponente')
            const composicaoCustoTotalEl = popup.querySelector('#EditcomposicaoCustoTotal')
            const botaoAplicarCustoComposicao = popup.querySelector('#EditbotaoAplicarCustoComposicao')

            function atualizarResumoCustoComposicao() {
                const total = calcularCustoTotalComposicao(composicaoContainer)
                composicaoCustoTotalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',')
            }

            garantirDatalistProdutoPai(docIdProduto, () => {
                recalcularTodasLinhasComposicao(composicaoContainer)
                atualizarResumoCustoComposicao()
            })

            const componentesExistentes = normalizarComposicaoParaLista(dadosProduto.composicao)
            if (componentesExistentes.length) {
                componentesExistentes.forEach(componente =>
                    criarLinhaComposicao(composicaoContainer, componente, atualizarResumoCustoComposicao)
                )
            } else {
                criarLinhaComposicao(composicaoContainer, {}, atualizarResumoCustoComposicao)
            }

            botaoAddComponente.onclick = () =>
                criarLinhaComposicao(composicaoContainer, {}, atualizarResumoCustoComposicao)

            botaoAplicarCustoComposicao.onclick = () => {
                const total = calcularCustoTotalComposicao(composicaoContainer)
                valorCompraProd.value = total.toFixed(2)
                valorCompraProd.dispatchEvent(new Event('input'))
            }

            const botaoCancelar = popup.querySelector('#swalEditProdutoCancelar')
            const botaoSalvar = popup.querySelector('#swalEditProdutoSalvar')

            function normalizarNumero(valor) {
                if (!valor) return 0
                return parseFloat(String(valor).replace(',', '.')) || 0
            }

            function atualizarMargem() {
                const compra = normalizarNumero(valorCompraProd.value)
                const venda = normalizarNumero(valorVendaProd.value)
                margemLucro.value = venda > 0 ? (((venda - compra) / venda) * 100).toFixed(2) : '0.00'
            }

            valorCompraProd.addEventListener('input', atualizarMargem)
            valorVendaProd.addEventListener('input', atualizarMargem)

            botaoCancelar.onclick = () => Swal.close()

            botaoSalvar.onclick = async () => {
                if (!nomeProduto.value.trim()) {
                    Swal.showValidationMessage('Informe o nome do produto')
                    return
                }

                if (!grupo.value) {
                    Swal.showValidationMessage('Selecione um grupo')
                    return
                }

                const produtoEditado = {
                    nome: nomeProduto.value.trim().toUpperCase(),
                    id: codigoBarras.value,
                    valorCompra: normalizarNumero(valorCompraProd.value),
                    valorVenda: normalizarNumero(valorVendaProd.value),
                    valorAtacado: normalizarNumero(valorVendaAtacado.value),
                    qtdAtacado: normalizarNumero(qtdAtacado.value),
                    estoque: rastrearEstoque.checked ? 'none' : normalizarNumero(estoque.value),
                    estoqueMinimo: normalizarNumero(estoqueMinimo.value),
                    grupo: grupo.value,
                    naoRastrearEstoque: rastrearEstoque.checked,
                    composicao: coletarComposicao(composicaoContainer)
                }

                try {
                    await produtoRef.update(produtoEditado)

                    Swal.close()

                    Swal.fire({
                        icon: 'success',
                        title: 'Salvo',
                        text: 'Produto atualizado'
                    })

                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: error.message
                    })
                }
            }

            atualizarMargem()
        }
    })
}

async function abrirSwalAdicionarProduto() {
    const gruposLoja = await carregarGruposLoja()

    const resultado = Swal.fire({
        width: '920px',
        showConfirmButton: false,
        showCancelButton: false,
        focusConfirm: false,
        heightAuto: false,
        customClass: {
            popup: 'swal-add-produto-popup'
        },
        html: `
            <div class="swal-add-produto-wrap">
                <div class="swal-add-produto-header">
                    <h2>Adicionar produto</h2>
                    <div class="swal-add-produto-subtitle">Preencha os dados para cadastrar um novo item</div>
                </div>

                <div class="swal-add-produto-section">
                    <div class="swal-add-produto-section-head">
                        <span>Informações do produto</span>
                        <div class="swal-add-produto-section-line"></div>
                    </div>

                    <div class="swal-add-produto-grid swal-add-produto-grid-2">
                        <div class="swal-add-produto-field">
                            <label for="nomeProduto">Nome do produto</label>
                            <input
                                id="nomeProduto"
                                class="swal-add-produto-input"
                                type="text"
                                placeholder="Digite o nome do produto"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="codigoBarras">Código de barras</label>
                            <input
                                id="codigoBarras"
                                class="swal-add-produto-input"
                                type="text"
                                placeholder="Digite o código de barras"
                            >
                        </div>
                    </div>
                </div>

                <div class="swal-add-produto-section">
                    <div class="swal-add-produto-section-head">
                        <span>Localização</span>
                        <div class="swal-add-produto-section-line"></div>
                    </div>

                    <div class="swal-add-produto-grid swal-add-produto-grid-4">
                        <div class="swal-add-produto-field">
                            <label for="estoque">Estoque</label>
                            <input
                                id="estoque"
                                class="swal-add-produto-input"
                                type="text"
                                placeholder="0"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="estoqueMinimo">Estoque mínimo</label>
                            <input
                                id="estoqueMinimo"
                                class="swal-add-produto-input"
                                type="number"
                                placeholder="0"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="qtdAtacado">Qtd. atacado</label>
                            <input
                                id="qtdAtacado"
                                class="swal-add-produto-input"
                                type="number"
                                placeholder="0"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="grupo">Grupo</label>
                            <select id="grupo" class="swal-add-produto-input">
                                ${gerarOpcoesGrupo('', gruposLoja)}
                            </select>
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="rastrearEstoque" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input
                                    id="rastrearEstoque"
                                    type="checkbox"
                                >
                                <span>Não rastrear estoque</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="swal-add-produto-section">
                    <div class="swal-add-produto-section-head">
                        <span>Composição</span>
                        <div class="swal-add-produto-section-line"></div>
                    </div>

                    <div id="composicaoContainer"></div>

                    <button type="button" id="botaoAddComponente" class="composicao-add-btn">
                        <i class="fa-solid fa-plus"></i> Adicionar componente
                    </button>

                    <div class="composicao-custo-resumo">
                        <span>Custo somado da composição: <strong id="composicaoCustoTotal">R$ 0,00</strong></span>
                        <button type="button" id="botaoAplicarCustoComposicao" class="composicao-add-btn">
                            <i class="fa-solid fa-arrow-right"></i> Usar no campo Compra
                        </button>
                    </div>
                </div>

                <div class="swal-add-produto-section">
                    <div class="swal-add-produto-section-head">
                        <span>Valores</span>
                        <div class="swal-add-produto-section-line"></div>
                    </div>

                    <div class="swal-add-produto-grid swal-add-produto-grid-4">
                        <div class="swal-add-produto-field">
                            <label for="valorCompraProd">Compra</label>
                            <input
                                id="valorCompraProd"
                                class="swal-add-produto-input"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="valorVendaProd">Venda</label>
                            <input
                                id="valorVendaProd"
                                class="swal-add-produto-input"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="margemPercentProd">Margem %</label>
                            <input
                                id="margemPercentProd"
                                class="swal-add-produto-input"
                                type="text"
                                disabled
                                placeholder="0.00"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="valorVendaAtacado">Atacado</label>
                            <input
                                id="valorVendaAtacado"
                                class="swal-add-produto-input"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                            >
                        </div>
                    </div>
                </div>
            </div>

            <div class="swal-add-produto-footer">
                <button type="button" id="swalAddProdutoCancelar" class="swal-add-produto-btn swal-add-produto-btn-cancel">✕</button>
                <button type="button" id="swalAddProdutoSalvar" class="swal-add-produto-btn swal-add-produto-btn-confirm">✓</button>
            </div>
        `,
        didOpen: () => {
            const popup = Swal.getPopup()

            const nomeProduto = popup.querySelector('#nomeProduto')
            const codigoBarras = popup.querySelector('#codigoBarras')
            const estoque = popup.querySelector('#estoque')
            const estoqueMinimo = popup.querySelector('#estoqueMinimo')
            const qtdAtacado = popup.querySelector('#qtdAtacado')
            const grupo = popup.querySelector('#grupo')
            const rastrearEstoque = popup.querySelector('#rastrearEstoque')
            const valorCompraProd = popup.querySelector('#valorCompraProd')
            const valorVendaProd = popup.querySelector('#valorVendaProd')
            const margemPercentProd = popup.querySelector('#margemPercentProd')
            const valorVendaAtacado = popup.querySelector('#valorVendaAtacado')

            const botaoCancelar = popup.querySelector('#swalAddProdutoCancelar')
            const botaoSalvar = popup.querySelector('#swalAddProdutoSalvar')

            const composicaoContainer = popup.querySelector('#composicaoContainer')
            const botaoAddComponente = popup.querySelector('#botaoAddComponente')
            const composicaoCustoTotalEl = popup.querySelector('#composicaoCustoTotal')
            const botaoAplicarCustoComposicao = popup.querySelector('#botaoAplicarCustoComposicao')

            function atualizarResumoCustoComposicao() {
                const total = calcularCustoTotalComposicao(composicaoContainer)
                composicaoCustoTotalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',')
            }

            garantirDatalistProdutoPai(undefined, () => {
                recalcularTodasLinhasComposicao(composicaoContainer)
                atualizarResumoCustoComposicao()
            })

            criarLinhaComposicao(composicaoContainer, {}, atualizarResumoCustoComposicao)
            botaoAddComponente.onclick = () =>
                criarLinhaComposicao(composicaoContainer, {}, atualizarResumoCustoComposicao)

            botaoAplicarCustoComposicao.onclick = () => {
                const total = calcularCustoTotalComposicao(composicaoContainer)
                valorCompraProd.value = total.toFixed(2)
                valorCompraProd.dispatchEvent(new Event('input'))
            }

            function normalizarNumero(valor) {
                if (valor === null || valor === undefined || valor === '') return 0
                return parseFloat(String(valor).replace(',', '.')) || 0
            }

            function atualizarMargem() {
                const compra = normalizarNumero(valorCompraProd.value)
                const venda = normalizarNumero(valorVendaProd.value)

                if (venda <= 0) {
                    margemPercentProd.value = '0.00'
                    return
                }

                const margem = ((venda - compra) / venda) * 100
                margemPercentProd.value = margem.toFixed(2)
            }

            valorCompraProd.addEventListener('input', atualizarMargem)
            valorVendaProd.addEventListener('input', atualizarMargem)

            botaoCancelar.addEventListener('click', () => {
                Swal.close()
            })

            botaoSalvar.addEventListener('click', () => {
                if (!nomeProduto.value.trim()) {
                    Swal.showValidationMessage('Informe o nome do produto')
                    return
                }

                if (!grupo.value) {
                    Swal.showValidationMessage('Selecione um grupo')
                    return
                }

                cadastrarProduto()
            })

            nomeProduto.focus()
            atualizarMargem()
        }
    })

    return resultado
}

function cadastrarProduto() {
    function normalizarNumero(valor) {
        if (valor === null || valor === undefined || valor === '') return 0
        return parseFloat(String(valor).replace(',', '.')) || 0
    }

    const nomeProduto = document.getElementById('nomeProduto')
    const codigoBarras = document.getElementById('codigoBarras')
    const estoque = document.getElementById('estoque')
    const estoqueMinimo = document.getElementById('estoqueMinimo')
    const grupo = document.getElementById('grupo')
    const rastrearEstoque = document.getElementById('rastrearEstoque')
    const valorCompraProd = document.getElementById('valorCompraProd')
    const valorVendaProd = document.getElementById('valorVendaProd')
    const qtdAtacado = document.getElementById('qtdAtacado')
    const valorVendaAtacado = document.getElementById('valorVendaAtacado')
    const composicaoContainer = document.getElementById('composicaoContainer')

    const compra = normalizarNumero(valorCompraProd.value)
    const venda = normalizarNumero(valorVendaProd.value)
    const valorAtacado = normalizarNumero(valorVendaAtacado.value)
    const qtdAtacadoNumero = normalizarNumero(qtdAtacado.value)
    const estoqueNumero = normalizarNumero(estoque.value)
    const estoqueMinimoNumero = normalizarNumero(estoqueMinimo.value)

    const markup = venda > 0 ? ((venda - compra) / venda) * 100 : 0

    let idLoja = localStorage.getItem('selecaoLoja')
    try {
        const parsed = JSON.parse(idLoja)
        idLoja = parsed.id || parsed
    } catch {}

    idLoja = String(idLoja || '').trim()

    let idProduto = String(codigoBarras.value || '').trim()

    if (idProduto === '') {
        idProduto = crypto?.randomUUID?.() ?? (Date.now() + '-' + Math.random().toString(16).slice(2))
    }

    const produto = {
        nome: nomeProduto.value.trim().toUpperCase(),
        id: idProduto,
        valorCompra: compra,
        valorVenda: venda,
        margemLucro: Number(markup.toFixed(2)),
        idLoja: idLoja,
        valorAtacado: valorAtacado,
        qtdAtacado: qtdAtacadoNumero,
        estoque: rastrearEstoque.checked ? 'none' : estoqueNumero,
        estoqueMinimo: estoqueMinimoNumero,
        grupo: String(grupo.value || '').trim(),
        naoRastrearEstoque: rastrearEstoque.checked,
        composicao: coletarComposicao(composicaoContainer)
    }

    const db = firebase.firestore()

    db.collection('produtos').doc().set(produto)
        .then(() => {
            Swal.close()

            Swal.fire({
                icon: 'success',
                title: 'Produto cadastrado',
                text: 'O produto foi salvo com sucesso.',
                showConfirmButton: false,
                timer: 1800,
                timerProgressBar: true,
                heightAuto: false,
            })
        })
        .catch((error) => {
            console.error(error)

            Swal.fire({
                icon: 'error',
                title: 'Erro ao cadastrar',
                text: 'Não foi possível salvar o produto.'
            })
        })
}

function excluirProduto(docId) {
  const resposta = confirm("Tem certeza que deseja excluir?");

  if (!resposta) return;

  Swal.fire({
    title: "Digite a senha",
    input: "password",
    inputPlaceholder: "Senha",
    showCancelButton: true,
    heightAuto: false
  }).then(async result => {
    if (!result.isConfirmed) return;

    if (result.value !== localStorage.getItem('senhaUser')) {
      alert('Senha incorreta.');
      return;
    }

    try {
      const db = firebase.firestore();

      await db.collection('produtos').doc(docId).delete();

      await Swal.fire({
        icon: 'success',
        title: 'Excluído',
        text: 'Produto excluído com sucesso.',
        heightAuto: false
      });

      openScreen('produtos');
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao excluir',
        text: error.message || 'Não foi possível excluir o produto.',
        heightAuto: false
      });
    }
  });
}

async function conferenciaSimples() {
  const db = firebase.firestore();

  // 🔹 1. Pega o ID da loja do localStorage
  let idLoja = localStorage.getItem("selecaoLoja");
  try {
    const parsed = JSON.parse(idLoja);
    // ✅ Fix Bug 1: evita "[object Object]" quando não tem chave .id
    idLoja = (typeof parsed === "object" ? parsed.id : parsed) || idLoja;
  } catch {}

  idLoja = String(idLoja || "").trim();

  // 🔹 2. Busca produtos da loja no Firestore
  const snapshot = await db
    .collection("produtos")
    .where("idLoja", "==", idLoja)
    .get();

  // 🔹 3. Monta lista de produtos para conferência
  const produtos = snapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        docId: doc.id,
        nome: String(data.nome || "").trim(),
        id: data.id || data.codigoBarras || doc.id,
        estoque: Number.isFinite(Number(data.estoque)) ? Number(data.estoque) : 'none'
      };
    })
    .filter(produto => produto.nome && produto.estoque !== 'none')
    .sort((a, b) => a.nome.localeCompare(b.nome));

  if (!produtos.length) {
    await Swal.fire({
      title: "Aviso",
      text: "Nenhum produto encontrado para a loja selecionada.",
      icon: "warning",
      heightAuto: false
    });
    return;
  }

  const listaConferencia = [];

  // 🔹 4. Loop de conferência produto por produto
  for (let i = 0; i < produtos.length; i++) {
    const produto = produtos[i];

    const { isConfirmed, isDismissed, value } = await Swal.fire({
      title: `Conferência ${i + 1}/${produtos.length}`,
      html: `
        <div style="text-align:left;">
          <p><b>Produto:</b> ${produto.nome}</p>
          <p><b>ID:</b> ${produto.id}</p>
          <p><b>Qtd no BD:</b> ${produto.estoque}</p>
        </div>
        <input id="qtd" type="number" min="0" class="swal2-input" placeholder="Quantidade">
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: "Próximo",
      denyButtonText: "Pular",
      cancelButtonText: "Encerrar",
      heightAuto: false,
      focusConfirm: false,

      didOpen: () => {
        const input = document.getElementById("qtd");
        if (!input) return;

        input.focus();
        input.select();

        input.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            Swal.clickConfirm();
          }
        });
      },

      preConfirm: () => {
        // ✅ Fix Bug 2: impede que campo vazio passe como 0
        const raw = document.getElementById("qtd").value;
        if (raw === "" || raw === null) {
          Swal.showValidationMessage("Informe a quantidade");
          return false;
        }
        const qtd = Number(raw);
        if (isNaN(qtd) || qtd < 0) {
          Swal.showValidationMessage("Quantidade inválida");
          return false;
        }
        return qtd;
      }
    });

    if (isDismissed) {
      const confirmacao = await Swal.fire({
        title: "Encerrar conferência?",
        text: "Os itens preenchidos serão mantidos.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim",
        cancelButtonText: "Continuar",
        heightAuto: false
      });

      if (confirmacao.isConfirmed) break;

      i--;
      continue;
    }

    if (isConfirmed) {
      listaConferencia.push({
        docId: produto.docId,
        nome: produto.nome,
        qtdInformada: value
      });
    }
  }

  if (!listaConferencia.length) {
    await Swal.fire({
      title: "Aviso",
      text: "Nenhum produto foi conferido.",
      icon: "warning",
      heightAuto: false
    });
    return;
  }

  // 🔹 5. Resumo antes de salvar
  const resumo = `
    <div style="max-height:400px; overflow:auto;">
      <table style="width:100%;">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
          </tr>
        </thead>
        <tbody>
          ${listaConferencia.map(item => `
            <tr>
              <td>${item.nome}</td>
              <td>${item.qtdInformada}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  const confirmacaoFinal = await Swal.fire({
    title: "Resultado",
    html: resumo,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    heightAuto: false
  });

  if (!confirmacaoFinal.isConfirmed) return;

  // 🔹 6. Salva no banco
  const resultado = await salvarConferenciaNoBanco(listaConferencia);

  if (resultado.erros.length) {
    await Swal.fire({
      title: "Parcial",
      html: `
        Atualizados: ${resultado.atualizados}<br>
        Erros: ${resultado.erros.length}
      `,
      icon: "warning",
      heightAuto: false
    });
    return;
  }

  await Swal.fire({
    title: "Sucesso",
    text: "Conferência salva.",
    icon: "success",
    heightAuto: false
  });
}

async function salvarConferenciaNoBanco(listaConferencia) {
  const db = firebase.firestore();
  const erros = [];
  let atualizados = 0;

  await Promise.all(listaConferencia.map(async (item) => {
    const estoqueNovo = Number(item.qtdInformada);
    if (!Number.isFinite(estoqueNovo) || estoqueNovo < 0) {
      erros.push({ nome: item.nome, motivo: "Quantidade inválida" });
      return;
    }
    try {
      await db.collection("produtos").doc(item.docId).update({ estoque: estoqueNovo });
      atualizados++;
    } catch (error) {
      erros.push({ nome: item.nome, motivo: error.message });
      console.error(error);
    }
  }));

  return { atualizados, erros };
}

// completeProducts() agora só roda quando a tela de Produtos é aberta
// pela primeira vez (ver carregarDadosDaTela em home.js).