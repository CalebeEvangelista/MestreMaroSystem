function logout() {
    firebase.auth().signOut()
    .then(() => {
        localStorage.clear();
        window.location.href = "/HTML/login.html";
    }).catch((error) => {
        alert('Erro ao sair')
    })
}

//FUNÇÃ QUE RETORNA O NOME DA LOJA
async function consultarNomeLoja(id) {
    const db = firebase.firestore()

    const snapshot = await db.collection('lojas')
        .where('id', '==', id)
        .limit(1)
        .get()

    if (snapshot.empty) return null

    return snapshot.docs[0].data().nome
}

async function alterarMeta(tipoMeta){
    Swal.fire({
      title: "Digite nova meta:",
      input: "number",
      inputPlaceholder: "R$ Meta",
      showCancelButton: true
    }).then(async result => {
  
      if (!result.isConfirmed) return
  
      const db = firebase.firestore()
      const idLoja = localStorage.getItem('selecaoLoja')

      const nomeLoja = await consultarNomeLoja(idLoja)
  
      const valor = Number(result.value)
  
      try {
  
        if (tipoMeta == 'dia') {
          await db.collection('metas')
            .doc(idLoja)
            .set({ metaDia: valor }, { merge: true })
            await enviarTelegram('Meta diária da loja ' + '*' + nomeLoja + '*' + ' alterada para ' +  '*' + 'R$' + valor.toFixed(2).replace('.',',') +  '*')
        }
  
        if (tipoMeta == 'mes') {
          await db.collection('metas')
            .doc(idLoja)
            .set({ metaMes: valor }, { merge: true })
            await enviarTelegram('Meta mensal da loja ' + '*' + nomeLoja + '*' + ' alterada para ' +  '*' + 'R$' + valor.toFixed(2).replace('.',',') +  '*')
        }
  
        window.location.reload()
  
      } catch (error){
        console.log(error)
      }
    })
}

// ─────────────────────────────────────────────
// CARREGAMENTO SOB DEMANDA (LAZY LOAD) DAS TELAS
// ─────────────────────────────────────────────
// Antes, TODAS as telas (produtos, compras, clientes, financeiro, lojas, pdv)
// carregavam seus dados do Firestore e montavam suas tabelas assim que a página
// abria, mesmo estando escondidas por CSS. Isso significava dezenas de leituras
// no Firestore e a montagem de várias tabelas inteiras acontecendo ao mesmo
// tempo, competindo com o carregamento da Visão Geral (que é a tela padrão).
//
// Agora cada tela só carrega seus dados na PRIMEIRA VEZ que o usuário realmente
// clica nela. O Set abaixo controla quais telas já foram carregadas, pra não
// ficar buscando tudo de novo toda vez que o usuário troca de aba.
const _telasCarregadas = new Set(['visao']) // "visao" já carrega sozinha no fim deste arquivo

function carregarDadosDaTela(screenClass) {
    if (_telasCarregadas.has(screenClass)) return
    _telasCarregadas.add(screenClass)

    switch (screenClass) {
        case 'pdv':
            // Definidas em pdv.js
            if (typeof verificarCaixa === 'function') verificarCaixa()
            if (typeof addDataListDados === 'function') addDataListDados()
            if (typeof autoComplete === 'function') autoComplete()
            break

        case 'produtos':
            // Definida em produtos.js
            if (typeof completeProducts === 'function') completeProducts()
            break

        case 'compras':
            // Definida em compras.js
            if (typeof gerarTabelaCompras === 'function') gerarTabelaCompras()
            break

        case 'clientes':
            // Definida em clientes.js
            if (typeof mostrarClientes === 'function') mostrarClientes()
            break

        case 'financeiro':
            // Definidas em financeiro.js
            if (typeof vendasPorMeio === 'function') vendasPorMeio()
            if (typeof lucrosPorDia === 'function') lucrosPorDia()
            if (typeof faturamentoPorDia === 'function') faturamentoPorDia()
            if (typeof resumoSemanal === 'function') resumoSemanal()
            if (typeof saudeMensal === 'function') saudeMensal()
            break

        case 'lojas':
            // Definidas em loja.js
            if (typeof mostrarDados === 'function') mostrarDados()
            if (typeof alterarTaxasPagamentos === 'function') alterarTaxasPagamentos()
            break
    }
}

function openScreen(screenClass) {

    // pega todas as sections do main
    const sections = document.querySelectorAll('main > section');

    // fecha todas
    sections.forEach(section => {
        section.style.display = 'none';
    });

    // abre somente a tela desejada
    const screen = document.querySelector(`.${screenClass}`);
    if (screen) {
        screen.style.display = 'flex';
    }

    // carrega os dados dessa tela, só na primeira vez que ela é aberta
    carregarDadosDaTela(screenClass)
}

// ─────────────────────────────────────────────
// CACHE COMPARTILHADO DE VENDAS DO MÊS (Visão Geral)
// ─────────────────────────────────────────────
// Antes, calcularMetas() baixava a coleção "vendas" INTEIRA (todas as lojas,
// todo o histórico) sem nenhum filtro, e resumoDia()/top5ProdutosMaisVendidos()
// faziam mais uma leitura completa cada uma, só da loja atual mas sem limite
// de data. Isso baixava cada vez mais dados conforme a loja crescia.
//
// Agora existe uma única busca, filtrada por idLoja + intervalo do mês atual
// (usando o timestamp "criadoEm", igual já é feito em financeiro.js), e o
// resultado fica em cache/memoizado: se duas funções pedirem os dados quase
// ao mesmo tempo (como acontece na inicialização da tela), a segunda reaproveita
// a mesma consulta em andamento em vez de disparar outra leitura no Firestore.
let _cacheVendasVisaoGeral = null

function limparCacheVisaoGeral() {
    _cacheVendasVisaoGeral = null
}

async function buscarVendasDoMesAtual() {
    const idLoja = localStorage.getItem('selecaoLoja')
    if (!idLoja) return []

    if (_cacheVendasVisaoGeral && _cacheVendasVisaoGeral.idLoja === idLoja) {
        return _cacheVendasVisaoGeral.promise
    }

    const db = firebase.firestore()

    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    inicioMes.setHours(0, 0, 0, 0)
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
    fimMes.setHours(23, 59, 59, 999)

    const timestampInicio = firebase.firestore.Timestamp.fromDate(inicioMes)
    const timestampFim = firebase.firestore.Timestamp.fromDate(fimMes)

    const promise = db.collection('vendas')
        .where('idLoja', '==', idLoja)
        .where('criadoEm', '>=', timestampInicio)
        .where('criadoEm', '<=', timestampFim)
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data()))
        .catch(error => {
            console.error('Erro ao buscar vendas do mês:', error)
            limparCacheVisaoGeral()
            return []
        })

    _cacheVendasVisaoGeral = { idLoja, promise }

    return promise
}

