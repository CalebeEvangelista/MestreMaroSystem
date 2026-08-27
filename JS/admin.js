async function bloquearAcesso() {

    const idAlvo = 'uR8VejSPIUXR8ij3LyTIeQDt7vL2';

    const usuario = firebase.auth().currentUser;

    if (!usuario) {
        window.location.href = 'login.html';
        return false;
    }

    if (usuario.uid !== idAlvo) {
        alert('Você não tem permissão para acessar esta página!');
        window.location.href = 'index.html';
        return false;
    }

    return true;
}

function openScreen(event, screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

function voltarSistema() {
    window.location.href = '/HTML/home.html';
}

async function completeInfos() {
  const usersAtivos = document.getElementById('ativos')
  const usersVencendo = document.getElementById('vencendo')
  const usersInadiplentes = document.getElementById('inadiplentes')
  const faturamentoEl = document.getElementById('faturamento')

  const db = firebase.firestore()
  const snapshot = await db.collection('users').orderBy('nome').get()

  let ativos = 0
  let vencendo = 0
  let inadiplentes = 0
  let faturamentoTotal = 0

  const tabela = document.getElementById('tabelaDashboard')
  tabela.innerHTML = ''

  snapshot.forEach(usuario => {
    const user = usuario.data()

    if (user.status == 'Pendente aprovação' || user.status == 'funcionario') return

    if (user.status == 'ativo'){ativos += 1}
    if (user.status == 'bloqueado'){inadiplentes += 1}

   const lojasArray = user.lojas
    ? (Array.isArray(user.lojas) ? user.lojas : Object.values(user.lojas))
    : [];

    let lojasNomes = ''
    if (lojasArray.length > 0) {
      const primeiraLoja = lojasArray[0].data ? lojasArray[0].data().nome : lojasArray[0].nome
      const mais = lojasArray.length - 1
      lojasNomes = mais > 0 ? `${primeiraLoja} / (+${mais} Lojas)` : primeiraLoja
    } else {
      lojasNomes = 'N/A'
    }

    const tr = document.createElement('tr')
    tr.setAttribute('id', user.id)

    const nomeTd = document.createElement('td')
    nomeTd.textContent = user.nome
    tr.appendChild(nomeTd)

    const lojasTd = document.createElement('td')
    lojasTd.textContent = lojasNomes
    tr.appendChild(lojasTd)

    const usersAdc = document.createElement('td')
    usersAdc.textContent = user.adicionais || 0
    tr.appendChild(usersAdc)

    const statusTd = document.createElement('td')
    const statusReal = document.createElement('span')
    statusReal.textContent = user.status.toUpperCase() || 'S/ Status'
    statusReal.classList.add('status')

    if (user.status == 'ativo') {
      statusReal.classList.add('ativo')
    } else if (user.status == 'vencendo') {
      statusReal.classList.add('vencendo')
    } else {
      statusReal.classList.add('atraso')
    }

    statusTd.appendChild(statusReal)
    tr.appendChild(statusTd)

    const vencimentoTd = document.createElement('td');

    const data = user.dataExpiracao
      ? new Date(user.dataExpiracao.seconds * 1000)
      : null;

    vencimentoTd.textContent = data && !isNaN(data.getTime())
      ? data.toLocaleDateString('pt-BR')
      : '00/00/0000';

    tr.appendChild(vencimentoTd);

    const faturamentoTd = document.createElement('td')
    const faturamentoUser = user.faturamento || 0
    faturamentoTd.textContent = 'R$' + Number(faturamentoUser).toFixed(2).replace('.',',')
    faturamentoTotal += faturamentoUser
    tr.appendChild(faturamentoTd)

    const botoesTd = document.createElement('td')

    const btnVer = document.createElement('button')
    btnVer.textContent = 'Ver'
    btnVer.classList.add('btn')
    botoesTd.appendChild(btnVer)

    const btnEdit = document.createElement('button')
    btnEdit.textContent = 'Editar'
    btnEdit.classList.add('btn', 'edit')
    btnEdit.setAttribute('data-id', usuario.id) // <-- aqui colocamos o ID do usuário
    btnEdit.addEventListener('click', () => editarUsuario(usuario.id))
    botoesTd.appendChild(btnEdit)

    if (user.status == 'ativo') {
      const btnExcluir = document.createElement('button')
      btnExcluir.textContent = 'Excluir'
      btnExcluir.classList.add('btn', 'ativar')
      btnExcluir.style.backgroundColor = 'red'
      btnExcluir.addEventListener('click', () => deletarUsuario(usuario.id))
      botoesTd.appendChild(btnExcluir)
    } else {
      const btnAtivar = document.createElement('button')
      btnAtivar.textContent = 'Ativar'
      btnAtivar.classList.add('btn', 'ativar')
      btnAtivar.style.backgroundColor = 'green'
      btnAtivar.addEventListener('click', () => ativarUsuario(usuario.id))
      botoesTd.appendChild(btnAtivar)
    }

    tr.appendChild(botoesTd)
    tabela.appendChild(tr)
  })

  usersAtivos.textContent = ativos
  usersVencendo.textContent = vencendo
  usersInadiplentes.textContent = inadiplentes
  faturamentoEl.textContent = 'R$ ' + Number(faturamentoTotal).toFixed(2).replace('.',',')
}

// Função para deletar usuario
async function deletarUsuario(id) {
  const db = firebase.firestore();

  const resultado = await Swal.fire({

      title: 'Tem certeza?',

      text: 'Esse cadastro será excluído permanentemente.',

      icon: 'warning',

      showCancelButton: true,

      confirmButtonText: 'Sim, excluir',

      cancelButtonText: 'Cancelar'

  });


  if (!resultado.isConfirmed) return;


  try {

      await db.collection('users').doc(id).delete();

      alert('Usuario deletado!')

      window.location.reload();


  } catch (erro) {

      console.error(
          'Erro ao excluir:',
          erro
      );

      Swal.fire({

          icon: 'error',

          title: 'Erro ao excluir',

          text: 'Não foi possível excluir esse cadastro.'

      });

  }

};

// Função que abre o Swal e busca o usuário pelo ID
async function editarUsuario(userId) {
  const db = firebase.firestore();
  const docSnap = await db.collection('users').doc(userId).get();

  if (!docSnap.exists) {
    Swal.fire('Erro', 'Usuário não encontrado', 'error');
    return;
  }

  const user = docSnap.data();

  // Normaliza lojas
  const lojasArray = Array.isArray(user.lojas) ? user.lojas : Object.values(user.lojas);

  // Usuários adicionais simulados
  const adicionaisArray = [
    { email: 'teste@teste.com', nome: 'Adicional 1' },
    { email: 'teste2@teste.com', nome: 'Adicional 2' }
  ];

  let dataExpiracao = '';

  const data = user.dataExpiracao
    ? new Date(user.dataExpiracao.seconds * 1000)
    : null;

  if (data && !isNaN(data.getTime())) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    dataExpiracao = `${ano}-${mes}-${dia}`;
  } else {
    dataExpiracao = '';
  }

   let primeiroPagamento = '';

  const data2 = user.primeiroPagamento
    ? new Date(user.primeiroPagamento.seconds * 1000)
    : null;

  if (data2 && !isNaN(data2.getTime())) {
    const ano = data2.getFullYear();
    const mes = String(data2.getMonth() + 1).padStart(2, '0');
    const dia = String(data2.getDate()).padStart(2, '0');

    primeiroPagamento = `${ano}-${mes}-${dia}`;
  } else {
    primeiroPagamento = '';
  }

  Swal.fire({
    customClass: {
      popup: 'swal-usuario-popup',
      content: 'swal-usuario-container'
    },
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    width: '65vw',        // ocupa 65% da tela
    heightAuto: false,    // respeita altura do CSS
    html: `
      <div class="swal-usuario-header">
        <h2>${user.nome}</h2>
        <p>ID: ${userId}</p>
      </div>

      <div class="swal-usuario-body">
        <!-- Esquerda: infos do usuário -->
        <div class="swal-usuario-left">
          <label>Email</label>
          <input type="email" id="swal-email" value="${user.email || ''}">
          <label>CPF</label>
          <input type="text" id="swal-cpf" value="${user.cpf || ''}">
          <label>Usuários Adicionais</label>
          <div class="swal-usuario-adicionais" id="swal-adicionais">
            ${adicionaisArray.map((ad, i) => `
              <label class="swal-usuario-adicional-label">
                <span>${ad.nome} - ${ad.email}</span>
                <button class="swal-usuario-adicional-btn swal-usuario-adicional-btn-alterar" data-index="${i}">Alterar</button>
                <button class="swal-usuario-adicional-btn swal-usuario-adicional-btn-excluir" data-index="${i}">Excluir</button>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Direita -->
        <div class="swal-usuario-right">
          <!-- Lojas -->
          <div class="swal-usuario-box">
            <h3>Lojas</h3>
            <div class="swal-usuario-lojas">
              ${lojasArray.map(lojaItem => {
                const loja = lojaItem.data ? lojaItem.data() : lojaItem;
                return `<div class="swal-usuario-loja">${loja.nome}</div>`;
              }).join('')}
            </div>
          </div>

          <!-- Status e Datas -->
          <div class="swal-usuario-box swal-usuario-box-status">
            <h3>Status e datas</h3>

            <label>Status</label>
            <select id="swal-status">
              <option value="Ativo" ${user.status === 'ativo' ? 'selected' : ''}>Ativo</option>
              <option value="Inativo" ${user.status === 'inativo' ? 'selected' : ''}>Inativo</option>
            </select>

            <label>Primeiro Pagamento</label>
            <input type="date" id="swal-primeiroPagamento" value="${primeiroPagamento || ''}" readonly>

            <label>Data de Expiração</label>
            <input type="date" id="swal-dataExpiracao" value="${dataExpiracao}" readonly>
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    preConfirm: () => ({
      email: document.getElementById('swal-email').value,
      cpf: document.getElementById('swal-cpf').value,
      status: document.getElementById('swal-status').value,
      primeiroPagamento: document.getElementById('swal-primeiroPagamento').value,
      dataExpiracao: document.getElementById('swal-dataExpiracao').value
    })
  }).then(result => {
    if (result.isConfirmed) {
      console.log('Dados editados:', result.value);
      // Aqui você pode adicionar a lógica para Alterar/Excluir usuários adicionais
    }
  });
}

