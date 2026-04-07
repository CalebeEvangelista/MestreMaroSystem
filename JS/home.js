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
}

async function calcularMetas() {
    //VENDAS DO DIA
    const vendasDia = document.getElementById('vendasDia');
    const qtdVendasDia = document.getElementById('qtdVendasDia');
    const ticketDia = document.getElementById('ticketDia');
    const metaDaqueleDia = document.getElementById('metaDia')
    const progressDia = document.getElementById('progressDia')
    const progressToday = document.getElementById('progressToday')

    let valorVendidoDia = 0;
    let quantidaDeVendasDia = 0;
    let ticketMedioDia = 0;

    const db = firebase.firestore();

    const snapshot = await db
        .collection("vendas")
        .get()

    if (snapshot.empty) {
        vendasDia.innerHTML = "R$ 0,00";
        qtdVendasDia.innerHTML = "0 Vendas";
        ticketDia.innerHTML = "R$ 0,00";
        return;
    }

    const dataAgora = new Date()
    const dataHoje = dataAgora.toLocaleString('pt-BR').split(',')

    snapshot.forEach(doc => {
        const dados = doc.data();
        const totalVenda = Number(dados.totalVenda) || 0;

        const dataSplit = dados.data.split(',')

        if(dataSplit[0] == dataHoje[0] && dados.idLoja == localStorage.getItem('selecaoLoja')){
            valorVendidoDia += totalVenda;
            quantidaDeVendasDia += 1;
        }
    });

    if (quantidaDeVendasDia > 0) {
        ticketMedioDia = valorVendidoDia / quantidaDeVendasDia;
    }

    const idLoja = localStorage.getItem('selecaoLoja')

    const meta = await db.collection("metas").where('idLoja', '==', idLoja).get()
    let metaDoDia = 0
    let metaDoMes = 0

    meta.forEach(doc => {
        const dados = doc.data()
        metaDoDia = Number(dados.metaDia)
        metaDoMes = Number(dados.metaMes)
    })

    const porcentagemMetaDia = ((valorVendidoDia / metaDoDia) * 100).toFixed(2)
    const porcentagemFinal = (Math.min(Math.max(porcentagemMetaDia, 0), 100)).toFixed(2)

    metaDaqueleDia.textContent = 'R$ ' + metaDoDia.toFixed(2).replace('.', ',')
    vendasDia.textContent = 'R$ ' + valorVendidoDia.toFixed(2).replace('.', ',');
    qtdVendasDia.textContent = quantidaDeVendasDia + ' Vendas';
    ticketDia.textContent = 'R$ ' + ticketMedioDia.toFixed(2).replace('.', ',');
    progressDia.style.width = porcentagemFinal + '%';
    progressToday.textContent = porcentagemFinal + '%'

    //VENDAS DO MÊS
    const vendasMes = document.getElementById('vendasMes');
    const qtdVendasMes = document.getElementById('qtdVendasMes');
    const ticketMes = document.getElementById('ticketMes');
    const metaMes = document.getElementById('metaMes')
    const progressMes = document.getElementById('progressMes')
    const progressMonth = document.getElementById('progressMonth')
    const mesDoAnoCorrente = document.getElementById('mesDoAno')

    let valorVendido = 0;
    let quantidaDeVendas = 0;
    let ticketMedio = 0;

    const snapshot2 = await db
        .collection("vendas")
        .get()

    if (snapshot.empty) {
        vendasMes.innerHTML = "R$ 0,00";
        qtdVendasMes.innerHTML = "0 Vendas";
        ticketMes.innerHTML = "R$ 0,00";
        return;
    }

    snapshot.forEach(doc => {
        const dados = doc.data();
        const totalVenda = Number(dados.totalVenda) || 0;

        const dataSplit = dados.data.split(',')
        const dataSplitada = dataSplit[0].split('/')

        const mesDoAno = dataAgora.getMonth() + 1

        const nomeMes = dataAgora.toLocaleString('pt-BR', {
            month: 'long'
        })

        mesDoAnoCorrente.textContent = nomeMes.toLocaleUpperCase()

        if(mesDoAno == Number(dataSplitada[1]) && dados.idLoja == localStorage.getItem('selecaoLoja')){
            valorVendido += totalVenda;
            quantidaDeVendas += 1;
        }
    });

    if (quantidaDeVendas > 0) {
        ticketMedio = valorVendido / quantidaDeVendas;
    }

    metaMes.innerHTML = 'R$ ' + metaDoMes.toFixed(2).replace('.', ',')

    vendasMes.innerHTML = 'R$ ' + valorVendido.toFixed(2).replace('.', ',');
    qtdVendasMes.innerHTML = quantidaDeVendas + ' Vendas';
    ticketMes.innerHTML = 'R$ ' + ticketMedio.toFixed(2).replace('.', ',');

    const porcentagemMeta = ((valorVendido / metaDoMes) * 100).toFixed(2)

    const porcentagemFinalMes = Math.min(Math.max(porcentagemMeta, 0), 100);

    progressMes.style.width = porcentagemFinalMes + '%';

    progressMonth.innerHTML = porcentagemFinalMes + '%'
}