async function calcularMetas() {
    const vendasDia = document.getElementById('vendasDia');
    const qtdVendasDia = document.getElementById('qtdVendasDia');
    const ticketDia = document.getElementById('ticketDia');
    const metaDaqueleDia = document.getElementById('metaDia')
    const progressDia = document.getElementById('progressDia')
    const progressToday = document.getElementById('progressToday')

    const vendasMes = document.getElementById('vendasMes');
    const qtdVendasMes = document.getElementById('qtdVendasMes');
    const ticketMes = document.getElementById('ticketMes');
    const metaMes = document.getElementById('metaMes')
    const progressMes = document.getElementById('progressMes')
    const progressMonth = document.getElementById('progressMonth')
    const mesDoAnoCorrente = document.getElementById('mesDoAno')

    const idLoja = localStorage.getItem('selecaoLoja')
    if (!idLoja) return

    const db = firebase.firestore()

    const dataAgora = new Date()
    const dataHoje = dataAgora.toLocaleDateString('pt-BR')
    const nomeMes = dataAgora.toLocaleString('pt-BR', { month: 'long' })
    mesDoAnoCorrente.textContent = nomeMes.toLocaleUpperCase()

    try {
        const [vendasDoMes, metaSnapshot] = await Promise.all([
            buscarVendasDoMesAtual(),
            db.collection('metas').where('idLoja', '==', idLoja).get()
        ])

        let metaDoDia = 0
        let metaDoMes = 0

        metaSnapshot.forEach(doc => {
            const dados = doc.data()
            metaDoDia = Number(dados.metaDia) || 0
            metaDoMes = Number(dados.metaMes) || 0
        })

        let valorVendidoDia = 0
        let quantidaDeVendasDia = 0
        let valorVendido = 0
        let quantidaDeVendas = 0

        // Uma única passada pelos dados do mês já calcula dia + mês juntos
        vendasDoMes.forEach(dados => {
            const totalVenda = Number(dados.totalVenda) || 0

            valorVendido += totalVenda
            quantidaDeVendas += 1

            if (dados.data === dataHoje) {
                valorVendidoDia += totalVenda
                quantidaDeVendasDia += 1
            }
        })

        const ticketMedioDia = quantidaDeVendasDia > 0 ? valorVendidoDia / quantidaDeVendasDia : 0
        const ticketMedio = quantidaDeVendas > 0 ? valorVendido / quantidaDeVendas : 0

        const porcentagemFinal = metaDoDia > 0
            ? Math.min(Math.max((valorVendidoDia / metaDoDia) * 100, 0), 100).toFixed(2)
            : '0.00'

        const porcentagemFinalMes = metaDoMes > 0
            ? Math.min(Math.max((valorVendido / metaDoMes) * 100, 0), 100).toFixed(2)
            : '0.00'

        metaDaqueleDia.textContent = 'R$ ' + metaDoDia.toFixed(2).replace('.', ',')
        vendasDia.textContent = 'R$ ' + valorVendidoDia.toFixed(2).replace('.', ',');
        qtdVendasDia.textContent = quantidaDeVendasDia + ' Vendas';
        ticketDia.textContent = 'R$ ' + ticketMedioDia.toFixed(2).replace('.', ',');
        progressDia.style.width = porcentagemFinal + '%';
        progressToday.textContent = porcentagemFinal + '%'

        metaMes.textContent = 'R$ ' + metaDoMes.toFixed(2).replace('.', ',')
        vendasMes.textContent = 'R$ ' + valorVendido.toFixed(2).replace('.', ',');
        qtdVendasMes.textContent = quantidaDeVendas + ' Vendas';
        ticketMes.textContent = 'R$ ' + ticketMedio.toFixed(2).replace('.', ',');
        progressMes.style.width = porcentagemFinalMes + '%';
        progressMonth.textContent = porcentagemFinalMes + '%'

    } catch (error) {
        console.error('Erro ao calcular metas:', error)
    }
}

async function atualizarEstoque(produtos, loja) {
    const db = firebase.firestore();

    try {
        const snapshot = await db
            .collection('produtos')
            .where('idLoja', '==', loja)
            .get();

        const updates = [];

        snapshot.forEach(doc => {
            const dado = doc.data();
            const idProduto = doc.id;

            produtos.forEach(produto => {
                const mesmoId = produto.idProduto && produto.idProduto === idProduto;
                const mesmoNome = produto.nome?.trim().toLowerCase() === dado.nome?.trim().toLowerCase();

                if (mesmoId || mesmoNome) {
                    const qtdVendida = produto.quantidade ?? 0;
                    const estoqueAtual = dado.estoque ?? 0;
                    const novoEstoque = estoqueAtual - qtdVendida;

                    console.log(`📦 Produto: ${dado.nome}`);
                    console.log(`   Estoque antes: ${estoqueAtual}`);
                    console.log(`   Quantidade vendida: ${qtdVendida}`);
                    console.log(`   Estoque depois: ${novoEstoque}`);

                    updates.push(
                        db.collection('produtos').doc(idProduto).update({
                            estoque: novoEstoque
                        })
                    );
                }
            });
        });

        await Promise.all(updates);
        console.log(`✅ Estoque atualizado para ${updates.length} produto(s)`);

    } catch (error) {
        console.error("Erro ao atualizar estoque:", error);
    }
}

function abrirTelaCadastro() {
    const cadastroCliente = document.getElementById('cadastroCliente')
    cadastroCliente.style.display = 'flex'
}

function fecharTelaCadastro() {
    const cadastroCliente = document.getElementById('cadastroCliente')
    cadastroCliente.style.display = 'none'
}

// FUNÇÃO PARA MOSTRAR ULTIMAS VENDAS
async function ultimasVendas() {
    const container = document.getElementById('ultimasVendas')

    const idLoja = localStorage.getItem('selecaoLoja')
    if (!idLoja) return

    try {
        const db = firebase.firestore();

        const snapshot = await db
            .collection('vendas')
            .where('idLoja', '==', idLoja)
            .orderBy('criadoEm', 'desc')
            .limit(6)
            .get()

        const fragment = document.createDocumentFragment()

        snapshot.forEach(doc => {
            const dados = doc.data()

            const label = document.createElement('label')

            const horario = document.createElement('p')
            horario.textContent = dados.hora
            label.appendChild(horario)

            const cliente = document.createElement('p')
            cliente.textContent = dados.cliente
            label.appendChild(cliente)

            const valor = document.createElement('p')
            valor.textContent = 'R$' + Number(dados.totalVenda || 0).toFixed(2).replace('.', ',')
            label.appendChild(valor)

            const i = document.createElement('i')
            i.classList.add('fa-solid')
            i.classList.add('fa-eye')
            i.setAttribute('onclick', 'verResumoVenda("' + dados.idVenda + '")')
            label.appendChild(i)

            fragment.appendChild(label)
        })

        // A query já filtra por idLoja, então não é preciso reconferir no loop.
        // Um único appendChild evita reflow a cada venda renderizada.
        container.appendChild(fragment)

    } catch (error) {
        console.error('Erro ao carregar últimas vendas:', error)
    }
}

