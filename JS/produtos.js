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

    snapshot.docs.forEach(doc => {
        const produto = {
            docId: doc.id,
            ...doc.data()
        }

        if (String(produto.idLoja || '').trim() !== idLojaSelecao) return;

        const tabela = document.getElementById('tabelaProdutos')
        const tr = document.createElement('tr')

        const codigo = document.createElement('td')
        codigo.innerHTML = produto.id || ''
        tr.appendChild(codigo)

        const nome = document.createElement('td')
        nome.innerHTML = produto.nome || ''
        tr.appendChild(nome)

        const preco = document.createElement('td')
        preco.textContent = 'R$ ' + Number(produto.valorVenda || 0).toFixed(2).replace('.', ',')
        tr.appendChild(preco)

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
                                value="${escapeHtml(dadosProduto.estoque ?? 0)}">
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
                            <input id="Editgrupo" class="swal-edit-produto-input" type="text"
                                value="${escapeHtml(dadosProduto.grupo ?? '')}">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label style="display:flex; align-items:center; gap:8px;">
                                <input id="EditrastrearEstoque" type="checkbox"
                                    ${dadosProduto.rastrearEstoque ? 'checked' : ''}>
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

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-2">
                        <div class="swal-edit-produto-field">
                            <label for="EditprodutoPai">Produto pai</label>
                            <input id="EditprodutoPai" class="swal-edit-produto-input" type="text"
                                value="${escapeHtml(dadosProduto.composicao?.itemPai ?? '')}"
                                placeholder="Produto pai">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditqtdComposicao">Qtd</label>
                            <input id="EditqtdComposicao" class="swal-edit-produto-input" type="number"
                                step="0.0001"
                                value="${escapeHtml(dadosProduto.composicao?.qtdComposicao ?? '')}"
                                placeholder="0.05"
                                style="max-width:120px;">
                        </div>
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

            const produtoPai = popup.querySelector('#EditprodutoPai')
            const qtdComposicao = popup.querySelector('#EditqtdComposicao')

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
                    composicao: {
                        itemPai: produtoPai.value,
                        qtdComposicao: normalizarNumero(qtdComposicao.value)
                    }
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

function abrirSwalAdicionarProduto() {
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
                            <input
                                id="grupo"
                                class="swal-add-produto-input"
                                type="text"
                                placeholder="Grupo do produto"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="rastrearEstoque" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input
                                    id="rastrearEstoque"
                                    type="checkbox"
                                >
                                <span>Rastrear estoque</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="swal-add-produto-section">
                    <div class="swal-add-produto-section-head">
                        <span>Composição</span>
                        <div class="swal-add-produto-section-line"></div>
                    </div>

                    <div class="swal-add-produto-grid swal-add-produto-grid-2">
                        <div class="swal-add-produto-field">
                            <label for="produtoPai">Produto pai</label>
                            <input
                                id="produtoPai"
                                class="swal-add-produto-input"
                                type="text"
                                placeholder="Produto pai"
                            >
                        </div>

                        <div class="swal-add-produto-field">
                            <label for="qtdComposicao">Quantidade</label>
                            <input
                                id="qtdComposicao"
                                class="swal-add-produto-input"
                                type="number"
                                step="0.0001"
                                placeholder="0.05"
                                style="max-width:120px;"
                            >
                        </div>
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
        naoRastrearEstoque: rastrearEstoque.checked
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
                timerProgressBar: true
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
  // Pode vir como string simples ou JSON
  let idLoja = localStorage.getItem("selecaoLoja");
  try {
    const parsed = JSON.parse(idLoja);
    idLoja = parsed.id || parsed;
  } catch {}

  // 🔹 Garante que é string limpa (evita bugs de comparação)
  idLoja = String(idLoja || "").trim();

  // 🔹 2. Busca SOMENTE produtos da loja no Firestore
  // 👉 Isso evita trazer tudo e filtrar depois (mais rápido e seguro)
  const snapshot = await db
    .collection("produtos")
    .where("idLoja", "==", idLoja)
    .get();

  // 🔹 3. Monta lista de produtos para conferência
  const produtos = snapshot.docs
    .map(doc => {
      const data = doc.data();

      return {
        // 🔥 ESSENCIAL: docId é o identificador único no Firestore
        docId: doc.id,

        // Nome tratado (evita null, undefined, espaços)
        nome: String(data.nome || "").trim(),

        // ID apenas para exibição (não usamos mais para salvar)
        id: data.id || data.codigoBarras || doc.id,

        // Estoque atual
        estoque: Number(data.estoque) || 0
      };
    })
    // 🔹 Remove produtos sem nome (dados inválidos)
    .filter(produto => produto.nome)
    // 🔹 Ordena por nome
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // 🔹 Se não encontrou produtos, para aqui
  if (!produtos.length) {
    await Swal.fire({
      title: "Aviso",
      text: "Nenhum produto encontrado para a loja selecionada.",
      icon: "warning",
      heightAuto: false
    });
    return;
  }

  // 🔹 Lista final da conferência
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

      // 🔹 Foco automático no input
      didOpen: () => {
        const input = document.getElementById("qtd");
        if (!input) return;

        input.focus();
        input.select();

        // Enter confirma
        input.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            Swal.clickConfirm();
          }
        });
      },

      // 🔹 Validação do input
      preConfirm: () => {
        const qtd = Number(document.getElementById("qtd").value);

        if (isNaN(qtd) || qtd < 0) {
          Swal.showValidationMessage("Quantidade inválida");
          return false;
        }

        return qtd;
      }
    });

    // 🔹 Se clicou em cancelar (fechar)
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

      // 🔹 Volta para o mesmo produto
      i--;
      continue;
    }

    // 🔹 Se confirmou, salva na lista
    if (isConfirmed) {
      listaConferencia.push({
        docId: produto.docId, // 🔥 chave real do banco
        nome: produto.nome,   // só para exibir depois
        qtdInformada: value
      });
    }
  }

  // 🔹 Se não conferiu nada
  if (!listaConferencia.length) {
    await Swal.fire({
      title: "Aviso",
      text: "Nenhum produto foi conferido.",
      icon: "warning",
      heightAuto: false
    });
    return;
  }

  // 🔹 5. Mostra resumo antes de salvar
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

  // 🔹 Se teve erro parcial
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

  // 🔹 Sucesso total
  await Swal.fire({
    title: "Sucesso",
    text: "Conferência salva.",
    icon: "success",
    heightAuto: false
  });

  window.location.reload();
}

async function salvarConferenciaNoBanco(listaConferencia) {
  const db = firebase.firestore();

  let atualizados = 0;
  const erros = [];

  for (const item of listaConferencia) {
    try {
      const estoqueNovo = Number(item.qtdInformada);

      // 🔹 Validação de segurança
      if (isNaN(estoqueNovo) || estoqueNovo < 0) {
        erros.push({
          nome: item.nome,
          motivo: "Quantidade inválida"
        });
        continue;
      }

      // 🔥 ATUALIZA DIRETO PELO docId (SEM BUSCA)
      await db.collection("produtos").doc(item.docId).update({
        estoque: estoqueNovo
      });

      atualizados++;

    } catch (error) {
      erros.push({
        nome: item.nome,
        motivo: error.message
      });
    }
  }

  return { atualizados, erros };
}

completeProducts()