async function atualizarEstoque(produtos, loja) {
    const db = firebase.firestore();

    try {
        const snapshot = await db
            .collection('produtos')
            .where('idLoja', '==', loja)
            .get();

        snapshot.forEach(doc => {

            const dado = doc.data();
            const idProduto = doc.id;

            produtos.forEach(produto => {

                if (produto.nome === dado.nome) {

                    const qtdVendida = produto.quantidade;
                    const estoqueAtual = dado.estoque;

                    const novoEstoque = estoqueAtual - qtdVendida;

                    db.collection('produtos')
                        .doc(idProduto)
                        .update({
                            estoque: novoEstoque
                        });
                    
                }
            });

        });

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
    const ultimasVendas = document.getElementById('ultimasVendas')

    const db = firebase.firestore();

    const idLoja = localStorage.getItem('selecaoLoja')

    const snapshot = await db
    .collection('vendas')
    .where('idLoja','==', idLoja)
    .orderBy('criadoEm','desc')
    .limit(6)
    .get()

    snapshot.forEach(doc => {
        const dados = doc.data()

        const label = document.createElement('label')

        const horario = document.createElement('p')
        horario.innerHTML = dados.hora
        label.appendChild(horario)

        const cliente = document.createElement('p')
        cliente.innerHTML = dados.cliente
        label.appendChild(cliente)

        const valor = document.createElement('p')
        valor.innerHTML = 'R$' + dados.totalVenda.toFixed(2).replace('.',',')
        label.appendChild(valor)

        const data = dados.data.split('/')

        const diaVenda = Number(data[0])
        const mesVenda = Number(data[1])

        const agora = new Date()
        const dia = agora.getDate()
        const mes = agora.getMonth() + 1

        const i = document.createElement('i')
        i.classList.add('fa-solid')
        i.classList.add('fa-eye')
        i.setAttribute('onclick', 'verResumoVenda("' + dados.idVenda + '")')
        label.appendChild(i)

        const idLojaa = localStorage.getItem('selecaoLoja')

        if (String(dados.idLoja) === idLojaa) {
            ultimasVendas.appendChild(label)
        }
    })
    
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
            console.log("CLICOU EM FECHAR");
            return;
        }

        if (result.dismiss === Swal.DismissReason.cancel) {

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

function reloadVisaoGeral() {
    const visaoGeral = document.getElementById('visao')

    visaoGeral.addEventListener('click', () => {
        window.location.reload()
    })
}

async function estoqueBaixo() {
    const idLoja = localStorage.getItem('selecaoLoja')

    const db = firebase.firestore();
    const snapshot = await db.collection('produtos').where('idLoja', '==', idLoja).orderBy('estoque', 'desc').get()

    var lista = []

    snapshot.forEach(doc => {
        const dados = doc.data();

        if(dados.estoque <= dados.estoqueMinimo) {
            const estoqueBaixo = document.getElementById('labelEstoqueBaixo')

            const label = document.createElement('label')

            const nomeProduto = document.createElement('p')
            nomeProduto.setAttribute('id', 'nomeProdutoEstoqueBaixo')
            nomeProduto.innerHTML = dados.nome
            label.appendChild(nomeProduto)

            const unidades = document.createElement('p')
            unidades.innerHTML = dados.estoque + ' UNDs'
            label.appendChild(unidades)

            estoqueBaixo.appendChild(label)

            lista.push({nome: dados.nome})
        }
    })

    if(lista.length > 0) {
        const nomes = lista.map(item => item.nome).join('\n')
        console.log('Produtos com estoque baixo:\n\n' + nomes)
    }
}

function selecaoLoja() {
    const selecionarLoja = document.getElementById('selecionarLoja')
        selecionarLoja.style.display = 'flex'

        // BUSCA NO LOCALSTORAGE AS LOJAS QUE O ABENÇOADO TEM NO CADASTRO DELE, JUNTO AO CARGO
        const lojas = JSON.parse(localStorage.getItem('lojas'))

        // FAZ UM FOREACH PRA ACESSAR CADA LOJA NO CADASTRO
        lojas.forEach((loja) => {

            // CRIA A LABEL LÁ NO HTML PRO AMIGÃO CLICAR
            const lojasSelecao = document.getElementById('lojasSelecao')
            const label = document.createElement('label')
            label.setAttribute('id', loja.idLoja)
            label.dataset.cargo = loja.cargo
            label.classList.add('labelLoja')

            const nomeLoja = document.createElement('p')
            nomeLoja.textContent = loja.nomeLoja
            label.appendChild(nomeLoja)

            const cargoLoja = document.createElement('p')
            cargoLoja.textContent = 'Cargo: ' + loja.cargo
            label.appendChild(cargoLoja)
            
            lojasSelecao.appendChild(label)
        })

        // CAPTURAR O QUE O AMIGÃO ESCOLHEU E SETAR NO selecaoLoja DENTRO DO LOCALSTORAGE PRA PODER PUXAR AS INFOS DEPOIS
        const lojasSelection = document.querySelectorAll('.labelLoja')

        lojasSelection.forEach(loja => {
            loja.addEventListener('click', (event) => {
                // SETA DENTRO DO LOCALSTORAGE O ID DA LOJA QUE ESTAVA NO BOTÃO
                localStorage.setItem('selecaoLoja', event.currentTarget.id)
                localStorage.setItem('cargo', event.currentTarget.dataset.cargo)
                console.log(localStorage.selecaoLoja)
                console.log(localStorage.cargo)

                // ACHA O ELEMENTO E REMOVE ELE DA TELA PRA PODER USAR O SISTEMA
                const selecionarLoja = document.getElementById('selecionarLoja')
                selecionarLoja.style.display = 'none'

                // REINICIA A PAGINA PRA PUXAR TUDO CERTO
                window.location.reload()
            })
        })
}

async function adicionarLoja() {
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
                        <span>Taxas</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-3">
                        <div class="swal-edit-produto-field">
                            <label>Crédito</label>
                            <input id="AddLojaCredito" class="swal-edit-produto-input" type="number" step="0.0001">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label>Débito</label>
                            <input id="AddLojaDebito" class="swal-edit-produto-input" type="number" step="0.0001">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label>iFood</label>
                            <input id="AddLojaIfood" class="swal-edit-produto-input" type="number" step="0.0001">
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

            const id = popup.querySelector('#AddLojaId')
            const nome = popup.querySelector('#AddLojaNome')
            const endereco = popup.querySelector('#AddLojaEndereco')
            const credito = popup.querySelector('#AddLojaCredito')
            const debito = popup.querySelector('#AddLojaDebito')
            const ifood = popup.querySelector('#AddLojaIfood')

            const btnCancelar = popup.querySelector('#swalAddLojaCancelar')
            const btnSalvar = popup.querySelector('#swalAddLojaSalvar')

            function normalizarNumero(valor) {
                if (!valor) return 0
                return parseFloat(String(valor).replace(',', '.')) || 0
            }

            btnCancelar.onclick = () => Swal.close()

            btnSalvar.onclick = async () => {
                if (!id.value.trim() || !nome.value.trim() || !endereco.value.trim()) {
                    Swal.showValidationMessage('Preencha os campos obrigatórios')
                    return
                }

                const idGerado = firebase.firestore().collection('lojas').doc().id;

                const novaLoja = {
                    id: idGerado,
                    nome: nome.value.trim(),
                    endereco: endereco.value.trim(),
                    taxas: {
                        credito: normalizarNumero(credito.value),
                        debito: normalizarNumero(debito.value),
                        ifood: normalizarNumero(ifood.value)
                    }
                }

                try {
                    console.log('Loja criada:', novaLoja)

                    // 👉 aqui você pode salvar no Firebase depois
                    // await db.collection("lojas").doc(novaLoja.id).set(novaLoja)

                    Swal.close()

                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso',
                        text: 'Loja adicionada'
                    })

                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: error.message
                    })
                }
            }
        }
    })
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

verificarIdLoja()
ultimasVendas()
calcularMetas()
calcularValorTotal()
itensQuantidades()
reloadVisaoGeral()
estoqueBaixo()
mostrarCashbackDisponivel()