// FUNÇÃO PARA VER A VENDA SELECIONADA
async function verResumoVenda(idVenda) {
     try {
        const db = firebase.firestore();

        const snapshot = await db
            .collection("vendas")
            .where("idVenda", "==", idVenda)
            .limit(1)
            .get();

        if (snapshot.empty) {
            Swal.fire({
                icon: "error",
                title: "Venda não encontrada",
                heightAuto: false
            });
            return;
        }

        const doc = snapshot.docs[0];
        const venda = doc.data();
        const docId = doc.id;

        const totalVenda = Number(venda.totalVenda || 0);

        const totalPago = (venda.meiosPagamento || []).reduce((acc, item) => {
            return acc + Number(item.valor || 0);
        }, 0);

        const troco = Math.max(totalPago - totalVenda, 0);

        const linhasProdutos = (venda.produtos || []).map(produto => {
            const nome = produto.nome || "-";
            const quantidade = Number(produto.quantidade || 0);
            const valorTotal = Number(produto.valorTotal || 0);

            return `
                <tr>
                    <td>${nome}</td>
                    <td>${quantidade}</td>
                    <td>R$ ${valorTotal.toFixed(2).replace(".", ",")}</td>
                </tr>
            `;
        }).join("");

        const linhasPagamentos = (venda.meiosPagamento || []).map(pagamento => {
            const tipo = pagamento.tipoPagamento || "-";
            const valor = Number(pagamento.valor || 0);

            return `
                <tr>
                    <td>${tipo}</td>
                    <td>R$ ${valor.toFixed(2).replace(".", ",")}</td>
                </tr>
            `;
        }).join("");

        const html = `
            <div class="swal-venda">
                <div class="swal-venda-topo">
                    <div class="swal-venda-box">
                        <h3>INFORMAÇÕES DA VENDA</h3>
                        <p><strong>ID:</strong> <span id="idVenda">${venda.idVenda || "-"}</span></p>
                        <p><strong>Data:</strong> <span id="dataVenda">${venda.data || "-"}</span></p>
                        <p><strong>Hora:</strong> <span id="horaVenda">${venda.hora || "-"}</span></p>
                        <p>
                            <strong>Cliente:</strong>
                            <input type="hidden" id="nomeCliente" value="${venda.cliente || "Sem Nome"}">
                            <span>${venda.cliente || "Sem Nome"}</span>
                        </p>
                    </div>

                    <div class="swal-venda-box">
                        <h3>RESUMO FINANCEIRO</h3>
                        <p><strong>Total da venda:</strong> <span id="totalVenda">R$ ${totalVenda.toFixed(2).replace(".", ",")}</span></p>
                        <p><strong>Total pago:</strong> R$ ${totalPago.toFixed(2).replace(".", ",")}</p>
                        <p><strong>Troco:</strong> R$ ${troco.toFixed(2).replace(".", ",")}</p>
                    </div>
                </div>

                <div class="swal-venda-tabela-box">
                    <h3>PRODUTOS</h3>
                    <table id="tabelaProdutos" class="swal-venda-tabela">
                        <thead>
                            <tr>
                                <th>PRODUTO</th>
                                <th>QUANTIDADE VENDIDA</th>
                                <th>VALOR TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasProdutos || `
                                <tr>
                                    <td colspan="3">Nenhum produto registrado</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                <div class="swal-venda-tabela-box">
                    <h3>MEIOS DE PAGAMENTO</h3>
                    <table class="swal-venda-tabela">
                        <thead>
                            <tr>
                                <th>MEIO DE PAGAMENTO</th>
                                <th>VALOR PAGO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasPagamentos || `
                                <tr>
                                    <td colspan="2">Nenhum pagamento registrado</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const result = await Swal.fire({
            title: "VISUALIZAR VENDA",
            html,
            width: 1100,
            heightAuto: false,
            showConfirmButton: true,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: "Fechar",
            cancelButtonText: "Cancelar venda",
            denyButtonText: "Imprimir venda",
            cancelButtonColor: "#e63946",
            denyButtonColor: "#457b9d",
            reverseButtons: true,
            customClass: {
                popup: "swal-venda-popup"
            }
        });

        console.log("RESULTADO DO SWAL:", result);

        if (result.isDenied) {
            vendaAtual = {
                ...venda,
                cliente: venda.cliente || "Sem Nome",
                produtos: Array.isArray(venda.produtos)
                    ? venda.produtos.map(produto => ({
                        nome: produto.nome || "-",
                        quantidade: Number(produto.quantidade || 0),
                        valorTotal: Number(produto.valorTotal || 0)
                    }))
                    : [],
                totalVenda: Number(venda.totalVenda || 0)
            };

            await imprimirPedido();

            vendaAtual = {
                produtos: [],
                meiosPagamento: [],
                totalVenda: 0
            }
            Swal.close();

            return;
        }

        if (result.isConfirmed) {
            return;
        }

        if (result.dismiss === Swal.DismissReason.cancel) {

            if (await funcionarioBlock()) {
                alert('Você não tem permissão pra excluir uma venda!');
                return;
            }

        const { value: senha } = await Swal.fire({
            title: "Cancelar venda",
            text: "Digite a senha para cancelar a venda",
            input: "password",
            inputPlaceholder: "Senha",
            showCancelButton: true,
            confirmButtonText: "Confirmar cancelamento",
            cancelButtonText: "Voltar",
            confirmButtonColor: "#d62828",
            reverseButtons: true,
            heightAuto: false,
            customClass: {
                    popup: "swal-venda-popup"
                }
        });

        if (!senha) return;

        const senhaCorreta = localStorage.getItem('senhaUser')

        if (senha !== senhaCorreta) {
            Swal.fire({
                icon: "error",
                title: "Senha incorreta",
                heightAuto: false,
                customClass: {
                    popup: "swal-venda-popup"
                }
            });
            return;
        }

        // 👉 BOTÃO IMPRIMIR
        if (result.isDenied) {
            console.log("Imprimir venda");
            imprimirPedido(); // sua função
            return; // impede continuar
        }

        // antes de deletar, reverte o estoque
        await reverterEstoque(venda.produtos || [], venda.idLoja);

        await db.collection("vendas").doc(docId).delete();

        Swal.fire({
            icon: "success",
            title: "Venda cancelada com sucesso",
            heightAuto: false,
            customClass: {
                    popup: "swal-venda-popup"
                }
            });

            window.location.reload();
        }

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "Erro ao visualizar venda",
                text: error.message,
                heightAuto: false,
                customClass: {
                    popup: "swal-venda-popup"
                }
            });
        }
}

async function reverterEstoque(produtos, loja) {
    const db = firebase.firestore();

    try {
        const snapshot = await db
            .collection('produtos')
            .where('idLoja', '==', loja)
            .get();

        const updates = [];

        snapshot.forEach(doc => {
            const dado = doc.data();
            const idProduto = doc.id;

            produtos.forEach(produto => {
                const mesmoId = produto.idProduto && produto.idProduto === idProduto;
                const mesmoNome = produto.nome?.trim().toLowerCase() === dado.nome?.trim().toLowerCase();

                if (mesmoId || mesmoNome) {
                    const qtdVendida = produto.quantidade ?? 0;
                    const estoqueAtual = dado.estoque ?? 0;
                    const novoEstoque = estoqueAtual + qtdVendida; // ✅ soma em vez de subtrair

                    console.log(`↩️ Revertendo estoque: ${dado.nome}`);
                    console.log(`   Estoque antes: ${estoqueAtual}`);
                    console.log(`   Quantidade devolvida: ${qtdVendida}`);
                    console.log(`   Estoque depois: ${novoEstoque}`);

                    updates.push(
                        db.collection('produtos').doc(idProduto).update({
                            estoque: novoEstoque
                        })
                    );
                }
            });
        });

        await Promise.all(updates);
        console.log(`✅ Estoque revertido para ${updates.length} produto(s)`);

    } catch (error) {
        console.error("Erro ao reverter estoque:", error);
        throw error; // propaga o erro pra tratar no cancelamento
    }
}

function reloadVisaoGeral() {
    const visaoGeral = document.getElementById('visao')

    visaoGeral.addEventListener('click', () => {
        window.location.reload()
    })
}

async function estoqueBaixo() {
    const idLoja = localStorage.getItem('selecaoLoja')
    if (!idLoja) return

    const container = document.getElementById('labelEstoqueBaixo')

    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('produtos').where('idLoja', '==', idLoja).orderBy('estoque', 'desc').get()

        const fragment = document.createDocumentFragment()

        snapshot.forEach(doc => {
            const dados = doc.data();

            if (dados.estoque <= dados.estoqueMinimo) {
                const label = document.createElement('label')

                const nomeProduto = document.createElement('p')
                nomeProduto.setAttribute('id', 'nomeProdutoEstoqueBaixo')
                nomeProduto.textContent = dados.nome
                label.appendChild(nomeProduto)

                const unidades = document.createElement('p')
                unidades.textContent = dados.estoque + ' UNDs'
                label.appendChild(unidades)

                fragment.appendChild(label)
            }
        })

        // Um único appendChild no DOM real, em vez de um por produto
        container.appendChild(fragment)

    } catch (error) {
        console.error('Erro ao carregar estoque baixo:', error)
    }
}

function selecaoLoja() {
    const selecionarLoja = document.getElementById('selecionarLoja')
    selecionarLoja.style.display = 'flex'

    const lojas = JSON.parse(localStorage.getItem('lojas'))

    lojas.forEach((loja) => {
        const lojasSelecao = document.getElementById('lojasSelecao')
        const label = document.createElement('label')
        label.setAttribute('id', loja.idLoja)
        label.dataset.cargo = loja.cargo
        label.classList.add('labelLoja')

        const nomeDaLoja = loja.nome || loja.nomeLoja || 'Sem nome'  // ✅ fallback

        const pNome = document.createElement('p')
        pNome.textContent = nomeDaLoja
        label.appendChild(pNome)

        const pCargo = document.createElement('p')
        pCargo.textContent = 'Cargo: ' + loja.cargo
        label.appendChild(pCargo)

        const btnExcluir = document.createElement('button')
        btnExcluir.textContent = '✕'
        btnExcluir.classList.add('btnExcluirLoja')
        label.appendChild(btnExcluir)

        btnExcluir.addEventListener('click', async (e) => {
            e.stopPropagation()
            await excluirLoja(loja.idLoja, nomeDaLoja, loja.cargo)  // ✅ usa o fallback
        })

        lojasSelecao.appendChild(label)
    })

    const lojasSelection = document.querySelectorAll('.labelLoja')
    lojasSelection.forEach(loja => {
        loja.addEventListener('click', (event) => {
            localStorage.setItem('selecaoLoja', event.currentTarget.id)
            localStorage.setItem('cargo', event.currentTarget.dataset.cargo)
            document.getElementById('selecionarLoja').style.display = 'none'
            window.location.reload()
        })
    })
}

//Função para verificar se tem lojas no cadastro do amigão
async function verificarLojas() {
  try {
    const db = firebase.firestore();

    // Pega o usuário logado
    const usuarioLogado = firebase.auth().currentUser;
    if (!usuarioLogado) {
      Swal.showValidationMessage('Nenhum usuário logado. Faça login novamente.');
      return;
    }

    const banco = await db.collection('users').doc(usuarioLogado.uid).get();
    if (!banco.exists) {
      console.log('Documento do usuário não encontrado.');
      return;
    }

    const dados = banco.data();

    console.log(dados);

    if (dados.status == 'funcionario'){
        alert('ele é funcionário da loja -->' + dados.idLoja)
        
    }

    if (dados.lojas && Array.isArray(dados.lojas) && dados.lojas.length > 0) {

    } else {
      console.warn('O usuário não tem lojas cadastradas.');
      adicionarLoja()
    }

  } catch (erro) {
    console.error('Erro ao verificar lojas:', erro);
  }
}

//Função para criar nova loja
async function adicionarLoja() {
    if (funcionarioBlock()){
        return
    }

    await Swal.fire({
        width: '920px',
        showConfirmButton: false,
        showCancelButton: false,
        heightAuto: false,
        customClass: {
            popup: 'swal-edit-produto-popup'
        },
        html: `
            <div class="swal-edit-produto-container">
                <div class="swal-edit-produto-header">
                    <h2>Adicionar loja</h2>
                    <div class="swal-edit-produto-subtitle">Preencha as informações da nova loja</div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Informações da loja</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-2">
                        <div class="swal-edit-produto-field">
                            <label>Nome</label>
                            <input id="AddLojaNome" class="swal-edit-produto-input" type="text">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label>Cidade</label>
                            <input id="AddLojaCidade" class="swal-edit-produto-input" type="text">
                        </div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-1">
                        <div class="swal-edit-produto-field">
                            <label>Endereço</label>
                            <input id="AddLojaEndereco" class="swal-edit-produto-input" type="text">
                        </div>
                    </div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Taxas (%)</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-3">
                        <div class="swal-edit-produto-field">
                            <label>Crédito (%)</label>
                            <input id="AddLojaCredito" class="swal-edit-produto-input" type="number" step="0.01" placeholder="ex: 4.31">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label>Débito (%)</label>
                            <input id="AddLojaDebito" class="swal-edit-produto-input" type="number" step="0.01" placeholder="ex: 0.99">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label>iFood (%)</label>
                            <input id="AddLojaIfood" class="swal-edit-produto-input" type="number" step="0.01" placeholder="ex: 28.19">
                        </div>
                    </div>
                </div>
            </div>

            <div class="swal-edit-produto-footer">
                <button type="button" id="swalAddLojaCancelar" class="swal-edit-produto-btn swal-edit-produto-btn-cancel">✕</button>
                <button type="button" id="swalAddLojaSalvar" class="swal-edit-produto-btn swal-edit-produto-btn-confirm">✓</button>
            </div>
        `,
        didOpen: () => {
            const popup = Swal.getPopup()

            const nome     = popup.querySelector('#AddLojaNome')
            const cidade   = popup.querySelector('#AddLojaCidade')
            const endereco = popup.querySelector('#AddLojaEndereco')
            const credito  = popup.querySelector('#AddLojaCredito')
            const debito   = popup.querySelector('#AddLojaDebito')
            const ifood    = popup.querySelector('#AddLojaIfood')

            const btnCancelar = popup.querySelector('#swalAddLojaCancelar')
            const btnSalvar   = popup.querySelector('#swalAddLojaSalvar')

            function normalizarNumero(valor) {
                if (!valor) return 0
                return parseFloat(String(valor).replace(',', '.')) || 0
            }

            btnCancelar.onclick = () => Swal.close()

            btnSalvar.onclick = async () => {
                if (!nome.value.trim() || !cidade.value.trim() || !endereco.value.trim()) {
                    Swal.showValidationMessage('Preencha os campos obrigatórios: Nome, Cidade e Endereço')
                    return
                }

                // Pega o usuário logado
                const usuarioLogado = firebase.auth().currentUser
                if (!usuarioLogado) {
                    Swal.showValidationMessage('Nenhum usuário logado. Faça login novamente.')
                    return
                }

                // Gera o ID junto com o documento
                const docRef = firebase.firestore().collection('lojas').doc()

                // Valores em % que o usuário digitou
                const creditoPct = normalizarNumero(credito.value)
                const debitoPct  = normalizarNumero(debito.value)
                const ifoodPct   = normalizarNumero(ifood.value)

                const novaLoja = {
                    id:      docRef.id,
                    idResp:  usuarioLogado.uid,
                    nome:    nome.value.trim(),
                    cidade:  cidade.value.trim(),
                    endereco: endereco.value.trim(),
                    taxas: {
                        credito: creditoPct / 100,   // decimal (ex: 0.0431)
                        debito:  debitoPct  / 100,   // decimal (ex: 0.0099)
                        ifood:   ifoodPct   / 100,   // decimal (ex: 0.2819)
                    }
                }

                try {
                    await docRef.set(novaLoja)

                    await firebase.firestore().collection('users').doc(usuarioLogado.uid).set({
                        lojas: firebase.firestore.FieldValue.arrayUnion({
                            cargo: 'ADM',
                            idLoja: docRef.id,
                            nome: nome.value.trim()
                        })
                    }, { merge: true })

                    const lojasAtuais = JSON.parse(localStorage.getItem('lojas')) || []
                    lojasAtuais.push({
                        cargo: 'ADM',
                        idLoja: docRef.id,
                        nome: nome.value.trim()
                    })
                    localStorage.setItem('lojas', JSON.stringify(lojasAtuais))

                    Swal.close()
                    Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Loja adicionada com sucesso!' })
                    window.location.reload()

                } catch (error) {
                    console.error('❌ Erro:', error)
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro ao salvar',
                        text: error.message
                    })
                }
            }
        }
    })
}

async function excluirLoja(idLoja, nomeLoja, cargo) {
    if (funcionarioBlock()){
        return
    }

    const { value: senha } = await Swal.fire({
        title: 'Excluir loja',
        html: `
            <p>Você está prestes a excluir <strong>${nomeLoja}</strong>.</p>
            <p style="color: red; font-size: 0.9em;">⚠️ Essa ação é irreversível!</p>
            <input id="swalSenhaExcluir" type="password" class="swal2-input" placeholder="Digite sua senha para confirmar">
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const senha = document.getElementById('swalSenhaExcluir').value
            if (!senha) {
                Swal.showValidationMessage('Digite sua senha para confirmar')
                return false
            }
            return senha
        }
    })

    if (!senha) return

    try {
        const usuarioLogado = firebase.auth().currentUser
        const credential = firebase.auth.EmailAuthProvider.credential(
            usuarioLogado.email,
            senha
        )
        await usuarioLogado.reauthenticateWithCredential(credential)

        await firebase.firestore().collection('lojas').doc(idLoja).delete()

        // Tenta remover com 'nome', se falhar tenta com 'nomeLoja'
        const db = firebase.firestore()
        const userRef = db.collection('users').doc(usuarioLogado.uid)

        try {
            await userRef.update({
                lojas: firebase.firestore.FieldValue.arrayRemove({
                    cargo: cargo,
                    idLoja: idLoja,
                    nome: nomeLoja  // formato novo
                })
            })
        } catch (e) {
            await userRef.update({
                lojas: firebase.firestore.FieldValue.arrayRemove({
                    cargo: cargo,
                    idLoja: idLoja,
                    nomeLoja: nomeLoja  // formato antigo
                })
            })
        }

        const lojasAtuais = JSON.parse(localStorage.getItem('lojas')) || []
        const lojasAtualizadas = lojasAtuais.filter(l => l.idLoja !== idLoja)
        localStorage.setItem('lojas', JSON.stringify(lojasAtualizadas))

        Swal.fire({
            icon: 'success',
            title: 'Loja excluída',
            text: `${nomeLoja} foi removida com sucesso!`
        }).then(() => {
            window.location.reload()
        })

    } catch (error) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            Swal.fire({ icon: 'error', title: 'Senha incorreta', text: 'Confirme sua senha e tente novamente.' })
        } else {
            Swal.fire({ icon: 'error', title: 'Erro ao excluir', text: error.message })
        }
    }
}