// Ativa o usuário: troca o status para 'ativo', independente do valor atual
async function ativarUsuario(userId) {
  const db = firebase.firestore();

  const resultado = await Swal.fire({
    title: 'Ativar usuário?',
    text: 'O status desse usuário será alterado para "ativo".',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sim, ativar',
    cancelButtonText: 'Cancelar'
  });

  if (!resultado.isConfirmed) return;

  try {
    await db.collection('users').doc(userId).update({
      status: 'ativo'
    });

    Swal.fire({
      icon: 'success',
      title: 'Usuário ativado',
      timer: 1500,
      showConfirmButton: false
    });

    completeInfos(); // recarrega a tabela
  } catch (erro) {
    console.error('Erro ao ativar usuário:', erro);
    Swal.fire('Erro', 'Não foi possível ativar esse usuário.', 'error');
  }
}

async function carregarTabelaPromocional() {

    const tbody = document.getElementById('tabelaPromocional');
    const db = firebase.firestore();

    tbody.innerHTML = '';

    try {

        const snapshot = await db
            .collection('promocional')
            .orderBy('criadoEm')
            .get();

        if (snapshot.empty) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="6">Nenhum cadastro encontrado.</td>
                </tr>
            `;

            return;
        }

        snapshot.forEach(doc => {

            const d = doc.data();

            if (d.faturamento == '') return;


            // =========================
            // CRIA A LINHA
            // =========================

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${d.nome || '-'}</td>

                <td>
                    ${d.cidade || '-'} / ${d.estado || '-'}
                </td>

                <td>
                    ${d.loja || '-'}
                </td>

                <td>
                    ${d.segmento || '-'}
                </td>

                <td>
                    ${d.faturamento || '-'}
                </td>

                <td>

                    <button class="btn visualizar">
                        Visualizar
                    </button>

                    <button class="btn aprovar">
                        Aprovar
                    </button>

                    <button class="btn edit recusar">
                        Recusar
                    </button>

                    <button class="btn exc excluir">
                        Excluir
                    </button>

                </td>
            `;


            // =========================
            // VISUALIZAR CADASTRO
            // =========================

            tr.querySelector('.visualizar').onclick = async () => {

              let criadoEm = '-';

              if (d.criadoEm) {
                  criadoEm = d.criadoEm.toDate
                      ? d.criadoEm.toDate().toLocaleString('pt-BR')
                      : d.criadoEm;
              }

              const statusMap = {
                  aprovado: { label: 'Aprovado', classe: 'aprovado' },
                  recusado: { label: 'Recusado', classe: 'recusado' }
              };
              const statusInfo = statusMap[d.status] || { label: 'Pendente', classe: 'pendente' };

              await Swal.fire({
                  customClass: { popup: 'swal-promocional-popup' },
                  title: '',
                  showCloseButton: true,
                  showConfirmButton: false,
                  html: `
                      <div class="swal-promocional-container">

                          <div class="swal-promocional-header">
                              <div class="swal-promocional-header-top">
                                  <h2>${d.nome || '-'}</h2>
                                  <span class="swal-promocional-status status-${statusInfo.classe}">${statusInfo.label}</span>
                              </div>
                              <p class="swal-promocional-subtitle">
                                  <i class="fa-solid fa-store"></i> ${d.loja || '-'}
                                  <span class="dot">•</span>
                                  <i class="fa-regular fa-calendar"></i> ${criadoEm}
                                  <span class="dot">•</span>
                                  <i class="fa-solid fa-circle-nodes"></i> ${d.origem || '-'}
                              </p>
                          </div>

                          <div class="swal-promocional-section">
                              <div class="swal-promocional-section-title">
                                  <span>Contato</span>
                                  <div class="swal-promocional-section-line"></div>
                              </div>
                              <div class="swal-promocional-grid">
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-envelope"></i> E-mail</small>
                                      <strong>${d.email || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-phone"></i> Telefone</small>
                                      <strong>${d.telefone || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item full">
                                      <small><i class="fa-solid fa-location-dot"></i> Endereço</small>
                                      <strong>${d.endereco || '-'} — ${d.cidade || '-'}/${d.estado || '-'}</strong>
                                  </div>
                              </div>
                          </div>

                          <div class="swal-promocional-section">
                              <div class="swal-promocional-section-title">
                                  <span>Operação</span>
                                  <div class="swal-promocional-section-line"></div>
                              </div>
                              <div class="swal-promocional-grid">
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-tags"></i> Segmento</small>
                                      <strong>${d.segmento || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-shop"></i> Tamanho da operação</small>
                                      <strong>${d.operacao || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-users"></i> Funcionários</small>
                                      <strong>${d.funcionarios || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-cash-register"></i> Vendas/dia</small>
                                      <strong>${d.vendas || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item">
                                      <small><i class="fa-solid fa-laptop"></i> Sistema atual</small>
                                      <strong>${d.sistema || '-'}</strong>
                                  </div>
                                  <div class="swal-promocional-item destaque">
                                      <small><i class="fa-solid fa-sack-dollar"></i> Faturamento médio</small>
                                      <strong>${d.faturamento || '-'}</strong>
                                  </div>
                              </div>
                          </div>

                          <div class="swal-promocional-section">
                              <div class="swal-promocional-section-title">
                                  <span>Principal desafio</span>
                                  <div class="swal-promocional-section-line"></div>
                              </div>
                              <p class="swal-promocional-desafio">${d.desafio || 'Não informado.'}</p>
                          </div>

                      </div>
                  `
              });
            };


            // =========================
            // APROVAR
            // =========================

            tr.querySelector('.aprovar').onclick = async () => {

                await db
                    .collection('promocional')
                    .doc(doc.id)
                    .update({
                        status: 'aprovado'
                    });


                const snapshot = await db
                    .collection('promocional')
                    .doc(doc.id)
                    .get();


                const dados = snapshot.data();


                cadastrarNovoUsuario(
                    dados.nome,
                    dados.loja,
                    dados.email,
                    'maro123',
                    dados.origem
                );

            };


            // =========================
            // RECUSAR
            // =========================

            tr.querySelector('.recusar').onclick = async () => {

                await db
                    .collection('promocional')
                    .doc(doc.id)
                    .update({
                        status: 'recusado'
                    });

            };


            // =========================
            // EXCLUIR
            // =========================

            tr.querySelector('.excluir').onclick = async () => {

                const telaAtual =
                    document.querySelector('.screen.active')?.id
                    || 'dashboard';


                const resultado = await Swal.fire({

                    title: 'Tem certeza?',

                    text: 'Esse cadastro será excluído permanentemente.',

                    icon: 'warning',

                    showCancelButton: true,

                    confirmButtonText: 'Sim, excluir',

                    cancelButtonText: 'Cancelar'

                });


                if (!resultado.isConfirmed) return;


                try {

                    await db
                        .collection('promocional')
                        .doc(doc.id)
                        .delete();


                    localStorage.setItem(
                        'telaAdminAtual',
                        telaAtual
                    );


                    window.location.reload();


                } catch (erro) {

                    console.error(
                        'Erro ao excluir:',
                        erro
                    );


                    Swal.fire({

                        icon: 'error',

                        title: 'Erro ao excluir',

                        text: 'Não foi possível excluir esse cadastro.'

                    });

                }

            };


            tbody.appendChild(tr);

        });


    } catch (erro) {

        console.error(
            'Erro ao carregar promocionais:',
            erro
        );


        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    Erro ao carregar dados.
                </td>
            </tr>
        `;

    }

}

window.addEventListener('DOMContentLoaded', () => {
  const telaSalva = localStorage.getItem('telaAdminAtual');
  if (!telaSalva) return;

  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  const tela = document.getElementById(telaSalva);
  if (tela) {
    tela.classList.add('active');
  }

  const mapaBotoes = {
    dashboard: 'dashboardButton',
    assinantes: 'assinantesButton',
    vencimentos: 'vencimentosButton',
    faturamentoTela: 'faturamentoButton',
    promocional: 'promocionalButton'
  };

  const botao = document.getElementById(mapaBotoes[telaSalva]);
  if (botao) {
    botao.classList.add('active');
  }

  localStorage.removeItem('telaAdminAtual');
});

completeInfos()
carregarTabelaPromocional()
