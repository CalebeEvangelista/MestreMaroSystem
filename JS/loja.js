async function alterarTaxasPagamentos() {
    document.getElementById('editarTaxas').addEventListener('click', function() {
        Swal.fire({
            width: '920px',
            showConfirmButton: false,
            showCancelButton: false,
            focusConfirm: false,
            heightAuto: false,
            customClass: {
                popup: 'swal-add-produto-popup',
                container: 'swal-add-produto-container',
            },
            html: `
                <div class="swal-add-produto-wrap">
                    <div class="swal-add-produto-header">
                        <h2>Editar taxas</h2>
                        <div class="swal-add-produto-subtitle">Preencha as taxas de pagamento</div>
                    </div>

                    <div class="swal-add-produto-section">
                        <div class="swal-add-produto-section-head">
                            <span>Taxas de pagamento</span>
                            <div class="swal-add-produto-section-line"></div>
                        </div>

                        <div class="swal-add-produto-grid swal-add-produto-grid-2" style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                            <div style="display: flex; gap: 16px; justify-content: center;">
                                <div class="swal-add-produto-field" style="text-align: center;">
                                    <label for="taxaCredito">Taxa Crédito (%)</label>
                                    <input
                                        id="taxaCredito"
                                        class="swal-add-produto-input"
                                        type="number"
                                        placeholder="Taxa de Crédito"
                                        step="0.01"
                                        style="text-align: center;"
                                    >
                                </div>

                                <div class="swal-add-produto-field" style="text-align: center;">
                                    <label for="taxaDebito">Taxa Débito (%)</label>
                                    <input
                                        id="taxaDebito"
                                        class="swal-add-produto-input"
                                        type="number"
                                        placeholder="Taxa de Débito"
                                        step="0.01"
                                        style="text-align: center;"
                                    >
                                </div>
                            </div>

                            <div style="display: flex; justify-content: center;">
                                <div class="swal-add-produto-field" style="text-align: center;">
                                    <label for="taxaIfood">Taxa iFood (%)</label>
                                    <input
                                        id="taxaIfood"
                                        class="swal-add-produto-input"
                                        type="number"
                                        placeholder="Taxa d0 iFood"
                                        step="0.01"
                                        style="text-align: center;"
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="swal-add-produto-footer" style="display: flex; justify-content: center; gap: 12px;">
                    <button type="button" id="swalAddProdutoSalvar" class="swal-add-produto-btn swal-add-produto-btn-confirm">✓</button>
                    <button type="button" id="swalAddProdutoCancelar" class="swal-add-produto-btn swal-add-produto-btn-cancel">✕</button>
                </div>
            `,
            didOpen: async () => {
                const popup = Swal.getPopup();

                const taxaCredito = popup.querySelector('#taxaCredito');
                const taxaDebito = popup.querySelector('#taxaDebito');
                const taxaIfood = popup.querySelector('#taxaIfood');

                const idLoja = localStorage.getItem('selecaoLoja')

                const db = firebase.firestore();
                const snapshot = await db.collection('lojas').where('id', '==', idLoja).get()

                const loja = snapshot.docs[0].data();

                taxaCredito.value = (Number(loja.taxas.credito) * 100).toFixed(2)
                taxaDebito.value = (Number(loja.taxas.debito) * 100).toFixed(2)
                taxaIfood.value = (Number(loja.taxas.ifood) * 100).toFixed(2)


                const botaoSalvar = popup.querySelector('#swalAddProdutoSalvar');
                const botaoCancelar = popup.querySelector('#swalAddProdutoCancelar');

                botaoCancelar.addEventListener('click', () => {
                    Swal.close();
                });

                botaoSalvar.addEventListener('click', () => {
                    const credito = taxaCredito.value;
                    const debito = taxaDebito.value;
                    const ifood = taxaIfood.value;


                    if (!credito || !debito || !ifood) {
                        Swal.showValidationMessage('Por favor, preencha todas as taxas!');
                        return;
                    }

                    const novasTaxas = {
                        credito: parseFloat(taxaCredito.value) / 100,
                        debito: parseFloat(taxaDebito.value)/ 100,
                        ifood: parseFloat(taxaIfood.value)/ 100,
                    }

                    try {
                        db.collection('lojas').doc(snapshot.docs[0].id).set({ taxas: novasTaxas }, { merge: true })
                    } catch (error) {
                        console.warn(error)
                    }

                    alert(`Taxas Atualizadas:\nCrédito: ${credito}%\nDébito: ${debito}%\niFood: ${ifood}%`);

                    Swal.close();
                });
            }
        });


    });
}