function verificarIdLoja() {
    const localSelecaoLoja = localStorage.getItem('selecaoLoja');

    if (!localSelecaoLoja || localSelecaoLoja.trim() === '') {
        selecaoLoja();
    }
}

async function top5ProdutosMaisVendidos() {
    const db = firebase.firestore();

    const idLoja = localStorage.getItem('selecaoLoja')

    const snapshot = await db.collection("vendas").where('idLoja', '==', idLoja).get();

    const ranking = {};

    snapshot.forEach(doc => {
        const venda = doc.data();

        venda.produtos.forEach(produto => {
        const nome = produto.nome;
        const quantidade = Number(produto.quantidade) || 0;

        if (!ranking[nome]) {
            ranking[nome] = 0;
        }

        ranking[nome] += quantidade;
        });
    });

    const top5 = Object.entries(ranking)
        .map(([produto, quantidade]) => ({ produto, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 20);

    console.log("🏆 Top 20 Produtos Mais Vendidos:");
    top5.forEach((item, index) => {
        console.log(`${index + 1}º - ${item.produto}: ${item.quantidade}`);
    });

    return top5;
}

async function resumoDia() {
    const idLoja = localStorage.getItem('selecaoLoja')
    if (!idLoja) return

    const maiorVenda = document.getElementById('maiorVenda')
    const itemMaisVendido = document.getElementById('itemMaisVendido')
    const clienteTop = document.getElementById('clienteTop')

    const hoje = new Date().toLocaleDateString('pt-BR')

    try {
        // Reaproveita o mesmo cache de "vendas do mês" usado em calcularMetas().
        // Antes essa função fazia sua PRÓPRIA busca completa em "vendas" da loja
        // (sem limite de data), o que ficava mais lento a cada venda registrada.
        const vendasDoMes = await buscarVendasDoMesAtual()
        const vendasHoje = vendasDoMes.filter(venda => venda.data === hoje)

        const rankingVendas = []
        const agrupadoProdutos = {}
        const gastoClientes = {}

        vendasHoje.forEach(venda => {
            rankingVendas.push(Number(venda.totalVenda) || 0)

            ;(venda.produtos || []).forEach(produto => {
                const nome = produto.nome
                const qtd = Number(produto.quantidade) || 0
                agrupadoProdutos[nome] = (agrupadoProdutos[nome] || 0) + qtd
            })

            if (venda.cliente && venda.cliente != 'Sem Nome') {
                gastoClientes[venda.cliente] = (gastoClientes[venda.cliente] || 0) + (Number(venda.totalVenda) || 0)
            }
        })

        // Rankeia o produto mais vendido
        const rankingFinal = Object.entries(agrupadoProdutos)
            .sort((a, b) => b[1] - a[1])

        // Rankeia cliente que mais gastou
        const rankingPorGasto = Object.entries(gastoClientes)
            .sort((a, b) => b[1] - a[1])

        // Rankeia as vendas da maior pra menor
        rankingVendas.sort((a, b) => b - a)

        //Joga os resultados no HTML
        maiorVenda.textContent = rankingVendas.length
            ? 'R$ ' + Number(rankingVendas[0]).toFixed(2).replace('.', ',')
            : 'R$ 0,00'

        itemMaisVendido.textContent = rankingFinal.length
            ? rankingFinal[0][0].toLowerCase().replace(/\b\w/g, letra => letra.toUpperCase())
            : '—'

        clienteTop.textContent = rankingPorGasto.length
            ? rankingPorGasto[0][0]
            : '—'

    } catch (error) {
        console.error('Erro ao gerar resumo do dia:', error)
    }
}

async function verificarDB() {
    try {
        const db = firebase.firestore();

        const nomeColecao = 'users'

        const snapshot = await db.collection(nomeColecao).get();

        const cadastros = [];

        snapshot.forEach(doc => {
            cadastros.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Coleção: ${nomeColecao}`);
        console.log(`Total de cadastros: ${cadastros.length}`);
        console.table(cadastros);

        return cadastros;

    } catch (error) {
        console.error("Erro ao consultar a coleção:", error);
        return [];
    }
}

async function ativarUsuario(id) {
    try {
        const db = firebase.firestore();

        await db.collection("users").doc(id).update({
            status: "ativo"
        });

        console.log(`Usuário ${id} ativado com sucesso!`);

    } catch (error) {
        console.error("Erro ao ativar usuário:", error);
    }
}

async function gerarListaDeCompras() {
    const idLoja = localStorage.getItem('selecaoLoja')

    if (!idLoja) {
        Swal.fire({
            icon: 'warning',
            title: 'Nenhuma loja selecionada',
            text: 'Selecione uma loja antes de gerar a lista.',
            heightAuto: false
        })
        return
    }

    const resultado = await Swal.fire({
        title: 'Gerar lista de compras',
        customClass: {
            popup: 'swal-caixa-popup'
        },
        heightAuto: false,
        focusConfirm: false,

        showCancelButton: true,
        showDenyButton: true,

        confirmButtonText: 'Gerar lista',
        denyButtonText: 'Lista recomendada',
        cancelButtonText: 'Cancelar',

        html: `
            <div class="swal-caixa-wrap">

                <div class="swal-caixa-section">

                    <div class="swal-caixa-field">
                        <label>Data inicial</label>

                        <input
                            type="date"
                            id="listaDataInicial"
                            class="swal-caixa-input"
                        >
                    </div>

                    <div class="swal-caixa-field">
                        <label>Data final</label>

                        <input
                            type="date"
                            id="listaDataFinal"
                            class="swal-caixa-input"
                        >
                    </div>

                </div>

            </div>
        `,

        preConfirm: () => {

            const dataInicial =
                document.getElementById(
                    'listaDataInicial'
                ).value

            const dataFinal =
                document.getElementById(
                    'listaDataFinal'
                ).value

            if (!dataInicial || !dataFinal) {
                Swal.showValidationMessage(
                    'Selecione a data inicial e a data final'
                )

                return false
            }

            if (dataInicial > dataFinal) {
                Swal.showValidationMessage(
                    'A data inicial não pode ser depois da data final'
                )

                return false
            }

            return {
                dataInicial,
                dataFinal
            }
        },

        preDeny: () => {

            const dataInicial =
                document.getElementById(
                    'listaDataInicial'
                ).value

            const dataFinal =
                document.getElementById(
                    'listaDataFinal'
                ).value

            if (!dataInicial || !dataFinal) {
                Swal.showValidationMessage(
                    'Selecione a data inicial e a data final'
                )

                return false
            }

            if (dataInicial > dataFinal) {
                Swal.showValidationMessage(
                    'A data inicial não pode ser depois da data final'
                )

                return false
            }

            return {
                dataInicial,
                dataFinal
            }
        }
    })

    if (resultado.isDismissed) return

    const datas = resultado.value

    // ============================================================
    // LISTA RECOMENDADA
    // ============================================================

    if (resultado.isDenied) {

        await gerarListaDeComprasRecomendada(
            datas.dataInicial,
            datas.dataFinal
        )

        return
    }

    // ============================================================
    // LISTA NORMAL
    // ============================================================

    Swal.fire({
        title: 'Gerando lista...',
        allowOutsideClick: false,
        heightAuto: false,
        didOpen: () => Swal.showLoading()
    })

    try {

        const db = firebase.firestore()

        const inicio =
            parseDataInput(datas.dataInicial)

        inicio.setHours(0, 0, 0, 0)

        const fim =
            parseDataInput(datas.dataFinal)

        fim.setHours(23, 59, 59, 999)

        const timestampInicio =
            firebase.firestore.Timestamp.fromDate(
                inicio
            )

        const timestampFim =
            firebase.firestore.Timestamp.fromDate(
                fim
            )

        const snapshot =
            await db.collection('vendas')
                .where(
                    'idLoja',
                    '==',
                    idLoja
                )
                .where(
                    'criadoEm',
                    '>=',
                    timestampInicio
                )
                .where(
                    'criadoEm',
                    '<=',
                    timestampFim
                )
                .get()

        const contagem = {}

        snapshot.forEach(doc => {

            const venda = doc.data()

            ;(venda.produtos || []).forEach(produto => {

                const nome =
                    (produto.nome || 'SEM NOME')
                        .toUpperCase()
                        .trim()

                const quantidade =
                    Number(produto.quantidade) || 0

                contagem[nome] =
                    (contagem[nome] || 0) +
                    quantidade
            })
        })

        const lista =
            Object.entries(contagem)
                .map(([nome, quantidade]) => ({
                    nome,
                    quantidade
                }))
                .sort(
                    (a, b) =>
                        b.quantidade -
                        a.quantidade
                )

        if (!lista.length) {

            Swal.fire({
                icon: 'info',
                title: 'Nenhuma venda encontrada',
                text: 'Não foram encontradas vendas nesse período para essa loja.',
                heightAuto: false
            })

            return
        }

        const dataInicialFormatada =
            inicio.toLocaleDateString('pt-BR')

        const dataFinalFormatada =
            fim.toLocaleDateString('pt-BR')

        const itensHtml =
            lista.map(item => `
                <li>
                    ${item.quantidade}x ${item.nome}
                </li>
            `).join('')

        Swal.fire({

            customClass: {
                popup: 'swal-tabela-popup'
            },

            heightAuto: false,

            showCancelButton: true,

            confirmButtonText: 'Imprimir',

            cancelButtonText: 'Fechar',

            html: `
                <div
                    class="swal-tabela-wrap"
                    style="text-align:left;"
                >

                    <h2
                        class="swal-tabela-titulo"
                        style="font-size:1.3rem;"
                    >
                        ITENS VENDIDOS ENTRE
                        ${dataInicialFormatada}
                        E
                        ${dataFinalFormatada}
                    </h2>

                    <ul style="
                        list-style:none;
                        padding:0;
                        display:flex;
                        flex-direction:column;
                        gap:8px;
                    ">
                        ${itensHtml}
                    </ul>

                </div>
            `

        }).then(result => {

            if (result.isConfirmed) {

                imprimirListaDeCompras(
                    lista,
                    dataInicialFormatada,
                    dataFinalFormatada
                )

            }

        })

    } catch (error) {

        console.error(
            'Erro ao gerar lista de compras:',
            error
        )

        Swal.fire({
            icon: 'error',
            title: 'Erro ao gerar lista',
            text: error.message,
            heightAuto: false
        })
    }
}

async function gerarListaDeComprasRecomendada(
    dataInicial,
    dataFinal
) {

    const idLojaRaw =
        localStorage.getItem('selecaoLoja')

    if (!idLojaRaw) {

        Swal.fire({
            icon: 'warning',
            title: 'Nenhuma loja selecionada',
            text: 'Selecione uma loja antes de gerar a lista.',
            heightAuto: false
        })

        return
    }

    let idLoja = idLojaRaw

    try {

        const parsed =
            JSON.parse(idLojaRaw)

        idLoja =
            parsed.id || parsed

    } catch {}

    idLoja =
        String(idLoja || '').trim()

    if (!idLoja) {

        Swal.fire({
            icon: 'warning',
            title: 'Loja inválida',
            text: 'Não foi possível identificar a loja selecionada.',
            heightAuto: false
        })

        return
    }

    // Quantos dias de estoque queremos considerar
    const DIAS_COBERTURA = 7

    Swal.fire({
        title: 'Analisando estoque...',
        text: 'Calculando a necessidade de reposição.',
        allowOutsideClick: false,
        heightAuto: false,
        didOpen: () => Swal.showLoading()
    })

    try {

        const db = firebase.firestore()

        // ========================================================
        // DATAS
        // ========================================================

        const inicio =
            parseDataInput(dataInicial)

        inicio.setHours(0, 0, 0, 0)

        const fim =
            parseDataInput(dataFinal)

        fim.setHours(23, 59, 59, 999)

        const timestampInicio =
            firebase.firestore.Timestamp.fromDate(
                inicio
            )

        const timestampFim =
            firebase.firestore.Timestamp.fromDate(
                fim
            )

        const diferencaMs =
            fim.getTime() -
            inicio.getTime()

        const diasPeriodo =
            Math.max(
                1,
                Math.ceil(
                    diferencaMs /
                    (1000 * 60 * 60 * 24)
                ) + 1
            )

        // ========================================================
        // BUSCAR VENDAS
        // ========================================================

        const snapshotVendas =
            await db.collection('vendas')
                .where(
                    'idLoja',
                    '==',
                    idLoja
                )
                .where(
                    'criadoEm',
                    '>=',
                    timestampInicio
                )
                .where(
                    'criadoEm',
                    '<=',
                    timestampFim
                )
                .get()

        const vendasPorProduto = {}

        snapshotVendas.forEach(doc => {

            const venda = doc.data()

            ;(venda.produtos || []).forEach(produto => {

                const nome =
                    normalizarNomeProduto(
                        produto.nome
                    )

                const quantidade =
                    Number(
                        produto.quantidade
                    ) || 0

                if (!nome || quantidade <= 0) {
                    return
                }

                vendasPorProduto[nome] =
                    (
                        vendasPorProduto[nome] ||
                        0
                    ) + quantidade

            })

        })

        // ========================================================
        // BUSCAR PRODUTOS
        // ========================================================

        const snapshotProdutos =
            await db.collection('produtos')
                .where(
                    'idLoja',
                    '==',
                    idLoja
                )
                .get()

        const listaRecomendada = []

        snapshotProdutos.forEach(doc => {

            const produto = doc.data()

            // Ignora produtos que não controlam estoque
            if (
                produto.naoRastrearEstoque === true
            ) {
                return
            }

            if (
                produto.estoque === 'none'
            ) {
                return
            }

            const nome =
                normalizarNomeProduto(
                    produto.nome
                )

            if (!nome) {
                return
            }

            // Quantidade vendida no período
            const quantidadeVendida =
                Number(
                    vendasPorProduto[nome]
                ) || 0

            // Produto sem venda não entra
            if (quantidadeVendida <= 0) {
                return
            }

            // ====================================================
            // ESTOQUE
            // ====================================================

            const estoqueAtual =
                Number(
                    produto.estoque
                ) || 0

            const estoqueMinimo =
                Number(
                    produto.estoqueMinimo
                ) || 0

            // ====================================================
            // MÉDIA DE VENDA
            // ====================================================

            const mediaDiaria =
                quantidadeVendida /
                diasPeriodo

            // ====================================================
            // DEMANDA PARA 7 DIAS
            // ====================================================

            const demanda7Dias =
                mediaDiaria *
                DIAS_COBERTURA

            // ====================================================
            // ESTOQUE ALVO
            // ====================================================

            const estoqueAlvo =
                Math.max(
                    estoqueMinimo,
                    demanda7Dias
                )

            // ====================================================
            // QUANTIDADE A COMPRAR
            // ====================================================

            const quantidadeComprar =
                Math.max(
                    0,
                    Math.ceil(
                        estoqueAlvo -
                        estoqueAtual
                    )
                )

            // Já possui estoque suficiente
            if (quantidadeComprar <= 0) {
                return
            }

            // ====================================================
            // COBERTURA ATUAL
            // ====================================================

            const diasEstoque =
                mediaDiaria > 0
                    ? Math.max(
                        0,
                        estoqueAtual /
                        mediaDiaria
                    )
                    : Infinity

            // ====================================================
            // PRIORIDADE
            // ====================================================

            let prioridade = 'NORMAL'
            let prioridadeOrdem = 3

            if (
                estoqueAtual <=
                estoqueMinimo
            ) {

                prioridade = 'URGENTE'
                prioridadeOrdem = 1

            } else if (
                diasEstoque <=
                DIAS_COBERTURA
            ) {

                prioridade = 'ATENÇÃO'
                prioridadeOrdem = 2
            }

            // ====================================================
            // VALOR
            // ====================================================

            const valorCompra =
                Number(
                    produto.valorCompra
                ) || 0

            const valorEstimado =
                quantidadeComprar *
                valorCompra

            listaRecomendada.push({

                id: doc.id,

                nome:
                    produto.nome ||
                    'SEM NOME',

                quantidadeVendida,

                mediaDiaria,

                estoqueAtual,

                estoqueMinimo,

                demanda7Dias,

                estoqueAlvo,

                quantidadeComprar,

                diasEstoque,

                prioridade,

                prioridadeOrdem,

                valorCompra,

                valorEstimado

            })

        })

        // ========================================================
        // ORDENAR POR PRIORIDADE
        // ========================================================

        listaRecomendada.sort((a, b) => {

            if (
                a.prioridadeOrdem !==
                b.prioridadeOrdem
            ) {

                return (
                    a.prioridadeOrdem -
                    b.prioridadeOrdem
                )
            }

            return (
                b.quantidadeVendida -
                a.quantidadeVendida
            )

        })

        // ========================================================
        // NENHUMA REPOSIÇÃO
        // ========================================================

        if (!listaRecomendada.length) {

            Swal.fire({
                icon: 'success',
                title: 'Estoque em dia',
                text: 'Nenhum produto precisa de reposição com base nas vendas e no estoque atual.',
                heightAuto: false
            })

            return
        }

        // ========================================================
        // TOTAIS
        // ========================================================

        const totalItens =
            listaRecomendada.reduce(
                (total, item) =>
                    total +
                    item.quantidadeComprar,
                0
            )

        const valorTotalCompra =
            listaRecomendada.reduce(
                (total, item) =>
                    total +
                    item.valorEstimado,
                0
            )

        const dataInicialFormatada =
            inicio.toLocaleDateString(
                'pt-BR'
            )

        const dataFinalFormatada =
            fim.toLocaleDateString(
                'pt-BR'
            )

        // ========================================================
        // LISTA VISUAL MINIMALISTA
        // ========================================================

        const itensHtml =
            listaRecomendada.map(item => {

                let icone = '🟢'
                let cor = '#4caf50'

                if (
                    item.prioridade ===
                    'URGENTE'
                ) {

                    icone = '🔴'
                    cor = '#ef4444'

                } else if (
                    item.prioridade ===
                    'ATENÇÃO'
                ) {

                    icone = '🟠'
                    cor = '#f59e0b'

                }

                return `

                    <div style="
                        padding:14px 0;
                        border-bottom:1px solid rgba(255,255,255,.12);
                    ">

                        <div style="
                            display:flex;
                            align-items:flex-start;
                            justify-content:space-between;
                            gap:15px;
                        ">

                            <div style="
                                min-width:0;
                                flex:1;
                            ">

                                <div style="
                                    font-size:1rem;
                                    font-weight:700;
                                    line-height:1.2;
                                ">

                                    ${icone}
                                    ${item.nome}

                                </div>

                                <div style="
                                    margin-top:7px;
                                    font-size:.78rem;
                                    color:#888;
                                    line-height:1.5;
                                ">

                                    Vendidos:
                                    ${item.quantidadeVendida}

                                    &nbsp; • &nbsp;

                                    Estoque:
                                    ${item.estoqueAtual}

                                    &nbsp; • &nbsp;

                                    Mínimo:
                                    ${item.estoqueMinimo}

                                </div>

                            </div>

                            <div style="
                                text-align:right;
                                white-space:nowrap;
                            ">

                                <div style="
                                    font-size:.72rem;
                                    color:#999;
                                    margin-bottom:3px;
                                ">
                                    COMPRAR
                                </div>

                                <div style="
                                    font-size:1.15rem;
                                    font-weight:800;
                                    color:${cor};
                                ">

                                    ${item.quantidadeComprar}

                                </div>

                            </div>

                        </div>

                    </div>

                `

            }).join('')

        // ========================================================
        // RESULTADO
        // ========================================================

        Swal.fire({

            customClass: {
                popup: 'swal-tabela-popup'
            },

            heightAuto: false,

            width: '600px',

            showCancelButton: true,

            confirmButtonText:
                'Imprimir lista',

            cancelButtonText:
                'Fechar',

            html: `

                <div
                    class="swal-tabela-wrap"
                    style="
                        text-align:left;
                        padding-top:2px;
                    "
                >

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:end;
                        gap:15px;
                        margin-bottom:18px;
                    ">

                        <div>

                            <h2
                                class="swal-tabela-titulo"
                                style="
                                    font-size:1.25rem;
                                    margin:0;
                                "
                            >
                                REPOSIÇÃO RECOMENDADA
                            </h2>

                            <div style="
                                font-size:.78rem;
                                color:#888;
                                margin-top:5px;
                            ">

                                ${dataInicialFormatada}
                                até
                                ${dataFinalFormatada}

                            </div>

                        </div>

                        <div style="
                            text-align:right;
                            white-space:nowrap;
                        ">

                            <div style="
                                font-size:.72rem;
                                color:#888;
                            ">
                                ${listaRecomendada.length}
                                produtos
                            </div>

                            <div style="
                                font-size:.9rem;
                                font-weight:700;
                            ">
                                ${totalItens}
                                itens
                            </div>

                        </div>

                    </div>

                    <div style="
                        max-height:450px;
                        overflow-y:auto;
                        padding-right:5px;
                    ">

                        ${itensHtml}

                    </div>

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-top:18px;
                        padding-top:14px;
                        border-top:1px solid rgba(255,255,255,.15);
                    ">

                        <span style="
                            font-size:.8rem;
                            color:#888;
                        ">
                            Investimento estimado
                        </span>

                        <strong style="
                            font-size:1rem;
                        ">

                            ${valorTotalCompra.toLocaleString(
                                'pt-BR',
                                {
                                    style:
                                        'currency',
                                    currency:
                                        'BRL'
                                }
                            )}

                        </strong>

                    </div>

                </div>

            `

        }).then(result => {

            if (result.isConfirmed) {

                imprimirListaDeComprasRecomendada(
                    listaRecomendada,
                    dataInicialFormatada,
                    dataFinalFormatada
                )

            }

        })

    } catch (error) {

        console.error(
            'Erro ao gerar lista recomendada:',
            error
        )

        Swal.fire({
            icon: 'error',
            title: 'Erro ao gerar lista',
            text: error.message,
            heightAuto: false
        })
    }
}

function normalizarNomeProduto(nome) {

    return String(nome || '')
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .replace(
            /\s+/g,
            ' '
        )
        .trim()
        .toUpperCase()

}

function imprimirListaDeComprasRecomendada(
    lista,
    dataInicial,
    dataFinal
) {
    const janela = window.open(
        '',
        '_blank',
        'width=900,height=700'
    )

    if (!janela) {
        Swal.fire({
            icon: 'warning',
            title: 'Popup bloqueado',
            text: 'Permita pop-ups no navegador para imprimir a lista.',
            heightAuto: false
        })

        return
    }

    const linhas = lista.map(item => `
        <tr>
            <td>${item.nome}</td>

            <td style="text-align:center;">
                ${item.estoqueAtual}
            </td>

            <td style="text-align:center;">
                ${item.estoqueMinimo}
            </td>

            <td style="text-align:center;">
                ${item.quantidadeVendida}
            </td>

            <td style="text-align:center;">
                ${item.mediaDiaria.toFixed(2)}
            </td>

            <td style="
                text-align:center;
                font-weight:bold;
            ">
                ${item.quantidadeComprar}
            </td>
        </tr>
    `).join('')

    janela.document.write(`
        <!DOCTYPE html>

        <html lang="pt-BR">

        <head>

            <meta charset="UTF-8">

            <title>
                Lista de Reposição
            </title>

            <style>

                * {
                    box-sizing:border-box;
                }

                body {
                    font-family:Arial,sans-serif;
                    padding:30px;
                    color:#111;
                }

                h1 {
                    margin-bottom:5px;
                }

                .periodo {
                    color:#666;
                    margin-bottom:25px;
                }

                table {
                    width:100%;
                    border-collapse:collapse;
                }

                th,
                td {
                    border:1px solid #ccc;
                    padding:10px;
                }

                th {
                    background:#f2f2f2;
                    text-align:left;
                }

                .rodape {
                    margin-top:25px;
                    font-size:13px;
                    color:#666;
                }

                @media print {

                    body {
                        padding:0;
                    }

                    @page {
                        margin:15mm;
                    }

                }

            </style>

        </head>

        <body>

            <h1>
                LISTA DE REPOSIÇÃO RECOMENDADA
            </h1>

            <div class="periodo">
                Período analisado:
                ${dataInicial}
                até
                ${dataFinal}
            </div>

            <table>

                <thead>

                    <tr>

                        <th>Produto</th>
                        <th>Estoque</th>
                        <th>Mínimo</th>
                        <th>Vendidos</th>
                        <th>Média/dia</th>
                        <th>COMPRAR</th>

                    </tr>

                </thead>

                <tbody>

                    ${linhas}

                </tbody>

            </table>

            <div class="rodape">
                Lista calculada automaticamente com base
                nas vendas do período, estoque atual,
                estoque mínimo e projeção de consumo.
            </div>

            <script>

                window.onload = function() {
                    window.print()
                }

            <\/script>

        </body>

        </html>
    `)

    janela.document.close()
}

//Funcão pra bloquear algum acesso caso seja funcionario
async function funcionarioBlock() {

    const id = localStorage.getItem('userId')

    const db = firebase.firestore()
    const doc = await db.collection('users').doc(id).get();
    const dados = doc.data();

    if (dados.status === 'funcionario') {
        return true;
    }

    return false;
}

async function removerItensPorCargo() {
    
}

verificarIdLoja()
removerItensPorCargo()
ultimasVendas()
calcularMetas()
estoqueBaixo()
resumoDia()
calcularValorTotal()
itensQuantidades()
reloadVisaoGeral()
mostrarCashbackDisponivel()