async function mostrarDados() {
    const taxaCredito = document.getElementById('taxaCredito')
    const taxaDebito = document.getElementById('taxaDebito')
    const taxaIfood = document.getElementById('taxaIfood')
    const chavePixSpace = document.getElementById('chavePixSpace')
    const nomeLoja = document.getElementById('nomeLoja')
    const respLoja = document.getElementById('respLoja')

    const idLoja = localStorage.getItem('selecaoLoja')

    const db = firebase.firestore();
    const snapshot = await db.collection('lojas').where('id', '==', idLoja).get()

    const loja = snapshot.docs[0].data();

    taxaCredito.textContent = 'Crédito: ' + Number(loja.taxas.credito * 100).toFixed(2) + '%'
    taxaDebito.textContent = 'Débito: ' + Number(loja.taxas.debito * 100).toFixed(2) + '%'
    taxaIfood.textContent = 'IFOOD: ' + Number(loja.taxas.ifood * 100).toFixed(2) + '%'

    chavePixSpace.textContent = 'Chave Pix: ' + loja.chavePix

    nomeLoja.textContent = loja.nome
    respLoja.textContent = loja.nome
}

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function abrirSwalEditarInformacoes(dados, docRef) {
    await Swal.fire({
        width: '920px',
        showConfirmButton: false,
        showCancelButton: false,
        focusConfirm: false,
        heightAuto: false,
        customClass: {
            popup: 'swal-edit-produto-popup',
            container: 'swal-edit-produto-container',
        },
        html: `
            <div class="swal-edit-produto-container">
                <div class="swal-edit-produto-header">
                    <h2>Editar informações</h2>
                    <div class="swal-edit-produto-subtitle">Atualize os dados do cadastro selecionado</div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Informações principais</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-2">
                        <div class="swal-edit-produto-field">
                            <label for="Editnome">Nome</label>
                            <input 
                                id="Editnome" 
                                class="swal-edit-produto-input" 
                                type="text"
                                value="${escapeHtml(dados.nome || '')}"
                                placeholder="Digite o nome">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="Editcidade">Cidade</label>
                            <input 
                                id="Editcidade" 
                                class="swal-edit-produto-input" 
                                type="text"
                                value="${escapeHtml(dados.cidade || '')}"
                                placeholder="Digite a cidade">
                        </div>
                    </div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Acesso e identificação</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-2">
                        <div class="swal-edit-produto-field">
                            <label for="EditchatID">Chat ID</label>
                            <input 
                                id="EditchatID" 
                                class="swal-edit-produto-input" 
                                type="text"
                                value="${escapeHtml(dados.chatID || '')}"
                                placeholder="Digite o Chat ID">
                        </div>

                        <div class="swal-edit-produto-field">
                            <label for="EditidResp">ID responsável</label>
                            <input 
                                id="EditidResp" 
                                class="swal-edit-produto-input" 
                                type="text"
                                value="${escapeHtml(dados.idResp || '')}"
                                placeholder="Digite o ID do responsável">
                        </div>

                        <div class="swal-edit-produto-field swal-col-2">
                            <label for="Editid">ID do registro</label>
                            <input 
                                id="Editid" 
                                class="swal-edit-produto-input" 
                                type="text"
                                value="${escapeHtml(dados.id || '')}"
                                placeholder="ID do documento">
                        </div>
                    </div>
                </div>

                <div class="swal-edit-produto-section">
                    <div class="swal-edit-produto-section-title">
                        <span>Pagamento</span>
                        <div class="swal-edit-produto-section-line"></div>
                    </div>

                    <div class="swal-edit-produto-grid swal-edit-produto-grid-2">
                        <div class="swal-edit-produto-field swal-col-2">
                            <label for="EditchavePix">Chave Pix</label>
                            <input 
                                id="EditchavePix" 
                                class="swal-edit-produto-input" 
                                type="text"
                                value="${escapeHtml(dados.chavePix || '')}"
                                placeholder="Digite a chave Pix">
                        </div>
                    </div>
                </div>
            </div>

            <div class="swal-edit-produto-footer">
                <button 
                    type="button" 
                    id="swalEditarInfoCancelar" 
                    class="swal-edit-produto-btn swal-edit-produto-btn-cancel">✕</button>

                <button 
                    type="button" 
                    id="swalEditarInfoSalvar" 
                    class="swal-edit-produto-btn swal-edit-produto-btn-confirm">✓</button>
            </div>
        `,
        didOpen: () => {
            const popup = Swal.getPopup();

            const nome = popup.querySelector('#Editnome');
            const cidade = popup.querySelector('#Editcidade');
            const chatID = popup.querySelector('#EditchatID');
            const idResp = popup.querySelector('#EditidResp');
            const id = popup.querySelector('#Editid');
            const chavePix = popup.querySelector('#EditchavePix');

            const botaoCancelar = popup.querySelector('#swalEditarInfoCancelar');
            const botaoSalvar = popup.querySelector('#swalEditarInfoSalvar');

            botaoCancelar.onclick = () => Swal.close();

            botaoSalvar.onclick = async () => {
                if (!nome.value.trim()) {
                    Swal.showValidationMessage('Informe o nome');
                    return;
                }

                const dadosEditados = {
                    nome: nome.value.trim(),
                    cidade: cidade.value.trim(),
                    chatID: chatID.value.trim(),
                    idResp: idResp.value.trim(),
                    id: id.value.trim(),
                    chavePix: chavePix.value.trim()
                };

                try {
                    if (docRef) {
                        await docRef.update(dadosEditados);
                    }

                    Swal.close();

                    Swal.fire({
                        icon: 'success',
                        title: 'Salvo',
                        text: 'Informações atualizadas com sucesso'
                    });

                    console.log('Dados editados:', dadosEditados);
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: error.message
                    });
                }
            };
        }
    });
}

function editarPix() {
    alert('Função em desenvolvimento.')
}

function novoFuncionario() {
    Swal.fire({
        html: `
        <div class="swal-caixa-wrap">
            <div class="swal-caixa-header">
            <h2>Cadastrar funcionário</h2>
            <p class="swal-caixa-subtitle">Preencha os dados abaixo</p>
            </div>
    
            <div class="swal-caixa-section">
            <div class="swal-caixa-section-head">
                <span>Dados do funcionário</span>
                <div class="swal-caixa-section-line"></div>
            </div>
    
            <div class="swal-caixa-field">
                <label>Nome</label>
                <input id="func-nome" class="swal-caixa-input" type="text" placeholder="Ex: Maria Souza">
            </div>
    
            <div class="swal-caixa-field">
                <label>Cargo</label>
                <select id="func-cargo" class="swal-caixa-input">
                <option value="">Selecione um cargo</option>
                <option value="Atendente">Atendente</option>
                <option value="Caixa">Caixa</option>
                <option value="Gerente">Gerente</option>
                <option value="ADM">ADM</option>
                </select>
            </div>
    
            <div class="swal-caixa-field">
                <label>E-mail</label>
                <input id="func-email" class="swal-caixa-input" type="email" placeholder="funcionario@empresa.com">
            </div>
    
            <div class="swal-caixa-field">
                <label>Chave Pix</label>
                <input id="func-pix" class="swal-caixa-input" type="text" placeholder="CPF, e-mail, telefone ou chave aleatória">
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
            const nome = document.getElementById('func-nome').value.trim();
            const cargo = document.getElementById('func-cargo').value;
            const email = document.getElementById('func-email').value.trim();
            const pix = document.getElementById('func-pix').value.trim();
            //Colocar o restante idLoja, dataCadastro, ultimoLogin e ID
        
            if (!nome) {
                Swal.showValidationMessage('Informe o nome do funcionário');
                return false;
            }
            if (!cargo) {
                Swal.showValidationMessage('Selecione um cargo');
                return false;
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                Swal.showValidationMessage('Informe um e-mail válido');
                return false;
            }
            if (!pix) {
                Swal.showValidationMessage('Informe a chave Pix');
                return false;
            }
        
            return { nome, cargo, email, pix };
        }
    }).then((result) => {
        if (!result.isConfirmed) return;
        salvarFuncionario(result.value);
    });
    }
    
async function salvarFuncionario(dados) {
    const db = firebase.firestore()
    try {
        const senha = 'maro123'

        const userCredential = await firebase.auth().createUserWithEmailAndPassword(dados.email, senha);
        const user = userCredential.user;
        const idUser = user.uid;

        const hoje = new Date();
        const data = hoje.toLocaleDateString('pt-BR');

        const novoFuncionario = {
            nome: dados.nome,
            cargo: dados.cargo,
            idLoja: localStorage.getItem('selecaoLoja'),
            dataCadastro: data,
            id: idUser,
            email: dados.email,
            pix: dados.pix,
            cadastradoPor: localStorage.getItem('userId'),
            status: 'funcionario'
        }

        await db.collection('users').doc(novoFuncionario.id).set(novoFuncionario)
    
        Swal.fire({
        icon: 'success',
        title: 'Funcionário cadastrado!',
        timer: 1500,
        showConfirmButton: false,
        heightAuto: false,
        });
    } catch (err) {
        Swal.fire({
        icon: 'error',
        title: 'Erro ao salvar',
        text: err.message
        });
    }
}

async function verFuncionarios() {
  const db = firebase.firestore();
  const idLoja = localStorage.getItem('selecaoLoja');

  try {
    const snapshot = await db.collection('users')
      .where('idLoja', '==', idLoja)
      .where('status', '==', 'funcionario')
      .get();

    let linhas = '';

    if (snapshot.empty) {
      linhas = `<tr><td colspan="5" style="text-align:center;">Nenhum funcionário cadastrado</td></tr>`;
    } else {
      snapshot.forEach(doc => {
        const f = doc.data();
        linhas += `
          <tr>
            <td>${f.nome || '-'}</td>
            <td>${f.cargo || '-'}</td>
            <td>${f.email || '-'}</td>
            <td style="white-space:nowrap;">${f.pix || '-'}</td>
            <td style="white-space:nowrap;">${f.dataCadastro || '-'}</td>
          </tr>
        `;
      });
    }

    Swal.fire({
      html: `
        <div class="swal-tabela-wrap">
          <h2 class="swal-tabela-titulo">Funcionários cadastrados</h2>
          <table class="swal-tabela-funcionarios">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>E-mail</th>
                <th style="white-space:nowrap;">Pix</th>
                <th style="white-space:nowrap;">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              ${linhas}
            </tbody>
          </table>
        </div>
      `,
      customClass: {
        popup: 'swal-tabela-popup',
        confirmButton: 'swal-caixa-btn swal-caixa-btn-confirm'
      },
      buttonsStyling: false,
      showCancelButton: false,
      confirmButtonText: 'Fechar',
      heightAuto: false,
    });

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao carregar funcionários',
      text: err.message
    });
  }
}

// mostrarDados() e alterarTaxasPagamentos() agora só rodam quando a tela
// "Minha loja" é aberta pela primeira vez (ver carregarDadosDaTela em home.js).